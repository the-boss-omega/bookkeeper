const STORAGE_KEY = "routines-v1";
const SUGGESTIONS = ["Drink water", "Stretch", "Read 10 pages", "Walk outside", "Journal", "No phone in bed"];
const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5s.5 2 2 2.5C10 8 12 2 12 2z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const RING_LENGTH = 2 * Math.PI * 28;

const $ = (id) => document.getElementById(id);
const list = $("list");
const input = $("add-input");

// Each routine: { id, name, done: ["YYYY-MM-DD", ...] }
let routines = load();
let today = dayKey(new Date());
let selected = today;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
  } catch {}
}

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Consecutive completed days ending today (or yesterday, if today isn't done yet).
function streak(routine) {
  const done = new Set(routine.done);
  let day = done.has(today) ? today : shiftDays(today, -1);
  let count = 0;
  while (done.has(day)) {
    count++;
    day = shiftDays(day, -1);
  }
  return count;
}

function doneOn(day) {
  return routines.filter((r) => r.done.includes(day)).length;
}

function addRoutine(name) {
  name = name.trim();
  if (!name) return;
  routines.push({ id: crypto.randomUUID(), name, done: [] });
  save();
  render();
}

function toggle(id) {
  const r = routines.find((r) => r.id === id);
  r.done = r.done.includes(selected) ? r.done.filter((d) => d !== selected) : [...r.done, selected];
  save();
  render({ animateList: false });
}

function remove(id) {
  const r = routines.find((r) => r.id === id);
  if (!confirm(`Delete “${r.name}”? Its history will be removed too.`)) return;
  routines = routines.filter((r) => r.id !== id);
  save();
  render({ animateList: false });
}

function greeting() {
  if (selected !== today) {
    if (selected === shiftDays(today, -1)) return "Yesterday";
    return parseKey(selected).toLocaleDateString(undefined, { weekday: "long" });
  }
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function renderHeader() {
  $("date").textContent = parseKey(selected).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  $("title").textContent = greeting();

  const total = routines.length;
  const done = doneOn(selected);
  const fraction = total ? done / total : 0;
  $("ring-fill").style.strokeDashoffset = RING_LENGTH * (1 - fraction);
  $("ring-label").textContent = total ? `${done}/${total}` : "–";
  $("ring").classList.toggle("zero", done === 0);
  $("ring").setAttribute("aria-label", `${done} of ${total} routines done`);

  const status = $("status");
  if (!total) status.textContent = "";
  else if (done === total) status.textContent = selected === today ? "All done for today. Nicely done ✦" : "Everything was done this day ✦";
  else status.textContent = `${total - done} to go`;
}

function renderWeek() {
  const week = $("week");
  week.replaceChildren();
  for (let i = 6; i >= 0; i--) {
    const key = shiftDays(today, -i);
    const date = parseKey(key);
    const done = doneOn(key);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day" + (key === selected ? " selected" : "");
    btn.setAttribute("aria-pressed", key === selected);
    btn.setAttribute("aria-label", date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
    btn.innerHTML = `
      <span class="day-letter">${date.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
      <span class="day-num">${date.getDate()}</span>
      <span class="day-dot ${routines.length && done === routines.length ? "full" : done ? "part" : ""}"></span>`;
    btn.onclick = () => {
      selected = key;
      render();
    };
    week.append(btn);
  }
}

function renderList(animate) {
  list.replaceChildren();
  routines.forEach((r, i) => {
    const isDone = r.done.includes(selected);
    const s = streak(r);

    const li = document.createElement("li");
    li.className = "item" + (isDone ? " done" : "");
    if (animate) li.style.setProperty("--i", i);
    else li.style.animation = "none";

    const check = document.createElement("button");
    check.className = "check";
    check.innerHTML = CHECK;
    check.setAttribute("aria-pressed", isDone);
    check.setAttribute("aria-label", `${r.name}: ${isDone ? "done" : "not done"}`);
    check.onclick = () => toggle(r.id);

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = r.name;

    li.append(check, name);

    if (s > 0) {
      const streakEl = document.createElement("span");
      streakEl.className = "streak" + (s >= 3 ? " hot" : "");
      streakEl.title = `${s}-day streak`;
      streakEl.innerHTML = FLAME + s;
      li.append(streakEl);
    }

    const del = document.createElement("button");
    del.className = "del";
    del.innerHTML = CROSS;
    del.setAttribute("aria-label", `Delete ${r.name}`);
    del.onclick = () => remove(r.id);
    li.append(del);

    list.append(li);
  });

  $("empty").hidden = routines.length > 0;
}

function render({ animateList = true } = {}) {
  renderHeader();
  renderWeek();
  renderList(animateList);
}

// Adding
$("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  addRoutine(input.value);
  input.value = "";
});

for (const s of SUGGESTIONS) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.textContent = s;
  chip.onclick = () => addRoutine(s);
  $("chips").append(chip);
}

// Backup: export / import as JSON
$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(routines, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `routines-${today}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const valid =
      Array.isArray(data) &&
      data.every((r) => r && typeof r.name === "string" && Array.isArray(r.done));
    if (!valid) throw new Error();
    if (!confirm(`Replace your current routines with ${data.length} from this file?`)) return;
    routines = data.map((r) => ({ id: r.id || crypto.randomUUID(), name: r.name, done: r.done }));
    save();
    render();
  } catch {
    alert("That file doesn't look like a routines backup.");
  }
});

// Roll over to the new day when the app comes back into view.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  const now = dayKey(new Date());
  if (now !== today) {
    if (selected === today) selected = now;
    today = now;
  }
  render({ animateList: false });
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
