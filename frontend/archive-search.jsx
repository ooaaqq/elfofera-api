import { Button } from "@carbon/react";
import { useMemo, useRef } from "react";
import { searchLivestreams } from "./archive-search.js";
import { memberNames } from "./members.js";
import { ResultsPagination } from "./ui.jsx";

export function ArchiveSearch({
  livestreams,
  route,
  navigate,
  onSelect,
  onClear,
}) {
  const results = useMemo(
    () => searchLivestreams(livestreams, route.query, route.member),
    [livestreams, route.query, route.member],
  );
  const countRef = useRef(null);
  const page = Math.min(
    route.archivePage,
    Math.max(1, Math.ceil(results.length / 20)),
  );
  return (
    <div className="archive-search-results">
      <p
        className="archive-search-count"
        ref={countRef}
        tabIndex={-1}
        role="status"
      >
        {results.length} 场匹配直播
      </p>
      {!results.length && (
        <div className="calendar-empty">
          <h2>没有匹配的直播</h2>
          <Button kind="tertiary" size="md" onClick={onClear}>
            清除搜索
          </Button>
        </div>
      )}
      <ul className="archive-results" aria-label="全部年份的直播搜索结果">
        {results.slice((page - 1) * 20, page * 20).map((event) => (
          <li key={event.id}>
            <button
              className="archive-result"
              type="button"
              onClick={() => onSelect(event)}
            >
              <time dateTime={event.date} className="eyebrow">
                {event.date}
              </time>
              <span>{event.title}</span>
              <span className="record-members">
                {memberNames(event.members) || "成员未收录"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {results.length > 20 && (
        <ResultsPagination
          total={results.length}
          page={page}
          pageSize={20}
          sizes={[20]}
          onChange={({ page }) => {
            navigate({ archivePage: page });
            requestAnimationFrame(() => {
              countRef.current?.focus({ preventScroll: true });
              countRef.current?.scrollIntoView({ block: "start" });
            });
          }}
        />
      )}
    </div>
  );
}
