import confirmedMembers from "../dist/members.json" with { type: "json" };
export const members: Record<string, string> = confirmedMembers;
export const memberOptions = [
  { id: "all", label: "全部成员" },
  ...Object.entries(members).map(([id, label]) => ({ id, label })),
];
export const memberNames = (ids: readonly string[]) =>
  ids.map((id) => members[id]).join(" / ");
