const STORAGE_KEY = "routines-v1";

const list = document.getElementById("list");
const form = document.getElementById("add-form");
const input = document.getElementById("add-input");
const empty = document.getElementById("empty");
const progress = document.getElementById("progress");

// Each routine: { id, name, done: ["YYYY-MM-DD", ...] }
let routines = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
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

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

// Consecutive days completed, counting back from today (or yesterday if today isn't done yet).
function streak(routine) {
  const done = new Set(routine.done);
  let n = done.has(daysAgo(0)) ? 0 : 1;
  let count = 0;
  while (done.has(daysAgo(n))) {
    count++;
    n++;
  }
  return count;
}

function toggle(id) {
  const r = routines.find((r) => r.id === id);
  const today = daysAgo(0);
  r.done = r.done.includes(today) ? r.done.filter((d) => d !== today) : [...r.done, today];
  save();
  render();
}

function remove(id) {
  const r = routines.find((r) => r.id === id);
  if (!confirm(`Delete "${r.name}"?`)) return;
  routines = routines.filter((r) => r.id !== id);
  save();
  render();
}

function render() {
  const today = daysAgo(0);
  list.replaceChildren();

  for (const r of routines) {
    const isDone = r.done.includes(today);
    const li = document.createElement("li");
    li.className = isDone ? "done" : "";

    const check = document.createElement("button");
    check.className = "check";
    check.setAttribute("aria-label", isDone ? `Mark ${r.name} not done` : `Mark ${r.name} done`);
    check.onclick = () => toggle(r.id);

    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = r.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    const week = document.createElement("div");
    week.className = "week";
    week.title = "Last 7 days";
    for (let i = 6; i >= 0; i--) {
      const dot = document.createElement("span");
      if (r.done.includes(daysAgo(i))) dot.className = "on";
      week.append(dot);
    }
    const s = streak(r);
    const streakText = document.createElement("span");
    streakText.textContent = s ? `🔥 ${s} day${s === 1 ? "" : "s"}` : "";
    meta.append(week, streakText);
    info.append(name, meta);

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.setAttribute("aria-label", `Delete ${r.name}`);
    del.onclick = () => remove(r.id);

    li.append(check, info, del);
    list.append(li);
  }

  const doneCount = routines.filter((r) => r.done.includes(today)).length;
  empty.hidden = routines.length > 0;
  progress.textContent = routines.length ? `${doneCount} of ${routines.length} done today` : "";
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = input.value.trim();
  if (!name) return;
  routines.push({ id: crypto.randomUUID(), name, done: [] });
  input.value = "";
  save();
  render();
});

document.getElementById("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

// Re-render when the day rolls over or the tab regains focus.
document.addEventListener("visibilitychange", () => !document.hidden && render());

render();
