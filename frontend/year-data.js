export function createYearLoader(fetchData) {
  const cache = new Map();
  let requestId = 0;
  return async (year) => {
    const id = ++requestId;
    let indexed = cache.get(year);
    if (!indexed) {
      const response = await fetchData(`/data/years/${year}.json`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`加载 ${year} 年数据失败：${response.status}`);
      }
      const events = await response.json();
      indexed = {
        events,
        months: Map.groupBy(events, (event) => Number(event.date.slice(5, 7))),
        dates: Map.groupBy(events, (event) => event.date),
      };
      cache.set(year, indexed);
    }
    return { current: id === requestId, indexed };
  };
}
