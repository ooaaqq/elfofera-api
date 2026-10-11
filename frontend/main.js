import "@fontsource-variable/inter";
import { createYearLoader } from "./year-data.js";

const members = {
  luzao: "露早",
  yumo: "虞莫",
  waner: "莞儿",
  youen: "柚恩",
  minuo: "米诺",
};
let changes = [];
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
const types = {
  talk: "杂谈",
  singing: "歌回",
  dance: "舞蹈",
  radio: "电台",
  game: "游戏",
  lesson: "练习",
  celebration: "庆典",
  special: "特别节目",
  mixed: "综合",
};
let data = [];
let yearIndex = { months: new Map(), dates: new Map() };
const loadYear = createYearLoader(fetch);
let yearRequest = 0;
let loadingYear = false;
let years = [];
let initialYear;
const state = {
  year: null,
  month: 7,
  member: null,
  eventId: undefined,
};
async function selectYear(year, month = null) {
  const request = ++yearRequest;
  loadingYear = true;
  $("#calendar").setAttribute("aria-busy", "true");
  $("#detail").innerHTML = `<div class="empty">正在加载 ${year} 年…</div>`;
  try {
    const result = await loadYear(year);
    if (!result.current) return;
    data = result.indexed.events;
    yearIndex = result.indexed;
    state.year = year;
    state.month = month;
    state.eventId = undefined;
    render();
  } catch (error) {
    if (request !== yearRequest) return;
    console.error(error);
    $("#detail").innerHTML =
      `<div class="empty">${year} 年数据加载失败，请重新选择年份。</div>`;
  } finally {
    if (request === yearRequest) {
      loadingYear = false;
      $("#calendar").setAttribute("aria-busy", "false");
    }
  }
}
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const names = (ids) =>
  ids
    .map((id) => members[id])
    .filter(Boolean)
    .join(" / ");
const matches = (e) => !state.member || e.members.includes(state.member);
const changeDate = (part, fallback) =>
  `${part?.date?.slice(5) ?? fallback}${part?.plannedTime ? ` ${part.plannedTime}` : ""}`;
function changeText(change) {
  const who = change.members?.map((id) => members[id]).join("/") || "直播";
  if (change.action === "reschedule" && change.from && change.to) {
    const from = changeDate(change.from, "原日期");
    const to = changeDate(change.to, "新日期");
    return `${who} ${from} → ${to}`;
  }
  if (change.action === "cancel" || change.action === "cancellation")
    return `${who} ${change.plannedTime || ""}取消`.trim();
  if (change.action === "format-change")
    return `${who} ${change.fromFormat || "原安排"} → ${change.toFormat || "新安排"}`;
  const labels = {
    "member-absence": `${who} 缺席`,
    "lineup-change": `${who} 阵容调整`,
    "schedule-revision": "周表调整",
  };
  return labels[change.action] || change.title || `${who} 日程调整`;
}
const memberMarks = (events) =>
  [...new Set(events.flatMap((e) => e.members))]
    .map((id) => `<i class="member-mark ${id}"></i>`)
    .join("");
function calendarDays(year, month, events) {
  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const length = new Date(year, month, 0).getDate();
  const cells = Array.from(
    { length: first },
    () => '<span class="blank"></span>',
  );
  const selected = data.find((e) => e.id === state.eventId)?.date;
  const eventsByDate = Map.groupBy(events, (event) => event.date);
  const changesByDate = Map.groupBy(changes, (change) => change.date);
  for (let day = 1; day <= length; day++) {
    const date = `${year}-${pad(month)}-${pad(day)}`,
      sessions = eventsByDate.get(date) ?? [],
      dayChanges = changesByDate.get(date) ?? [];
    cells.push(
      `<div class="day ${sessions.length || dayChanges.length ? "has-live" : "quiet"} ${date === selected ? "selected" : ""}" data-date="${date}" role="group" aria-label="${date}，${sessions.length} 场直播"><span class="day-number">${pad(day)}</span><div class="day-labels">${sessions
        .slice(0, 3)
        .map(
          (event) =>
            `<button type="button" class="event-title ${event.members[0] ?? ""}" data-event="${event.id}" aria-pressed="${event.id === state.eventId}" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</button>`,
        )
        .join(
          "",
        )}</div><div class="day-change-list">${dayChanges.length ? `<button type="button" class="change-indicator" title="${escapeHtml(dayChanges.map(changeText).join("；"))}" aria-label="日程变更：${escapeHtml(dayChanges.map(changeText).join("；"))}">i</button>` : ""}</div><span class="marks">${memberMarks(sessions)}</span></div>`,
    );
  }
  const rows = Math.ceil(cells.length / 7);
  while (cells.length < rows * 7) cells.push('<span class="blank"></span>');
  return `<div class="weekdays">${weekdays.map((d) => `<span>${d}</span>`).join("")}</div><div class="days" style="--weeks:${rows}">${cells.join("")}</div>`;
}
function renderCalendar(events) {
  $("#months").innerHTML = Array.from(
    { length: 12 },
    (_, i) =>
      `<button type="button" data-month="${i + 1}" aria-label="${i + 1} 月" aria-pressed="${i + 1 === state.month}" ${yearIndex.months.has(i + 1) || changes.some((change) => change.date.startsWith(`${state.year}-${pad(i + 1)}`)) ? "" : "disabled"}>${pad(i + 1)}</button>`,
  ).join("");
  $("#calendar").innerHTML = calendarDays(
    Number(state.year),
    state.month,
    events,
  );
}
function trackRow(t, i) {
  const label = {
    dance: "舞蹈",
    instrumental: "演奏",
    "singing-and-dance": "唱跳",
  }[t.type];
  const href = t.bvid
    ? `https://www.bilibili.com/video/${encodeURIComponent(t.bvid)}`
    : `https://search.bilibili.com/all?keyword=${encodeURIComponent(t.title)}`;
  const bvid = t.bvid ? ` · ${escapeHtml(t.bvid)}` : "";
  const kind = label ? ` · ${label}` : "";
  return `<a class="track" href="${href}" target="_blank" rel="noreferrer"><span class="track-index">${pad(i + 1)}</span><span class="track-main"><span class="track-title">${escapeHtml(t.title)}</span><span class="track-meta">${escapeHtml(t.artists.join(" / ") || "原唱未收录")}${bvid}${kind}</span></span><span class="track-members">${escapeHtml(names(t.members) || "成员未收录")}</span></a>`;
}
function renderDetail(events) {
  const e = events.find((x) => x.id === state.eventId);
  if (!e) {
    $("#detail").innerHTML = '<div class="empty">没有匹配的直播</div>';
    return;
  }
  const tags = [
    types[e.contentType],
    e.dimension !== "unknown" && e.dimension.toUpperCase(),
    e.isUnannounced && "突击",
  ].filter(Boolean);
  const recording = e.bvid
    ? `<a class="recording-link" href="https://www.bilibili.com/video/${encodeURIComponent(e.bvid)}" target="_blank" rel="noreferrer">录播 ↗</a>`
    : "";
  const rows = e.tracks.length
    ? e.tracks.map(trackRow).join("")
    : '<p class="no-tracks">暂未收录曲目</p>';
  $("#detail").innerHTML =
    `<div class="session-intro"><div class="date-line"><strong>${e.date.replaceAll("-", ".")}</strong><span>${tags.join(" / ")}</span>${recording}</div><div class="title-line"><h2 title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</h2><span class="title-side"><span class="session-members">${escapeHtml(names(e.members) || "成员未收录")}</span></span></div><div class="session-member-line">${e.members.map((id) => `<i class="${id}"></i>`).join("")}</div></div><div class="track-list">${rows}</div>`;
}
function render() {
  const filtered = data.filter(matches);
  if (state.month === null)
    state.month = Number(filtered.at(-1)?.date.slice(5, 7) || 1);
  const events = (yearIndex.months.get(state.month) ?? []).filter(matches);
  if (state.eventId === undefined) state.eventId = events.at(0)?.id || null;
  $("#year-toggle").textContent = state.year;
  $("#years").innerHTML = years
    .map(
      (y) =>
        `<button type="button" data-year="${y}" aria-pressed="${y === state.year}">${y}</button>`,
    )
    .join("");
  $("#members").innerHTML = Object.entries(members)
    .map(
      ([id, name]) =>
        `<button type="button" class="member-button ${id}" data-member="${id}" aria-label="${name}" aria-pressed="${state.member === id}" title="${name}"></button>`,
    )
    .join("");
  renderCalendar(events);
  renderDetail(events);
}
function setYearsOpen(open) {
  $("#years").hidden = !open;
  $("#year-toggle").setAttribute("aria-expanded", String(open));
}
$("#years").addEventListener("click", (e) => {
  const b = e.target.closest("[data-year]");
  if (!b) return;
  setYearsOpen(false);
  selectYear(b.dataset.year).catch(console.error);
});
$("#year-picker").addEventListener("pointerenter", (e) => {
  if (e.pointerType === "mouse") setYearsOpen(true);
});
$("#year-picker").addEventListener("pointerleave", (e) => {
  if (e.pointerType === "mouse") setYearsOpen(false);
});
$("#year-toggle").addEventListener("click", () => setYearsOpen(true));
$("#members").addEventListener("click", (e) => {
  if (loadingYear) return;
  const b = e.target.closest("[data-member]");
  if (!b) return;
  state.member = state.member === b.dataset.member ? null : b.dataset.member;
  state.eventId = undefined;
  render();
});
$("#months").addEventListener("click", (e) => {
  if (loadingYear) return;
  const b = e.target.closest("[data-month]");
  if (b) {
    state.month = Number(b.dataset.month);
    state.eventId = undefined;
    render();
  }
});
$("#calendar").addEventListener("click", (e) => {
  if (loadingYear) return;
  const b = e.target.closest("[data-event]");
  if (b) state.eventId = b.dataset.event;
  else {
    const d = e.target.closest("[data-date]");
    if (!d) return;
    state.eventId =
      yearIndex.dates.get(d.dataset.date)?.find(matches)?.id || null;
  }
  render();
  $("#panel").classList.add("open");
});
$("#close").addEventListener("click", () =>
  $("#panel").classList.remove("open"),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("#panel").classList.remove("open");
});
async function start() {
  const response = await fetch("/data/manifest.json", {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`加载数据清单失败：${response.status}`);
  const manifest = await response.json();
  years = manifest.years;
  changes = manifest.changes;
  initialYear = years.includes("2022") ? "2022" : years.at(-1);
  $("#year-toggle").textContent = initialYear;
  $("#years").innerHTML = years
    .map((year) => `<button type="button" data-year="${year}">${year}</button>`)
    .join("");
  window.__EOE_STATE = state;
  window.__EOE_RENDER = render;
  await selectYear(initialYear, 7);
}
start().catch((error) => {
  console.error(error);
  $("#detail").innerHTML = '<div class="empty">数据加载失败</div>';
});
