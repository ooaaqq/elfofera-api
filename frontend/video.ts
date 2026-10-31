export const videoUrl = (bvid: string, part?: number) => {
  const url = `https://www.bilibili.com/video/${encodeURIComponent(bvid)}`;
  return part ? `${url}?p=${part}` : url;
};

export function videoParts(
  source?: {
    bvid?: string | null;
    partNumbers?: number[] | null;
    partNumber?: number;
  } | null,
) {
  const parts =
    source?.partNumbers ??
    (source?.partNumber === undefined ? [] : [source.partNumber]);
  if (parts.some((part) => !Number.isInteger(part) || part < 1)) {
    throw new Error(`Invalid video part for ${source?.bvid}`);
  }
  return [...new Set(parts)];
}
