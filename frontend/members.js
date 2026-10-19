export const members = {
  luzao: "露早",
  yumo: "虞莫",
  waner: "莞儿",
  youen: "柚恩",
  minuo: "米诺",
};
export const memberOptions = [
  { id: "all", label: "全部成员" },
  ...Object.entries(members).map(([id, label]) => ({ id, label })),
];
export const memberNames = (ids) => ids.map((id) => members[id]).join(" / ");
