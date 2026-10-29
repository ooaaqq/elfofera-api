import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { memberSchema } from "./records.js";

const optionalDate = z.union([z.literal(""), z.iso.date()]).default("");
const member = z.union([z.literal("all"), memberSchema]);
const locationSchema = z.object({
  view: z.enum(["archive", "songs", "api", "thanks"]).default("archive"),
  section: z
    .enum([
      "",
      "api-start",
      "api-timeline",
      "api-works",
      "api-history",
      "api-statistics",
      "api-bun",
      "api-records",
      "api-errors",
      "thanks-official",
      "thanks-community",
      "thanks-tools",
    ])
    .default(""),
  year: z.union([z.literal(""), z.string().regex(/^\d{4}$/)]).default(""),
  month: z.coerce.number().int().min(0).max(12).default(0),
  member: member.default("all"),
  query: z.string().default(""),
  archivePage: z.coerce.number().int().positive().default(1),
  date: optionalDate,
  eventId: z.string().default(""),
  songQuery: z.string().default(""),
  workId: z.string().default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(20), z.literal(50)]))
    .default(20),
  historyYear: z
    .union([z.literal("all"), z.string().regex(/^\d{4}$/)])
    .default("all"),
  historyMember: member.default("all"),
  order: z.enum(["recent", "oldest"]).default("recent"),
  historyPage: z.coerce.number().int().positive().default(1),
});
export const defaultLocation = locationSchema.parse({});

export function parseLocation(hash) {
  const [view = "", query = ""] = hash.replace(/^#/, "").split("?");
  return locationSchema.safeParse({
    ...Object.fromEntries(new URLSearchParams(query)),
    view: view || "archive",
  });
}

export function formatLocation(state) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (key !== "view" && value !== defaultLocation[key])
      params.set(key, String(value));
  }
  const query = params.toString();
  return `#${state.view}${query ? `?${query}` : ""}`;
}

function subscribe(listener) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  window.addEventListener("archive:navigate", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("archive:navigate", listener);
  };
}
const snapshot = () => window.location.hash;

export function useLocationState() {
  const hash = useSyncExternalStore(subscribe, snapshot);
  const parsed = useMemo(() => parseLocation(hash), [hash]);
  const state = parsed.success ? parsed.data : defaultLocation;
  function navigate(patch, { replace = false } = {}) {
    const next = formatLocation({ ...state, ...patch });
    if (next === window.location.hash) return;
    window.history[replace ? "replaceState" : "pushState"](null, "", next);
    window.dispatchEvent(new Event("archive:navigate"));
  }
  return { state, navigate, invalid: !parsed.success };
}
