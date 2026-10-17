// Optional cloud sync: sign in with Google and keep every device's routines in sync
// through Firebase (Firestore). Does nothing until firebase-config.js is filled in.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const app = window.RoutinesApp;
const $ = (id) => document.getElementById(id);
const EMPTY = { routines: [], deleted: {}, settings: { updatedAt: 0 } };

/* ---------- merging ---------- */

// Combine two copies of the data. Routine details follow whichever copy changed last;
// each day's status follows whichever device set it last; deletes win over older edits.
export function merge(a, b) {
  const deleted = { ...a.deleted };
  for (const [id, t] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, t);

  // Keep the cloud copy's order (b) and append anything only this device has, so devices agree on order.
  const byId = new Map();
  for (const r of [...b.routines, ...a.routines]) {
    byId.set(r.id, byId.has(r.id) ? mergeRoutine(byId.get(r.id), r) : r);
  }
  const routines = [...byId.values()].filter((r) => !(deleted[r.id] >= (r.updatedAt || 0)));
  const settings = (b.settings?.updatedAt || 0) > (a.settings?.updatedAt || 0) ? b.settings : a.settings;
  return { routines, deleted, settings };
}

function mergeRoutine(x, y) {
  const base = (y.updatedAt || 0) > (x.updatedAt || 0) ? y : x;
  const status = {};
  const stamps = {};
  const days = new Set([...Object.keys(x.status), ...Object.keys(y.status), ...Object.keys(x.stamps || {}), ...Object.keys(y.stamps || {})]);
  for (const day of days) {
    const tx = x.stamps?.[day] || 0;
    const ty = y.stamps?.[day] || 0;
    const src = ty > tx ? y : tx > ty ? x : x.status[day] ? x : y;
    if (src.status[day]) status[day] = src.status[day];
    if (tx || ty) stamps[day] = Math.max(tx, ty);
  }
  const created = x.created < y.created ? x.created : y.created;
  return { ...base, status, stamps, created };
}

// JSON with sorted keys, so copies compare equal no matter how the keys were ordered.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const same = (a, b) => canonical(a) === canonical(b);
const pick = (s) => ({ routines: s.routines || [], deleted: s.deleted || {}, settings: s.settings || EMPTY.settings });

/* ---------- Firebase ---------- */

if (firebaseConfig && app) start();

async function start() {
  $("sync-section").hidden = false;
  const [{ initializeApp }, authLib, db] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]).catch(() => {
    setStatus("⚠️ Can't reach the sync service right now");
    return [];
  });
  if (!initializeApp) return;

  const fb = initializeApp(firebaseConfig);
  const auth = authLib.getAuth(fb);
  const store = db.getFirestore(fb);
  let user = null;
  let remote = null;
  let unsubscribe = null;
  let timer = null;

  function write(state) {
    if (!user) return;
    setStatus("Syncing…");
    const data = JSON.parse(JSON.stringify(pick(state))); // Firestore rejects undefined values
    db.setDoc(db.doc(store, "users", user.uid), { ...data, savedAt: Date.now() })
      .then(() => setStatus(`✓ Synced · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`))
      .catch(() => setStatus("⚠️ Couldn't sync. Will retry when you make a change."));
  }

  // Called by the app after every local change.
  window.RoutinesSync = {
    push() {
      if (!user) return;
      clearTimeout(timer);
      timer = setTimeout(() => write(merge(pick(app.getState()), remote || EMPTY)), 700);
    },
  };

  authLib.onAuthStateChanged(auth, (u) => {
    user = u;
    unsubscribe?.();
    unsubscribe = null;
    remote = null;
    renderAccount(u);
    if (!u) return;
    setStatus("Syncing…");
    unsubscribe = db.onSnapshot(
      db.doc(store, "users", u.uid),
      (snap) => {
        remote = snap.exists() ? pick(snap.data()) : EMPTY;
        const local = pick(app.getState());
        const merged = merge(local, remote);
        if (!same(merged, local)) app.setState(merged);
        if (!same(merged, remote)) write(merged);
        else if (!snap.metadata.hasPendingWrites) setStatus(`✓ Synced · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      },
      () => setStatus("⚠️ Couldn't load your synced data")
    );
  });

  $("sync-signin").addEventListener("click", async () => {
    const provider = new authLib.GoogleAuthProvider();
    try {
      await authLib.signInWithPopup(auth, provider);
    } catch (e) {
      // Home-screen apps and some browsers block popups; use a full-page redirect instead.
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
        await authLib.signInWithRedirect(auth, provider);
      } else if (e.code !== "auth/popup-closed-by-user") {
        setStatus(`⚠️ Sign-in failed (${e.code || "error"})`);
      }
    }
  });
  $("sync-signout").addEventListener("click", () => authLib.signOut(auth));
}

function renderAccount(user) {
  $("sync-signed-out").hidden = !!user;
  $("sync-signed-in").hidden = !user;
  if (!user) return setStatus("");
  $("sync-name").textContent = user.displayName || user.email || "Signed in";
  $("sync-email").textContent = user.email || "";
  $("sync-avatar").textContent = (user.displayName || user.email || "?").trim()[0].toUpperCase();
}

function setStatus(text) {
  $("sync-status").textContent = text;
}
