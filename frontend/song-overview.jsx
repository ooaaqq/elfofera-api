import { useMemo } from "react";
import { mostPerformedArtists } from "./song-statistics.js";
import { SearchResult } from "./ui.jsx";

export function SongOverview({ works, searching, onSelectArtist }) {
  const summary = useMemo(
    () => ({
      performances: works.reduce(
        (total, work) => total + work.performanceCount,
        0,
      ),
      publishedWorks: works.filter((work) => work.publicationCount > 0).length,
      artists: mostPerformedArtists(works).slice(0, 6),
    }),
    [works],
  );
  return (
    <div className="song-overview">
      <div className="song-overview-summary">
        <h2>{searching ? "搜索概览" : "收录概览"}</h2>
        <dl className="song-overview-metrics">
          <div>
            <dt>{searching ? "匹配作品" : "已收录作品"}</dt>
            <dd>{works.length.toLocaleString("zh-CN")}</dd>
          </div>
          <div>
            <dt>演出记录</dt>
            <dd>{summary.performances.toLocaleString("zh-CN")}</dd>
          </div>
          <div>
            <dt>有投稿的作品</dt>
            <dd>{summary.publishedWorks.toLocaleString("zh-CN")}</dd>
          </div>
        </dl>
      </div>
      {summary.artists.length > 0 && (
        <ul
          className="work-results artist-results"
          aria-label="原唱按关联演出次数排序"
        >
          {summary.artists.map((artist) => (
            <SearchResult
              key={artist.name}
              title={artist.name}
              detail={`${artist.workCount} 首作品 · ${artist.performanceCount} 次演出`}
              onClick={() => onSelectArtist(artist.name)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
