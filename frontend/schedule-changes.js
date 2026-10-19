import { z } from "zod";
import { memberNames } from "./members.js";

const dateSchema = z.iso.date();
const unique = (values) => [...new Set(values)];
const planMembers = (plan) => [
  ...(plan?.members ?? []),
  ...(plan?.member ? [plan.member] : []),
  ...(plan?.namedMembers ?? []),
  ...(plan?.events ?? []).flatMap((event) => event.members ?? []),
];

function changeMembers(change, event) {
  const explicit = unique([
    ...(change.members ?? []),
    ...(change.member ? [change.member] : []),
    ...planMembers(change.from),
    ...planMembers(change.to),
  ]);
  if (explicit.length && change.action !== "lineup-change") return explicit;
  return unique([
    ...explicit,
    ...(change.originalMembers ?? []),
    ...planMembers(change.originalPlan),
    ...planMembers(change.revisedPlan),
    ...planMembers(change.replacesPlan),
    ...planMembers(change.upper),
    ...(change.upper?.originalMembers ?? []),
    ...planMembers(change.lower),
    ...(change.affectedPlans ?? []).flatMap(planMembers),
    ...(event?.plannedMembers ?? []),
  ]);
}

function schedulePart(change, side) {
  if (change[side]) return change[side];
  const date = change[`${side}Date`];
  if (date) return { date, plannedTime: change[`${side}PlannedTime`] };
  return undefined;
}

function partText(part) {
  if (!part) return "日期待定";
  return [
    part.date ?? part.dateDescription ?? "日期待定",
    part.plannedTime,
    part.delayMinutes ? `约延后 ${part.delayMinutes} 分钟` : undefined,
    part.timeRelation === "same-as-original" ? "时间同原计划" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function planText(plan) {
  if (!plan) return "未公布具体安排";
  if (plan.restDay) return "休息";
  if (plan.events) {
    const entries = [
      ...plan.events.map(planText),
      ...(plan.nonStreamActivities ?? []),
    ];
    return entries.join("；") || "未列直播安排";
  }
  return (
    [memberNames(planMembers(plan)), plan.plannedTime, plan.formatLabel]
      .filter(Boolean)
      .join(" ") || "未公布具体安排"
  );
}

function originalEvent(change) {
  const entries = change.originalPlan?.events;
  if (!entries) return change.originalPlan;
  const affected = change.members ?? (change.member ? [change.member] : []);
  const matching = entries.filter((entry) =>
    affected.some((id) => entry.members?.includes(id)),
  );
  if (matching.length === 1) return matching[0];
  if (entries.length === 1) return entries[0];
  return undefined;
}

function postponeText({ change, who, subject, from, to, original }) {
  if (from || to) return `${who} · 延期：${partText(from)} → ${partText(to)}`;
  if (change.announcedPlannedTime)
    return `${who} · 延后：${original?.plannedTime ?? "原时刻未公布"} → ${change.announcedPlannedTime}`;
  return `${subject} · ${change.eventTitle ?? "直播"}延期${change.originalDateLabel ? `（原定${change.originalDateLabel}）` : ""}，新时间未公布`;
}

function absenceText({ change, subject }) {
  const label = change.action === "tentative-absence" ? "暂定缺席" : "缺席";
  if (change.scope) return `${subject} · ${label}：${change.scope}`;
  return `${subject} · ${label}${change.throughDate ? `（${change.fromDate} 至 ${change.throughDate}）` : ""}${change.until ? `，至${change.until}` : ""}${change.fromDate && !change.throughDate && !change.until ? "（未公布结束日期）" : ""}`;
}

function lineupText({ change, time }) {
  if (change.upper || change.lower)
    return `阵容调整：上半场 ${planText(change.upper)}；下半场 ${planText(change.lower)}`;
  return `阵容调整：${memberNames(change.originalMembers ?? planMembers(change.replacesPlan)) || "原阵容未列明"} → ${memberNames(change.members ?? [])} ${time ?? ""}`.trim();
}

function announcementText({ change, who, subject }) {
  if (change.text)
    return `${who} · ${change.text}${change.effectiveFrom ? `（${change.effectiveFrom} 起）` : ""}${change.expectedDuration ? `，预计${change.expectedDuration}` : ""}`;
  return `${subject} · 日程公告${change.title ? `：${change.title}` : ""}`;
}

const descriptions = {
  cancel: ({ subject }) => `${subject} · 取消`,
  cancellation: ({ subject }) => `${subject} · 取消`,
  reschedule: ({ who, from, to }) =>
    `${who} · 改期：${partText(from)} → ${partText(to)}`,
  rescheduling: ({ who, from, to }) =>
    `${who} · 改期：${partText(from)} → ${partText(to)}`,
  postpone: postponeText,
  postponement: postponeText,
  "member-absence": absenceText,
  "tentative-absence": absenceText,
  "lineup-change": lineupText,
  "schedule-announcement": announcementText,
  "time-change": ({ change, who }) =>
    `${who} · 时间调整：${change.fromTime ?? change.fromPlannedTime ?? change.previousPlannedTime ?? "原时刻未公布"} → ${change.toTime ?? change.toPlannedTime ?? change.plannedTime}`,
  "format-change": ({ change, subject }) =>
    `${subject} · 形态调整：${change.fromFormat ?? change.fromFormatLabel ?? "原形态未标注"} → ${change.toFormat ?? change.toFormatLabel ?? change.toFormatLabels?.join(" / ")}${change.throughDate ? `（${change.fromDate} 至 ${change.throughDate}）` : ""}`,
  "schedule-revision": ({ change }) =>
    `周表调整：${planText(change.originalPlan)} → ${planText(change.revisedPlan)}`,
  "additional-stream": ({ change, subject }) =>
    `${subject} · 追加直播${change.plannedEndTime ? `，计划结束 ${change.plannedEndTime}` : ""}${change.formatLabel ? ` · ${change.formatLabel}` : ""}`,
  "room-change": ({ change, subject }) =>
    change.fromHostMember && change.toHostMember
      ? `直播间调整：${memberNames([change.fromHostMember])} → ${memberNames([change.toHostMember])}`
      : `${subject} · 直播间调整`,
  delay: ({ change, subject }) =>
    `${subject} · 延后${change.estimatedDelayMinutes ? `约 ${change.estimatedDelayMinutes} 分钟` : "，新时间未公布"}`,
  "activity-pause": ({ change, who }) =>
    `${who} · 暂停活动${change.effectiveFrom ? `（${change.effectiveFrom} 起）` : ""}`,
  "postponement-and-start-announcement": ({ who }) => `${who} · 延期及开播公告`,
};

function description(change, members, from, to, event) {
  const describe = descriptions[change.action];
  if (!describe)
    throw new Error(`Unsupported schedule action: ${change.action}`);
  const who = memberNames(members) || "直播";
  const original = originalEvent(change);
  const time =
    change.plannedTime ?? original?.plannedTime ?? event?.plannedTime;
  const subject = [who, time].filter(Boolean).join(" ");
  return describe({ change, who, time, subject, from, to, original });
}

function changeDates(change, from, to, announcement) {
  const dates = unique(
    [change.date, from?.date, to?.date, change.fromDate].filter(Boolean),
  );
  if (change.fromDate && change.throughDate) {
    const end = dateSchema.parse(change.throughDate);
    let date = dateSchema.parse(change.fromDate);
    if (date > end) throw new Error(`Invalid schedule range: ${date} – ${end}`);
    while (date <= end) {
      dates.push(date);
      date = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000)
        .toISOString()
        .slice(0, 10);
    }
  }
  if (!dates.length && announcement) dates.push(announcement.date);
  if (!dates.length)
    throw new Error(`Missing date for schedule action: ${change.action}`);
  return unique(dates).map((date) => dateSchema.parse(date));
}

export function buildScheduleChanges(changes, events) {
  const byId = new Map(events.map((event) => [event.id, event]));
  return changes.flatMap((change, index) => {
    const event = byId.get(change.relatedEventId ?? change.eventId);
    const announcement = byId.get(
      change.relatedAnnouncementEventId ?? change.announcementEventId,
    );
    const members = changeMembers(change, event);
    const from = schedulePart(change, "from");
    const to = schedulePart(change, "to");
    const text = description(change, members, from, to, event);
    if (/undefined|NaN/.test(text))
      throw new Error(`Incomplete schedule description: ${change.action}`);
    return changeDates(change, from, to, announcement).map((date) => ({
      id: `change-${index}-${date}`,
      date,
      action: change.action,
      members,
      description: text,
    }));
  });
}
