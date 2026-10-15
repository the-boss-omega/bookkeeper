const STORAGE_KEY = "routines-v1";
const SUGGESTIONS = ["Drink water", "Stretch", "Read 10 pages", "Walk outside", "Journal", "No phone in bed"];
const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5s.5 2 2 2.5C10 8 12 2 12 2z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const DASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10"/></svg>';
const DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
const RING_LENGTH = 2 * Math.PI * 28;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sunday, like Date#getDay

const $ = (id) => document.getElementById(id);
const input = $("add-input");
const sheet = $("sheet");

// Each routine:
// {
//   id, name,
//   days:  [0-6, ...]                         weekdays it repeats on
//   moves: { "YYYY-MM-DD": "YYYY-MM-DD" }     one week's session moved from its usual day to another
//   status: { "YYYY-MM-DD": "done" | "missed" | "skip" }   how each day went; "skip" = not needed
// }
let routines = load();
let today = dayKey(new Date());
let selected = today;
let newDays = [...ALL_DAYS];
let editing = null; // sheet state: { id, days, moveTo }

const WEEK_START = weekStartDay();
const WEEK_ORDER = ALL_DAYS.map((i) => (i + WEEK_START) % 7);

/* ---------- storage ---------- */

function normalize(r) {
  return {
    id: r.id || crypto.randomUUID(),
    name: String(r.name),
    days: Array.isArray(r.days) && r.days.length ? r.days : [...ALL_DAYS],
    moves: r.moves && typeof r.moves === "object" ? r.moves : {},
    status:
      r.status && typeof r.status === "object"
        ? r.status
        : Object.fromEntries((Array.isArray(r.done) ? r.done : []).map((d) => [d, "done"])),
  };
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data.map(normalize) : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
  } catch {}
}

/* ---------- dates ---------- */

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDays(key, n) {
  const date = parseKey(key);
  date.setDate(date.getDate() + n);
  return dayKey(date);
}

const weekday = (key) => parseKey(key).getDay();

// First day of the week from the browser's locale (Sunday in Israel/US, Monday in most of Europe).
function weekStartDay() {
  try {
    const locale = new Intl.Locale(navigator.language);
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch {}
  return 1;
}

function weekOf(key) {
  const start = shiftDays(key, -((weekday(key) - WEEK_START + 7) % 7));
  return ALL_DAYS.map((i) => shiftDays(start, i));
}

function dayName(day, style = "short") {
  // 1 Jan 2023 was a Sunday, so 1 + day gives that weekday.
  return new Date(2023, 0, 1 + day).toLocaleDateString(undefined, { weekday: style });
}

function fmt(key, opts) {
  return parseKey(key).toLocaleDateString(undefined, opts);
}

/* ---------- schedule ---------- */

function occursOn(r, key) {
  if (key in r.moves) return r.moves[key] === key;
  return r.days.includes(weekday(key)) || Object.values(r.moves).includes(key);
}

// Where this occurrence originally came from, if it was moved here.
function movedFrom(r, key) {
  return Object.keys(r.moves).find((from) => r.moves[from] === key && from !== key);
}

const statusOf = (r, key) => r.status[key] || null;

function setStatus(r, key, value) {
  if (value) r.status[key] = value;
  else delete r.status[key];
}

function scheduleText(r) {
  if (r.days.length === 7) return "Every day";
  return WEEK_ORDER.filter((d) => r.days.includes(d)).map((d) => dayName(d)).join(" · ");
}

// Sessions completed in a row, ending today. "Not needed" days are passed over,
// and today doesn't break the streak while it's still open.
function streak(r) {
  let count = 0;
  for (let i = 0; i < 730; i++) {
    const key = shiftDays(today, -i);
    const st = statusOf(r, key);
    if (st === "done") count++;
    else if (st === "skip") continue;
    else if (st === "missed" || (i > 0 && occursOn(r, key))) break;
  }
  return count;
}

// "Not needed" sessions don't count toward the day's total.
function dayStats(key) {
  const scheduled = routines.filter((r) => occursOn(r, key));
  const needed = scheduled.filter((r) => statusOf(r, key) !== "skip");
  return {
    scheduled: scheduled.length,
    total: needed.length,
    done: needed.filter((r) => statusOf(r, key) === "done").length,
    skipped: scheduled.length - needed.length,
  };
}

/* ---------- actions ---------- */

function addRoutine(name, days = ALL_DAYS) {
  name = name.trim();
  if (!name) return;
  routines.push({ id: crypto.randomUUID(), name, days: [...days].sort(), moves: {}, status: {} });
  save();
  render();
}

// Tapping the circle cycles: open → done → not done → not needed → open.
// Future days can only be marked "not needed".
const CYCLE = [null, "done", "missed", "skip"];
const STATUS_LABEL = { done: "Done", missed: "Not done", skip: "Not needed" };

function cycle(id) {
  const r = routines.find((r) => r.id === id);
  const order = selected > today ? [null, "skip"] : CYCLE;
  const next = order[(order.indexOf(statusOf(r, selected)) + 1) % order.length];
  setStatus(r, selected, next);
  save();
  render({ animateList: false });
}

// Move the occurrence on `from` (this week only) to `to`.
function moveOccurrence(r, from, to) {
  if (from === to) return;
  const origin = movedFrom(r, from) ?? from;
  if (r.days.includes(weekday(origin)) && origin === to) delete r.moves[origin];
  else r.moves[origin] = to;
  // The day's status moves with the session, except done/not done can't land in the future.
  const st = statusOf(r, from);
  setStatus(r, from, null);
  if (st && (to <= today || st === "skip")) setStatus(r, to, st);
}

/* ---------- rendering ---------- */

function greeting() {
  if (selected === today) {
    const h = new Date().getHours();
    return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }
  if (selected === shiftDays(today, -1)) return "Yesterday";
  if (selected === shiftDays(today, 1)) return "Tomorrow";
  return fmt(selected, { weekday: "long" });
}

function renderHeader() {
  $("date").textContent = fmt(selected, { weekday: "long", month: "long", day: "numeric" });
  $("title").textContent = greeting();

  const { total, done, scheduled, skipped } = dayStats(selected);
  const fraction = total ? done / total : 0;
  $("ring-fill").style.strokeDashoffset = RING_LENGTH * (1 - fraction);
  $("ring").classList.toggle("zero", done === 0);
  $("ring-label").textContent = total ? `${done}/${total}` : "–";
  $("ring").setAttribute("aria-label", `${done} of ${total} routines done`);

  let status = "";
  if (routines.length && !scheduled) status = "Nothing scheduled. Enjoy the rest.";
  else if (!total && skipped) status = "Nothing needed this day.";
  else if (selected > today) status = `${total} planned`;
  else if (done === total) status = selected === today ? "All done for today. Nicely done ✦" : "Everything was done this day ✦";
  else status = `${total - done} to go`;
  if (status && skipped && total) status += ` · ${skipped} not needed`;
  $("status").textContent = status;
}

function renderWeek() {
  const days = weekOf(selected);
  const thisWeek = weekOf(today)[0];
  const diff = Math.round((parseKey(days[0]) - parseKey(thisWeek)) / 864e5 / 7);
  $("week-label").textContent =
    diff === 0 ? "This week" : diff === -1 ? "Last week" : diff === 1 ? "Next week"
    : `${fmt(days[0], { month: "short", day: "numeric" })} – ${fmt(days[6], { month: "short", day: "numeric" })}`;
  $("today-btn").hidden = selected === today;

  const week = $("week");
  week.replaceChildren();
  for (const key of days) {
    const { total, done } = dayStats(key);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day" + (key === selected ? " selected" : "") + (key === today ? " today" : "");
    btn.setAttribute("aria-pressed", key === selected);
    btn.setAttribute("aria-label", fmt(key, { weekday: "long", month: "long", day: "numeric" }));
    const dot = !total ? "none" : done === total ? "full" : done ? "part" : "";
    btn.innerHTML = `
      <span class="day-letter">${fmt(key, { weekday: "narrow" })}</span>
      <span class="day-num">${parseKey(key).getDate()}</span>
      <span class="day-dot ${dot}"></span>`;
    btn.onclick = () => select(key);
    week.append(btn);
  }
}

function routineRow(r, i, animate, scheduled) {
  const st = scheduled ? statusOf(r, selected) : null;
  const li = document.createElement("li");
  li.className = "item" + (st ? ` ${st}` : "") + (scheduled ? "" : " off");
  if (animate) li.style.setProperty("--i", i);
  else li.style.animation = "none";

  if (scheduled) {
    const check = document.createElement("button");
    check.className = "check";
    check.innerHTML = st === "missed" ? CROSS : st === "skip" ? DASH : CHECK;
    check.setAttribute("aria-label", `${r.name}: ${STATUS_LABEL[st] || "open"}. Tap to change.`);
    check.title = STATUS_LABEL[st] || "Tap to mark";
    check.onclick = () => cycle(r.id);
    li.append(check);
  }

  const info = document.createElement("div");
  info.className = "info";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = r.name;
  const sub = document.createElement("span");
  sub.className = "sub";
  const from = scheduled && movedFrom(r, selected);
  const notes = [];
  if (st === "missed" || st === "skip") notes.push(STATUS_LABEL[st]);
  if (from) notes.push(`Moved from ${fmt(from, { weekday: "long" })}`);
  else if (r.days.length < 7) notes.push(scheduleText(r));
  sub.textContent = notes.join(" · ");
  if (from) sub.classList.add("moved");
  info.append(name);
  if (sub.textContent) info.append(sub);
  li.append(info);

  const s = streak(r);
  if (s > 0 && scheduled) {
    const el = document.createElement("span");
    el.className = "streak" + (s >= 3 ? " hot" : "");
    el.title = `${s} in a row`;
    el.innerHTML = FLAME + s;
    li.append(el);
  }

  const more = document.createElement("button");
  more.className = "more";
  more.innerHTML = DOTS;
  more.setAttribute("aria-label", `Edit ${r.name}`);
  more.onclick = () => openSheet(r.id);
  li.append(more);
  return li;
}

function renderList(animate) {
  const scheduled = routines.filter((r) => occursOn(r, selected));
  const others = routines.filter((r) => !occursOn(r, selected));

  $("list").replaceChildren(...scheduled.map((r, i) => routineRow(r, i, animate, true)));
  $("others").replaceChildren(...others.map((r, i) => routineRow(r, i + scheduled.length, animate, false)));
  $("others-wrap").hidden = !others.length;
  $("empty").hidden = routines.length > 0;
}

function render({ animateList = true } = {}) {
  renderHeader();
  renderWeek();
  renderList(animateList);
}

function select(key) {
  selected = key;
  render();
}

/* ---------- day pickers ---------- */

function dayPicker(container, { isOn, onToggle, label = (d) => dayName(d), isDisabled = () => false }) {
  container.replaceChildren();
  for (const d of WEEK_ORDER) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label(d);
    b.disabled = isDisabled(d);
    b.setAttribute("aria-pressed", isOn(d));
    b.onclick = () => {
      onToggle(d);
      dayPicker(container, { isOn, onToggle, label, isDisabled });
    };
    container.append(b);
  }
}

function toggleIn(list, d) {
  if (!list.includes(d)) return [...list, d];
  return list.length > 1 ? list.filter((x) => x !== d) : list; // keep at least one day
}

/* ---------- composer ---------- */

const form = $("add-form");

function renderNewDays() {
  dayPicker($("add-days"), { isOn: (d) => newDays.includes(d), onToggle: (d) => (newDays = toggleIn(newDays, d)) });
}

function syncComposer() {
  form.classList.toggle("open", form.contains(document.activeElement) || input.value.trim() !== "");
}
form.addEventListener("focusin", syncComposer);
form.addEventListener("focusout", () => setTimeout(syncComposer));
input.addEventListener("input", syncComposer);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addRoutine(input.value, newDays);
  input.value = "";
  newDays = [...ALL_DAYS];
  renderNewDays();
  input.focus();
});

for (const s of SUGGESTIONS) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.textContent = s;
  chip.onclick = () => addRoutine(s);
  $("chips").append(chip);
}

/* ---------- edit sheet ---------- */

function openSheet(id) {
  const r = routines.find((r) => r.id === id);
  const occurs = occursOn(r, selected);
  editing = { id, days: [...r.days], moveTo: selected, status: statusOf(r, selected) };
  $("sheet-name").value = r.name;

  dayPicker($("sheet-days"), {
    isOn: (d) => editing.days.includes(d),
    onToggle: (d) => (editing.days = toggleIn(editing.days, d)),
  });

  $("status-section").hidden = !occurs;
  if (occurs) {
    $("status-label").textContent = selected === today ? "Today" : fmt(selected, { weekday: "long", month: "short", day: "numeric" });
    renderStatusPicker();
  }

  const week = weekOf(selected);
  const keyFor = (d) => week.find((k) => weekday(k) === d);
  const canMove = occurs && week.some((k) => !occursOn(r, k));
  $("move-section").hidden = !canMove;
  if (canMove) {
    const from = movedFrom(r, selected);
    $("move-label").textContent =
      `Move ${selected === today ? "today's" : fmt(selected, { weekday: "long" }) + "'s"} session`;
    $("move-hint").textContent = from
      ? `Moved here from ${fmt(from, { weekday: "long" })}. Only this week changes.`
      : "Only this week changes. Your usual schedule stays the same.";

    dayPicker($("move-days"), {
      isOn: (d) => keyFor(d) === editing.moveTo,
      onToggle: (d) => (editing.moveTo = keyFor(d)),
      label: (d) => `${dayName(d)} ${parseKey(keyFor(d)).getDate()}`,
      // Can't move onto a day that already has this routine.
      isDisabled: (d) => keyFor(d) !== selected && occursOn(r, keyFor(d)),
    });
  }

  sheet.showModal();
}

function renderStatusPicker() {
  const box = $("status-pick");
  box.replaceChildren();
  for (const value of ["done", "missed", "skip"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = value;
    b.textContent = STATUS_LABEL[value];
    b.disabled = selected > today && value !== "skip";
    b.setAttribute("aria-pressed", editing.status === value);
    b.onclick = () => {
      editing.status = editing.status === value ? null : value; // tap again to clear
      renderStatusPicker();
    };
    box.append(b);
  }
}

$("sheet-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const r = routines.find((r) => r.id === editing.id);
  r.name = $("sheet-name").value.trim() || r.name;

  if (occursOn(r, selected)) setStatus(r, selected, editing.status);
  if (editing.moveTo !== selected) moveOccurrence(r, selected, editing.moveTo);

  const daysChanged = editing.days.join() !== [...r.days].sort().join();
  if (daysChanged) {
    r.days = [...editing.days].sort();
    // Upcoming one-off moves from days no longer in the schedule don't make sense any more.
    for (const from of Object.keys(r.moves)) {
      if (from >= today && !r.days.includes(weekday(from))) delete r.moves[from];
    }
  }

  save();
  sheet.close();
  render({ animateList: false });
});

$("sheet-cancel").addEventListener("click", () => sheet.close());

$("sheet-delete").addEventListener("click", () => {
  const r = routines.find((r) => r.id === editing.id);
  if (!confirm(`Delete “${r.name}”? Its history will be removed too.`)) return;
  routines = routines.filter((x) => x.id !== r.id);
  save();
  sheet.close();
  render({ animateList: false });
});

// Close when tapping the backdrop.
sheet.addEventListener("click", (e) => {
  if (e.target === sheet) sheet.close();
});

/* ---------- week navigation ---------- */

$("prev-week").addEventListener("click", () => select(shiftDays(selected, -7)));
$("next-week").addEventListener("click", () => select(shiftDays(selected, 7)));
$("today-btn").addEventListener("click", () => select(today));

/* ---------- backup ---------- */

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
    const valid = Array.isArray(data) && data.every((r) => r && typeof r.name === "string" && (Array.isArray(r.done) || typeof r.status === "object"));
    if (!valid) throw new Error();
    if (!confirm(`Replace your current routines with ${data.length} from this file?`)) return;
    routines = data.map(normalize);
    save();
    render();
  } catch {
    alert("That file doesn't look like a routines backup.");
  }
});

/* ---------- lifecycle ---------- */

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

renderNewDays();
render();
