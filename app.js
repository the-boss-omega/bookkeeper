const STORAGE_KEY = "routines-v1";
const SETTINGS_KEY = "routines-settings";
const DELETED_KEY = "routines-deleted";
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sunday, like Date#getDay
const RING_LENGTH = 2 * Math.PI * 27;

const COLORS = ["#34C759", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#FF3B30", "#FF9500", "#FFCC00", "#30B0C7", "#00C7BE", "#A2845E", "#8E8E93"];
const EMOJIS = [
  "✨", "💧", "🏃", "🏋️", "🧘", "🚶", "🚴", "🏊", "📚", "📖", "📓", "✍️", "💻", "🎹", "🎸", "🎨",
  "🧠", "🗣️", "🙏", "😴", "⏰", "🪥", "🧴", "💊", "🥗", "🍎", "🥤", "☕", "🍳", "🧹", "🧺", "🪴",
  "🐕", "💰", "📵", "📞", "❤️", "🌞", "🎯", "✅",
];
// First match wins, so more specific phrases come first.
const KEYWORDS = [
  [/plant|garden/i, "🪴"], [/water|drink|hydrat/i, "💧"], [/run|jog/i, "🏃"],
  [/gym|workout|lift|train|exercise|push.?up/i, "🏋️"], [/meditat|yoga|breath|mindful/i, "🧘"],
  [/walk|steps|hike/i, "🚶"], [/bike|cycl/i, "🚴"], [/swim/i, "🏊"], [/read|book/i, "📚"],
  [/study|learn|course|homework/i, "📖"], [/journal|diary|gratitude/i, "📓"], [/write|blog/i, "✍️"],
  [/code|program/i, "💻"], [/piano/i, "🎹"], [/guitar|music/i, "🎸"], [/draw|paint|art|sketch/i, "🎨"],
  [/language|spanish|english|french|hebrew|arabic|duolingo/i, "🗣️"], [/pray/i, "🙏"],
  [/sleep|bed|nap/i, "😴"], [/wake|alarm|early/i, "⏰"], [/teeth|floss|brush/i, "🪥"],
  [/skin|cream|sunscreen/i, "🧴"], [/vitamin|pill|medic/i, "💊"], [/salad|veg|healthy|diet/i, "🥗"],
  [/fruit|apple/i, "🍎"], [/coffee|tea/i, "☕"], [/cook|breakfast|lunch|dinner|meal/i, "🍳"],
  [/clean|tidy|dishes/i, "🧹"], [/laundry/i, "🧺"], [/dog|cat|pet/i, "🐕"],
  [/money|budget|sav|invest/i, "💰"], [/phone|screen|social/i, "📵"], [/call|mom|dad|family|friend/i, "📞"],
  [/stretch/i, "🤸"], [/focus|goal|plan/i, "🎯"],
];
const TIMES = [
  { value: "morning", label: "Morning", emoji: "🌅" },
  { value: "afternoon", label: "Afternoon", emoji: "☀️" },
  { value: "evening", label: "Evening", emoji: "🌙" },
  { value: "anytime", label: "Anytime", emoji: "✨" },
];
const STATUS = {
  done: { label: "Done", emoji: "✅" },
  missed: { label: "Not done", emoji: "❌" },
  skip: { label: "Not needed", emoji: "💤" },
};
const SUGGESTIONS = [
  ["💧", "Drink water"], ["🧘", "Meditate"], ["📚", "Read 10 pages"], ["🚶", "Walk outside"],
  ["📓", "Journal"], ["🏋️", "Workout"], ["💊", "Vitamins"], ["😴", "Sleep by 11"],
];
const CONFETTI = ["🎉", "✨", "🎊", "⭐", "💚", "🔥", "🌟"];
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const DASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10"/></svg>';
const CHEVRON = '<svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5l5 5-5 5"/></svg>';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sheet = $("sheet");

let today = dayKey(new Date());
let selected = today;
let tab = "today";
let range = "week";
let editing = null; // sheet state
let settings = loadSettings();
let WEEK_START = weekStartDay();
let WEEK_ORDER = ALL_DAYS.map((i) => (i + WEEK_START) % 7);

// Each routine:
// {
//   id, name, emoji, color,
//   time:    "morning" | "afternoon" | "evening" | "anytime"
//   days:    [0-6, ...]                                       weekdays it repeats on
//   moves:   { "YYYY-MM-DD": "YYYY-MM-DD" }                    one week's session moved to another day
//   status:  { "YYYY-MM-DD": "done" | "missed" | "skip" }      how each day went; "skip" = not needed
//   created: "YYYY-MM-DD"
// }
let routines = load();

/* ---------- storage ---------- */

function suggestEmoji(name) {
  return KEYWORDS.find(([re]) => re.test(name))?.[1] ?? "✨";
}

function normalize(r, i = 0) {
  const status =
    r.status && typeof r.status === "object"
      ? r.status
      : Object.fromEntries((Array.isArray(r.done) ? r.done : []).map((d) => [d, "done"]));
  const first = Object.keys(status).sort()[0];
  return {
    id: r.id || crypto.randomUUID(),
    name: String(r.name),
    emoji: r.emoji || suggestEmoji(String(r.name)),
    color: r.color || COLORS[i % COLORS.length],
    time: TIMES.some((t) => t.value === r.time) ? r.time : "anytime",
    days: Array.isArray(r.days) && r.days.length ? r.days : [...ALL_DAYS],
    moves: r.moves && typeof r.moves === "object" ? r.moves : {},
    status,
    created: r.created || (first && first < today ? first : today),
    // For syncing: when the routine's details last changed, and when each day's status was set.
    updatedAt: Number(r.updatedAt) || 0,
    stamps: r.stamps && typeof r.stamps === "object" ? r.stamps : {},
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

// Deleted routine ids → when they were deleted, so a delete on one device reaches the others.
let deleted = loadDeleted();

function loadDeleted() {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY)) || {};
  } catch {
    return {};
  }
}

function save({ sync = true } = {}) {
  startCache.clear();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
    localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
  } catch {}
  if (sync) window.RoutinesSync?.push();
}

function loadSettings() {
  const defaults = { theme: "system", weekStart: "auto", confetti: true, haptics: true, updatedAt: 0 };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return defaults;
  }
}

function saveSettings({ sync = true } = {}) {
  if (sync) settings.updatedAt = Date.now();
  if (sync) window.RoutinesSync?.push();
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

function* daysFrom(from, to) {
  for (let key = from; key <= to; key = shiftDays(key, 1)) yield key;
}

const weekday = (key) => parseKey(key).getDay();
const fmt = (key, opts) => parseKey(key).toLocaleDateString(undefined, opts);
// 1 Jan 2023 was a Sunday, so 1 + day gives that weekday.
const dayName = (day, style = "short") => new Date(2023, 0, 1 + day).toLocaleDateString(undefined, { weekday: style });

function localeWeekInfo() {
  try {
    const locale = new Intl.Locale(navigator.language);
    return locale.getWeekInfo?.() ?? locale.weekInfo ?? null;
  } catch {
    return null;
  }
}

// First day of the week: the user's choice, else the locale's (Sunday in Israel/US, Monday in most of Europe).
function weekStartDay() {
  if (settings.weekStart === "sun") return 0;
  if (settings.weekStart === "mon") return 1;
  const firstDay = localeWeekInfo()?.firstDay;
  if (firstDay) return firstDay % 7;
  // Some browsers (e.g. older iPhone Safari) don't report it; fall back by region.
  const region = (navigator.language.split("-")[1] || "").toUpperCase();
  const sundayFirst = ["IL", "US", "CA", "MX", "BR", "JP", "KR", "TW", "HK", "IN", "PH", "ZA", "SA", "AU", "AR", "CO", "PE", "VE", "GT", "PR", "PA", "DO", "SV", "HN", "NI", "BZ", "JM", "TT", "BS", "BW", "ZW", "KE", "ET", "PK", "TH", "KH", "LA", "MM", "MO", "ID", "SG", "NP", "BT", "BD", "YE", "MT", "WS", "UM", "VI", "GU", "AS", "MH", "PY"];
  if (sundayFirst.includes(region)) return 0;
  // No region, but a Hebrew/English-US style language: Sunday is the safer default.
  if (!region && ["he", "iw", "en", "ja", "ko", "pt", "ar"].includes(navigator.language.split("-")[0])) return 0;
  return 1;
}

function weekendDays() {
  const weekend = localeWeekInfo()?.weekend;
  return weekend?.length ? weekend.map((d) => d % 7) : [0, 6];
}

function weekOf(key) {
  const start = shiftDays(key, -((weekday(key) - WEEK_START + 7) % 7));
  return ALL_DAYS.map((i) => shiftDays(start, i));
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
  r.stamps[key] = Date.now();
}

function scheduleText(days) {
  const sorted = [...days].sort().join();
  if (days.length === 7) return "Every day";
  const weekend = weekendDays();
  if (sorted === [...weekend].sort().join()) return "Weekends";
  if (sorted === ALL_DAYS.filter((d) => !weekend.includes(d)).join()) return "Weekdays";
  return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => dayName(d)).join(" · ");
}

// When a routine's history starts: its creation, or the earliest day logged for it.
const startCache = new Map();
function startOf(r) {
  if (!startCache.has(r)) {
    const first = Object.keys(r.status).sort()[0];
    startCache.set(r, first && first < r.created ? first : r.created);
  }
  return startCache.get(r);
}

// How a scheduled day went, as used by statistics. Past days left blank count as not done.
function outcome(r, key, start = startOf(r)) {
  if (key > today || key < start || !occursOn(r, key)) return null;
  return statusOf(r, key) || (key === today ? "open" : "missed");
}

// Sessions done in a row, ending today. "Not needed" days are passed over,
// and today doesn't break the streak while it's still open.
function streak(r) {
  const start = startOf(r);
  let count = 0;
  for (let key = today; key >= start; key = shiftDays(key, -1)) {
    const o = outcome(r, key, start);
    if (o === "done") count++;
    else if (o === "missed") break;
  }
  return count;
}

function bestStreak(r) {
  const start = startOf(r);
  let best = 0;
  let run = 0;
  for (const key of daysFrom(start, today)) {
    const o = outcome(r, key, start);
    if (o === "done") best = Math.max(best, ++run);
    else if (o === "missed") run = 0;
  }
  return best;
}

// Done vs. needed sessions between two dates, for the given routines.
function tally(from, to, list = routines) {
  let done = 0;
  let needed = 0;
  for (const r of list) {
    const start = startOf(r);
    for (const key of daysFrom(from < start ? start : from, to)) {
      const o = outcome(r, key, start);
      if (o === "done") done++, needed++;
      else if (o === "missed") needed++;
    }
  }
  return { done, needed, rate: needed ? done / needed : null };
}

// "perfect" = everything needed was done; "none" = nothing needed; "open" = today, still in progress.
function dayResult(key) {
  let done = 0, missed = 0, open = 0;
  for (const r of routines) {
    const o = outcome(r, key);
    if (o === "done") done++;
    else if (o === "missed") missed++;
    else if (o === "open") open++;
  }
  if (missed) return "broken";
  if (open) return "open";
  return done ? "perfect" : "none";
}

function perfectStreaks() {
  if (!routines.length) return { current: 0, best: 0 };
  const start = routines.map(startOf).sort()[0];
  let best = 0, run = 0, current = 0;
  for (let key = today; key >= start; key = shiftDays(key, -1)) {
    const res = dayResult(key);
    if (res === "perfect") current++;
    else if (res === "broken") break;
  }
  for (const key of daysFrom(start, today)) {
    const res = dayResult(key);
    if (res === "perfect") best = Math.max(best, ++run);
    else if (res === "broken") run = 0;
  }
  return { current, best: Math.max(best, current) };
}

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

// Tapping the circle cycles: open → done → not done → not needed → open.
// Future days can only be marked "not needed".
function cycle(id) {
  const r = routines.find((r) => r.id === id);
  const order = selected > today ? [null, "skip"] : [null, "done", "missed", "skip"];
  const before = dayStats(selected);
  const next = order[(order.indexOf(statusOf(r, selected)) + 1) % order.length];
  setStatus(r, selected, next);
  save();
  haptic(next === "done" ? 15 : 8);
  renderToday(false);

  const after = dayStats(selected);
  if (selected === today && after.total && after.done === after.total && before.done < before.total) celebrate();
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

function addRoutine(fields) {
  routines.push(normalize({ ...fields, id: crypto.randomUUID(), created: today, status: {}, moves: {}, updatedAt: Date.now() }, routines.length));
  save();
}

function removeRoutine(id) {
  const index = routines.findIndex((r) => r.id === id);
  const [removed] = routines.splice(index, 1);
  deleted[id] = Date.now();
  save();
  renderAll();
  toast(`Deleted ${removed.emoji} ${removed.name}`, "Undo", () => {
    removed.updatedAt = Date.now(); // newer than the delete, so it wins when syncing
    routines.splice(index, 0, removed);
    save();
    renderAll();
  });
}

/* ---------- feedback ---------- */

function haptic(ms) {
  if (settings.haptics) navigator.vibrate?.(ms);
}

function celebrate() {
  if (!settings.confetti) return;
  haptic([20, 40, 20]);
  const box = $("confetti");
  for (let i = 0; i < 36; i++) {
    const s = document.createElement("span");
    s.textContent = CONFETTI[i % CONFETTI.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.setProperty("--s", `${18 + Math.random() * 18}px`);
    s.style.setProperty("--d", `${1.4 + Math.random() * 1.2}s`);
    s.style.setProperty("--delay", `${Math.random() * 0.4}s`);
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    s.style.setProperty("--r", `${(Math.random() - 0.5) * 720}deg`);
    box.append(s);
  }
  setTimeout(() => box.replaceChildren(), 3000);
}

let toastTimer;
function toast(message, action, onAction) {
  const el = $("toast");
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
  el.hidden = false;
  if (action) {
    el.querySelector("button").onclick = () => {
      el.hidden = true;
      onAction();
    };
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4000);
}

/* ---------- shared UI ---------- */

function segmented(container, options, current, onChange) {
  container.innerHTML = options
    .map(
      (o) =>
        `<button type="button" class="${o.value ?? ""}" data-value="${o.value}" aria-pressed="${o.value === current}" ${o.disabled ? "disabled" : ""}>${o.label}</button>`
    )
    .join("");
  container.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    onChange(b.dataset.value);
  };
}

function dayPicker(container, { isOn, onToggle, label = (d) => dayName(d), isDisabled = () => false }) {
  container.innerHTML = WEEK_ORDER.map(
    (d) => `<button type="button" data-day="${d}" aria-pressed="${isOn(d)}" ${isDisabled(d) ? "disabled" : ""}>${label(d)}</button>`
  ).join("");
  container.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    onToggle(Number(b.dataset.day));
    dayPicker(container, { isOn, onToggle, label, isDisabled });
  };
}

function toggleIn(list, d) {
  if (!list.includes(d)) return [...list, d];
  return list.length > 1 ? list.filter((x) => x !== d) : list; // keep at least one day
}

const pctText = (rate) => (rate == null ? "–" : `${Math.round(rate * 100)}%`);

function heatmapCells(weeks, level) {
  const start = shiftDays(weekOf(today)[0], -7 * (weeks - 1));
  let html = "";
  for (let i = 0; i < weeks * 7; i++) {
    const key = shiftDays(start, i);
    const cls = key > today ? "future" : level(key);
    html += `<i class="${cls}${key === today ? " today" : ""}" title="${fmt(key, { month: "short", day: "numeric" })}"></i>`;
  }
  return html;
}

/* ---------- Today tab ---------- */

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night 😴";
  if (h < 12) return "Good morning ☀️";
  if (h < 18) return "Good afternoon 🌤️";
  return "Good evening 🌙";
}

function dayTitle(key) {
  if (key === today) return "Today";
  if (key === shiftDays(today, -1)) return "Yesterday";
  if (key === shiftDays(today, 1)) return "Tomorrow";
  return fmt(key, { weekday: "long" });
}

function renderHeader() {
  $("date").textContent = fmt(selected, { weekday: "long", month: "long", day: "numeric" });
  $("title").textContent = dayTitle(selected);
  $("greet").textContent = selected === today ? greeting() : selected < today ? "Looking back 🔙" : "Planning ahead 🗓️";

  const { total, done, scheduled, skipped } = dayStats(selected);
  $("ring-fill").style.strokeDashoffset = RING_LENGTH * (1 - (total ? done / total : 0));
  $("ring").classList.toggle("zero", done === 0);
  $("ring-label").textContent = total ? `${Math.round((done / total) * 100)}%` : "–";
  $("ring").setAttribute("aria-label", `${done} of ${total} routines done`);

  let big, sub;
  if (!routines.length) [big, sub] = ["No routines yet", "Add your first one below 👇"];
  else if (!scheduled) [big, sub] = ["Rest day 🌴", "Nothing scheduled. Enjoy it!"];
  else if (!total) [big, sub] = ["Nothing needed 💤", "Everything is marked not needed"];
  else if (selected > today) [big, sub] = [`${total} planned 🗓️`, "Mark sessions not needed ahead of time"];
  else if (done === total) [big, sub] = ["All done! 🎉", selected === today ? "Amazing work today" : "Everything was done this day"];
  else [big, sub] = [`${done} of ${total} done`, `${total - done} to go 💪`];
  if (skipped && total) sub += ` · ${skipped} not needed`;
  $("sum-big").textContent = big;
  $("sum-sub").textContent = sub;

  const { current } = perfectStreaks();
  $("sum-streak").textContent = routines.length ? (current ? `🔥 ${current}-day perfect streak` : "✨ Finish everything to start a streak") : "";
}

function renderWeek() {
  const days = weekOf(selected);
  const diff = Math.round((parseKey(days[0]) - parseKey(weekOf(today)[0])) / 864e5 / 7);
  $("week-label").textContent =
    diff === 0 ? "This week" : diff === -1 ? "Last week" : diff === 1 ? "Next week"
    : `${fmt(days[0], { month: "short", day: "numeric" })} – ${fmt(days[6], { month: "short", day: "numeric" })}`;

  $("week").innerHTML = days
    .map((key) => {
      const { total, done } = dayStats(key);
      const dot = !total || key > today ? "none" : done === total ? "full" : done ? "part" : "";
      return `<button type="button" class="day${key === selected ? " selected" : ""}${key === today ? " today" : ""}"
        data-key="${key}" aria-pressed="${key === selected}" aria-label="${fmt(key, { weekday: "long", month: "long", day: "numeric" })}">
        <span class="day-letter">${fmt(key, { weekday: "narrow" })}</span>
        <span class="day-num">${parseKey(key).getDate()}</span>
        <span class="day-dot ${dot}"></span>
      </button>`;
    })
    .join("");
}

function rowHTML(r, i, scheduled) {
  const st = scheduled ? statusOf(r, selected) : null;
  const from = scheduled ? movedFrom(r, selected) : null;
  let sub = "";
  let subClass = "";
  if (st === "missed") [sub, subClass] = ["❌ Not done", "missed"];
  else if (st === "skip") sub = "💤 Not needed";
  else if (from) [sub, subClass] = [`↪︎ Moved from ${fmt(from, { weekday: "long" })}`, "moved"];
  else if (r.days.length < 7) sub = scheduleText(r.days);
  const s = scheduled ? streak(r) : 0;
  const icon = st === "missed" ? CROSS : st === "skip" ? DASH : CHECK;

  return `<div class="row ${st ?? ""} ${scheduled ? "" : "off"}" data-open="${r.id}" style="--c:${r.color};--i:${i}" role="button" tabindex="0" aria-label="Open ${esc(r.name)}">
    ${scheduled ? `<button type="button" class="check" data-check="${r.id}" aria-label="${esc(r.name)}: ${st ? STATUS[st].label : "open"}. Tap to change.">${icon}</button>` : ""}
    <span class="tile">${r.emoji}</span>
    <span class="info"><span class="name">${esc(r.name)}</span>${sub ? `<span class="sub ${subClass}">${esc(sub)}</span>` : ""}</span>
    ${s ? `<span class="streak">🔥 ${s}</span>` : ""}
    ${CHEVRON}
  </div>`;
}

function renderList(animate) {
  const scheduled = routines.filter((r) => occursOn(r, selected));
  const others = routines.filter((r) => !occursOn(r, selected));
  const groups = TIMES.map((t) => ({ ...t, items: scheduled.filter((r) => r.time === t.value) })).filter((g) => g.items.length);
  const showTitles = groups.length > 1 || (groups[0] && groups[0].value !== "anytime");

  let i = 0;
  $("groups").innerHTML = groups
    .map(
      (g) => `${showTitles ? `<p class="group-title">${g.emoji} ${g.label}</p>` : '<div style="height:20px"></div>'}
        <div class="group">${g.items.map((r) => rowHTML(r, i++, true)).join("")}</div>`
    )
    .join("");
  $("groups").classList.toggle("no-anim", !animate);
  $("others").innerHTML = others.map((r) => rowHTML(r, i++, false)).join("");
  $("others").classList.toggle("no-anim", !animate);
  $("others-wrap").hidden = !others.length;
  $("empty").hidden = routines.length > 0;
}

function renderToday(animate = true) {
  renderHeader();
  renderWeek();
  renderList(animate);
  updateNav();
}

function select(key) {
  selected = key;
  renderToday();
}

/* ---------- Stats tab ---------- */

function renderStats() {
  const hasData = routines.length > 0;
  $("stats-content").hidden = !hasData;
  $("stats-empty").hidden = hasData;
  if (!hasData) return;

  const perfect = perfectStreaks();
  const month = tally(shiftDays(today, -29), today);
  const week = tally(shiftDays(today, -6), today);
  const totalDone = routines.reduce((n, r) => n + Object.values(r.status).filter((s) => s === "done").length, 0);
  const champion = routines.map((r) => ({ r, best: bestStreak(r) })).sort((a, b) => b.best - a.best)[0];

  $("tiles").innerHTML = [
    ["🔥", perfect.current, "days", "Perfect streak", `Best: ${perfect.best} days`],
    ["✅", totalDone, "", "Completed", `${week.done} this week`],
    ["📈", month.rate == null ? "–" : Math.round(month.rate * 100), month.rate == null ? "" : "%", "Last 30 days", `${month.done} of ${month.needed} sessions`],
    ["🏆", champion.best, "days", "Best streak", champion.best ? `${champion.r.emoji} ${champion.r.name}` : "Keep going!"],
  ]
    .map(
      ([emoji, value, unit, label, sub]) => `<div class="tile-card">
        <span class="t-emoji">${emoji}</span>
        <b>${value}${unit ? `<small>${unit}</small>` : ""}</b>
        <span class="t-label">${label}</span>
        <span class="t-sub">${esc(sub)}</span>
      </div>`
    )
    .join("");

  renderChart();
  $("heatmap").innerHTML = heatmapCells(17, (key) => {
    const { rate } = tally(key, key);
    if (rate == null) return "";
    return rate === 0 ? "l0" : rate < 0.34 ? "l1" : rate < 0.67 ? "l2" : rate < 1 ? "l3" : "l4";
  });
  renderWeekdays();

  $("routine-stats").innerHTML = routines
    .map((r) => {
      const { rate } = tally(shiftDays(today, -29), today, [r]);
      const len = 2 * Math.PI * 17;
      return `<div class="stat-row row" data-open="${r.id}" style="--c:${r.color}" role="button" tabindex="0">
        <span class="tile">${r.emoji}</span>
        <span class="info"><span class="name">${esc(r.name)}</span>
          <span class="sub">🔥 ${streak(r)} now · 🏆 ${bestStreak(r)} best</span></span>
        <span class="pct"><svg viewBox="0 0 42 42" aria-hidden="true"><circle class="track" cx="21" cy="21" r="17"/>
          <circle class="fill" cx="21" cy="21" r="17" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - (rate ?? 0))}"/></svg>
          <span>${pctText(rate)}</span></span>
      </div>`;
    })
    .join("");
}

function renderChart() {
  segmented($("range-seg"), [
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
  ], range, (v) => {
    range = v;
    renderChart();
  });

  let points = [];
  let current, previous;
  if (range === "year") {
    const now = parseKey(today);
    for (let m = 11; m >= 0; m--) {
      const first = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      const to = dayKey(last) > today ? today : dayKey(last);
      points.push({ ...tally(dayKey(first), to), label: first.toLocaleDateString(undefined, { month: "narrow" }), title: first.toLocaleDateString(undefined, { month: "long" }) });
    }
    current = tally(shiftDays(today, -364), today);
  } else {
    const n = range === "week" ? 7 : 30;
    for (let i = n - 1; i >= 0; i--) {
      const key = shiftDays(today, -i);
      const label = n === 7 ? fmt(key, { weekday: "narrow" }) : i % 5 === 0 ? String(parseKey(key).getDate()) : "";
      points.push({ ...tally(key, key), label, title: fmt(key, { weekday: "short", month: "short", day: "numeric" }), key });
    }
    current = tally(shiftDays(today, -(n - 1)), today);
    previous = tally(shiftDays(today, -(2 * n - 1)), shiftDays(today, -n));
  }

  let delta = "";
  if (previous?.rate != null && current.rate != null) {
    const d = Math.round((current.rate - previous.rate) * 100);
    if (d) delta = `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d)}% vs last ${range}</span>`;
  }
  $("chart-summary").innerHTML = `<b>${pctText(current.rate)}</b><span>${current.done} of ${current.needed} done</span>${delta}`;

  const bars = $("bars");
  bars.classList.toggle("dense", range === "month");
  bars.innerHTML = points
    .map(
      (p) => `<div class="bar" title="${esc(p.title)}: ${pctText(p.rate)}">
        ${range === "week" ? `<span class="bar-val">${p.rate == null ? "" : Math.round(p.rate * 100)}</span>` : ""}
        <div class="bar-col"><div class="bar-fill ${p.rate == null ? "empty" : ""} ${p.key === today ? "today" : ""}" style="height:${p.rate == null ? 3 : Math.max(4, p.rate * 100)}%"></div></div>
        <span class="bar-label">${p.label}</span>
      </div>`
    )
    .join("");
}

function renderWeekdays() {
  const from = shiftDays(today, -83);
  const stats = WEEK_ORDER.map((d) => {
    let done = 0, needed = 0;
    for (const key of daysFrom(from, today)) {
      if (weekday(key) !== d) continue;
      const t = tally(key, key);
      done += t.done;
      needed += t.needed;
    }
    return { d, rate: needed ? done / needed : null };
  });
  const rated = stats.filter((s) => s.rate != null);
  const best = rated.length ? rated.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
  const worst = rated.length > 1 ? rated.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

  $("weekday-card").innerHTML = `<div class="weekdays">${stats
    .map(
      (s) => `<div class="wd" title="${dayName(s.d, "long")}: ${pctText(s.rate)}">
        <span class="bar-val">${s.rate == null ? "" : Math.round(s.rate * 100)}</span>
        <div class="bar-col"><div class="bar-fill ${s.rate == null ? "empty" : ""} ${best && s.d === best.d ? "best" : ""}" style="height:${s.rate == null ? 3 : Math.max(4, s.rate * 100)}%"></div></div>
        <span class="bar-label">${dayName(s.d, "narrow")}</span>
      </div>`
    )
    .join("")}</div>
    ${best ? `<p class="wd-note">💪 Best day: <b>${dayName(best.d, "long")}</b>${worst && worst.d !== best.d ? ` · 😅 Toughest: <b>${dayName(worst.d, "long")}</b>` : ""}</p>` : '<p class="wd-note">Check off a few routines to see your best day.</p>'}`;
}

/* ---------- sheet (new / edit routine) ---------- */

function openSheet(id = null) {
  const r = id && routines.find((r) => r.id === id);
  editing = r
    ? { id, emoji: r.emoji, emojiPicked: true, color: r.color, days: [...r.days], time: r.time, status: statusOf(r, selected), moveTo: selected }
    : { id: null, emoji: "✨", emojiPicked: false, color: COLORS[routines.length % COLORS.length], days: [...ALL_DAYS], time: "anytime" };

  $("sheet-title").textContent = r ? "Routine" : "New Routine";
  $("sheet-save").textContent = r ? "Save" : "Add";
  $("f-name").value = r ? r.name : "";
  $("emoji-grid").hidden = true;
  $("delete-group").hidden = !r;
  $("hero").hidden = !r;

  const occurs = r && occursOn(r, selected);
  $("status-section").hidden = !occurs;
  $("move-section").hidden = true;

  if (r) {
    renderHero(r);
    if (occurs) {
      $("status-label").textContent = `${selected === today ? "Today" : fmt(selected, { weekday: "long", month: "short", day: "numeric" })}`;
      renderStatusSeg();
      renderMove(r);
    }
  }
  renderForm();
  sheet.showModal();
  sheet.querySelector(".sheet-body").scrollTop = 0;
  if (!r) setTimeout(() => $("f-name").focus(), 50);
}

function renderHero(r) {
  sheet.style.setProperty("--c", r.color);
  $("hero-emoji").textContent = r.emoji;
  const { rate } = tally(shiftDays(today, -29), today, [r]);
  const total = Object.values(r.status).filter((s) => s === "done").length;
  $("mini-stats").innerHTML = [
    [`🔥 ${streak(r)}`, "Streak"],
    [`🏆 ${bestStreak(r)}`, "Best"],
    [pctText(rate), "30 days"],
    [`✅ ${total}`, "Total"],
  ]
    .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`)
    .join("");
  const start = startOf(r);
  $("mini-heat").innerHTML = heatmapCells(17, (key) => outcome(r, key, start) ?? "");
}

function renderStatusSeg() {
  const future = selected > today;
  segmented(
    $("status-seg"),
    Object.entries(STATUS).map(([value, s]) => ({ value, label: `${s.emoji} ${s.label}`, disabled: future && value !== "skip" })),
    editing.status,
    (v) => {
      editing.status = editing.status === v ? null : v; // tap again to clear
      renderStatusSeg();
    }
  );
}

function renderMove(r) {
  const week = weekOf(selected);
  const keyFor = (d) => week.find((k) => weekday(k) === d);
  if (!week.some((k) => !occursOn(r, k))) return; // nowhere to move to
  const from = movedFrom(r, selected);
  $("move-section").hidden = false;
  $("move-label").textContent = `Move ${selected === today ? "today's" : fmt(selected, { weekday: "long" }) + "'s"} session`;
  $("move-hint").textContent = from
    ? `↪︎ Moved here from ${fmt(from, { weekday: "long" })}. Only this week changes.`
    : "Only this week changes. Your usual schedule stays the same.";
  dayPicker($("move-days"), {
    isOn: (d) => keyFor(d) === editing.moveTo,
    onToggle: (d) => (editing.moveTo = keyFor(d)),
    label: (d) => `${dayName(d)}\n${parseKey(keyFor(d)).getDate()}`,
    // Can't move onto a day that already has this routine.
    isDisabled: (d) => keyFor(d) !== selected && occursOn(r, keyFor(d)),
  });
}

function renderForm() {
  sheet.style.setProperty("--c", editing.color);
  $("emoji-btn").textContent = editing.emoji;

  $("emoji-grid").innerHTML = EMOJIS.map((e) => `<button type="button" aria-pressed="${e === editing.emoji}">${e}</button>`).join("");
  $("colors").innerHTML = COLORS.map(
    (c) => `<button type="button" role="radio" aria-checked="${c === editing.color}" aria-label="Color ${c}" data-color="${c}" style="--sw:${c}"></button>`
  ).join("");

  const weekend = weekendDays();
  const presets = [
    ["Every day", ALL_DAYS],
    ["Weekdays", ALL_DAYS.filter((d) => !weekend.includes(d))],
    ["Weekends", weekend],
  ];
  const current = [...editing.days].sort().join();
  $("presets").innerHTML = presets
    .map(([label, days], i) => `<button type="button" data-preset="${i}" aria-pressed="${[...days].sort().join() === current}">${label}</button>`)
    .join("");
  $("presets").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    editing.days = [...presets[b.dataset.preset][1]];
    renderForm();
  };
  dayPicker($("f-days"), {
    isOn: (d) => editing.days.includes(d),
    onToggle: (d) => {
      editing.days = toggleIn(editing.days, d);
      renderForm();
    },
  });

  segmented($("time-seg"), TIMES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` })), editing.time, (v) => {
    editing.time = v;
    renderForm();
  });
}

$("emoji-btn").addEventListener("click", () => ($("emoji-grid").hidden = !$("emoji-grid").hidden));
$("emoji-grid").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  editing.emoji = b.textContent;
  editing.emojiPicked = true;
  $("emoji-grid").hidden = true;
  renderForm();
});
$("colors").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  editing.color = b.dataset.color;
  renderForm();
});
$("f-name").addEventListener("input", () => {
  if (editing.emojiPicked) return;
  editing.emoji = suggestEmoji($("f-name").value);
  $("emoji-btn").textContent = editing.emoji;
});

$("sheet-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("f-name").value.trim();
  if (!name) return;
  const fields = { name, emoji: editing.emoji, color: editing.color, time: editing.time, days: [...editing.days].sort() };

  if (!editing.id) {
    addRoutine(fields);
    haptic(10);
  } else {
    const r = routines.find((r) => r.id === editing.id);
    const daysChanged = fields.days.join() !== [...r.days].sort().join();
    Object.assign(r, fields, { updatedAt: Date.now() });
    if (!$("status-section").hidden) setStatus(r, selected, editing.status);
    if (editing.moveTo && editing.moveTo !== selected) moveOccurrence(r, selected, editing.moveTo);
    if (daysChanged) {
      // Upcoming one-off moves from days no longer in the schedule don't make sense any more.
      for (const from of Object.keys(r.moves)) {
        if (from >= today && !r.days.includes(weekday(from))) delete r.moves[from];
      }
    }
  }
  save();
  sheet.close();
  renderAll();
});

$("sheet-cancel").addEventListener("click", () => sheet.close());
$("sheet-delete").addEventListener("click", () => {
  const id = editing.id;
  sheet.close();
  removeRoutine(id);
});
sheet.addEventListener("click", (e) => {
  if (e.target === sheet) sheet.close();
});

/* ---------- Settings tab ---------- */

function applyTheme() {
  if (settings.theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = settings.theme;
}

function renderSettings() {
  segmented($("theme-seg"), [
    { value: "system", label: "Auto" },
    { value: "light", label: "☀️ Light" },
    { value: "dark", label: "🌙 Dark" },
  ], settings.theme, (v) => {
    settings.theme = v;
    saveSettings();
    applyTheme();
    renderSettings();
  });
  segmented($("weekstart-seg"), [
    { value: "auto", label: "Auto" },
    { value: "sun", label: "Sunday" },
    { value: "mon", label: "Monday" },
  ], settings.weekStart, (v) => {
    settings.weekStart = v;
    saveSettings();
    WEEK_START = weekStartDay();
    WEEK_ORDER = ALL_DAYS.map((i) => (i + WEEK_START) % 7);
    renderSettings();
  });
  $("set-confetti").checked = settings.confetti;
  $("set-haptics").checked = settings.haptics;
}

$("set-confetti").addEventListener("change", (e) => {
  settings.confetti = e.target.checked;
  saveSettings();
  if (settings.confetti) celebrate();
});
$("set-haptics").addEventListener("change", (e) => {
  settings.haptics = e.target.checked;
  saveSettings();
  haptic(15);
});

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(routines, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `routines-${today}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("📤 Backup downloaded");
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
    const now = Date.now();
    const imported = data.map((r, i) => ({ ...normalize(r, i), updatedAt: now }));
    for (const r of routines) if (!imported.some((x) => x.id === r.id)) deleted[r.id] = now;
    for (const r of imported) delete deleted[r.id];
    routines = imported;
    save();
    renderAll();
    toast(`📥 Imported ${data.length} routines`);
  } catch {
    toast("⚠️ That file isn't a routines backup");
  }
});

$("reset").addEventListener("click", () => {
  if (!routines.length) return toast("Nothing to erase");
  if (!confirm("Erase all routines and their history? This can't be undone.")) return;
  const now = Date.now();
  for (const r of routines) deleted[r.id] = now;
  routines = [];
  save();
  renderAll();
  toast("🗑️ All data erased");
});

/* ---------- navigation ---------- */

function updateNav() {
  const titles = { today: dayTitle(selected), stats: "Statistics", settings: "Settings" };
  $("nav-title").textContent = titles[tab];
  $("add-btn").hidden = tab !== "today";
  $("nav-today").hidden = tab !== "today" || selected === today;
}

function showTab(name) {
  tab = name;
  for (const t of ["today", "stats", "settings"]) $(`tab-${t}`).hidden = t !== name;
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  window.scrollTo(0, 0);
  renderAll();
}

function renderAll() {
  if (tab === "today") renderToday();
  if (tab === "stats") renderStats();
  if (tab === "settings") renderSettings();
  updateNav();
}

document.querySelector(".tabbar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b && b.dataset.tab !== tab) {
    haptic(5);
    showTab(b.dataset.tab);
  }
});

// Row taps: the circle cycles the status, anywhere else opens the routine.
document.querySelector(".app").addEventListener("click", (e) => {
  const check = e.target.closest("[data-check]");
  if (check) return cycle(check.dataset.check);
  const day = e.target.closest("[data-key]");
  if (day) return select(day.dataset.key);
  const row = e.target.closest("[data-open]");
  if (row) openSheet(row.dataset.open);
});
document.querySelector(".app").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-open]")) {
    e.preventDefault();
    openSheet(e.target.dataset.open);
  }
});

$("add-btn").addEventListener("click", () => openSheet());
$("nav-today").addEventListener("click", () => select(today));
$("prev-week").addEventListener("click", () => select(shiftDays(selected, -7)));
$("next-week").addEventListener("click", () => select(shiftDays(selected, 7)));

$("chips").innerHTML = SUGGESTIONS.map(([e, n]) => `<button type="button" data-suggest="${esc(n)}" data-emoji="${e}">${e} ${esc(n)}</button>`).join("");
$("chips").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  addRoutine({ name: b.dataset.suggest, emoji: b.dataset.emoji });
  haptic(10);
  renderToday();
});

window.addEventListener("scroll", () => $("navbar").classList.toggle("scrolled", window.scrollY > 30), { passive: true });

// Roll over to the new day when the app comes back into view.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  const now = dayKey(new Date());
  if (now !== today) {
    if (selected === today) selected = now;
    today = now;
  }
  renderAll();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  // When an updated version takes over, reload once so it shows straight away.
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) {
        reloaded = true;
        location.reload();
      }
    });
  }
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
}

/* ---------- sync hooks (used by sync.js) ---------- */

window.RoutinesApp = {
  getState: () => ({ routines, deleted, settings }),
  // Replace local data with a merged copy from the cloud, without echoing it back.
  setState(next) {
    routines = next.routines.map(normalize);
    deleted = next.deleted;
    const weekChanged = next.settings.weekStart !== settings.weekStart;
    settings = { ...settings, ...next.settings };
    save({ sync: false });
    saveSettings({ sync: false });
    applyTheme();
    if (weekChanged) {
      WEEK_START = weekStartDay();
      WEEK_ORDER = ALL_DAYS.map((i) => (i + WEEK_START) % 7);
    }
    if (!sheet.open) renderAll();
  },
  rerender: () => tab === "settings" && renderSettings(),
};

applyTheme();
renderAll();
