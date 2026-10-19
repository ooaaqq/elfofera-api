export function mostPerformedArtists(works) {
  const artists = new Map();
  for (const work of works) {
    if (work.performanceCount === 0) continue;
    for (const name of new Set(work.artists)) {
      if (!name.trim()) continue;
      const artist = artists.get(name) ?? {
        name,
        workCount: 0,
        performanceCount: 0,
      };
      artist.workCount += 1;
      artist.performanceCount += work.performanceCount;
      artists.set(name, artist);
    }
  }
  return [...artists.values()].toSorted(
    (a, b) =>
      b.performanceCount - a.performanceCount ||
      b.workCount - a.workCount ||
      a.name.localeCompare(b.name, "zh-CN"),
  );
}
