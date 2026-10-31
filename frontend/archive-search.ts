import type { Livestream } from "./data-contract";
export function searchLivestreams(
  livestreams: Livestream[],
  query: string,
  member: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return livestreams
    .filter(
      (event) =>
        event.title.toLocaleLowerCase().includes(normalized) &&
        (member === "all" || event.members.includes(member)),
    )
    .toSorted(
      (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
    );
}
