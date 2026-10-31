import type { Endpoint } from "./data-contract";
export function serviceStatus(
  endpoint: Endpoint,
  now: number,
  disconnected = false,
) {
  const latest = endpoint.results.at(-1);
  let state: "up" | "down" | "unknown" = "unknown";
  if (latest && !disconnected && now - Date.parse(latest.timestamp) <= 180_000)
    state = latest.success ? "up" : "down";
  return {
    ...endpoint,
    state,
    latest,
  };
}

// Calendar days and six-hour slots follow the viewer's local timezone.
export function statusHistory(results: Endpoint["results"], now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 29 + index);
    return {
      timestamp: date.getTime(),
      slots: Array.from({ length: 4 }, (_, index) => ({
        hour: index * 6,
        passed: 0,
        failed: 0,
      })),
    };
  });
  const byDate = new Map(days.map((day) => [day.timestamp, day]));
  for (const result of results) {
    const date = new Date(result.timestamp);
    if (date.getTime() > now) continue;
    const slot = Math.floor(date.getHours() / 6);
    date.setHours(0, 0, 0, 0);
    const day = byDate.get(date.getTime());
    // biome-ignore lint/style/noNonNullAssertion: Hours 0–23 map to the four allocated slots.
    if (day) day.slots[slot]![result.success ? "passed" : "failed"] += 1;
  }
  return days;
}
