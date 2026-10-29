import { ArrowLeft, Launch } from "@carbon/icons-react";
import {
  Button,
  ContainedList,
  ContainedListItem,
  InlineLoading,
  Layer,
  Link,
  Search,
  Select,
  SelectItem,
  Tag,
} from "@carbon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { memberNames, memberOptions } from "./members.js";
import { SongOverview } from "./song-overview.jsx";
import {
  performanceTypes,
  RequestError,
  ResultsPagination,
  SearchResult,
  VideoPartLinks,
} from "./ui.jsx";
import { useResponsiveLayout } from "./use-responsive-layout.js";
import { videoUrl } from "./video.js";
import { loadWorkHistory } from "./work-history.js";

const workKinds = { original: "原创", cover: "翻唱", instrumental: "器乐" };

function WorkPublications({ publications }) {
  if (!publications.length) return null;
  return (
    <ContainedList
      label={`作品投稿 · ${publications.length}`}
      kind="on-page"
      className="publication-list"
    >
      {publications.map((post) => (
        <ContainedListItem key={post.id}>
          <div className="publication-record">
            <time dateTime={post.date} className="eyebrow">
              {post.date}
            </time>
            <p className="performance-title">{post.title}</p>
            {post.members.length > 0 && (
              <p className="record-members">{memberNames(post.members)}</p>
            )}
            {post.bvid && (
              <Link
                href={videoUrl(post.bvid, post.videoParts[0])}
                target="_blank"
                rel="noreferrer"
                aria-label={`${post.title}，观看投稿${post.videoParts.length > 0 ? ` · P${post.videoParts[0]}` : ""}（在新窗口打开）`}
              >
                观看投稿
                {post.videoParts.length > 0 && ` · P${post.videoParts[0]}`}{" "}
                <Launch size={16} aria-hidden="true" />
              </Link>
            )}
            {post.bvid && (
              <VideoPartLinks
                bvid={post.bvid}
                parts={post.videoParts}
                label={post.title}
              />
            )}
          </div>
        </ContainedListItem>
      ))}
    </ContainedList>
  );
}

function WorkHistory({ selected, route, navigate, onOpenEvent }) {
  const countRef = useRef(null);
  const [history, setHistory] = useState({
    id: "",
    records: [],
    publications: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The attempt counter triggers an explicit user retry.
  useEffect(() => {
    const controller = new AbortController();
    setHistory({ id: "", records: [], publications: [], error: null });
    loadWorkHistory(selected, controller.signal)
      .then(({ performances, publications }) => {
        if (!controller.signal.aborted)
          setHistory({
            id: selected.id,
            records: performances,
            publications,
            error: null,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setHistory({
            id: selected.id,
            records: [],
            publications: [],
            error: error.message,
          });
      });
    return () => controller.abort();
  }, [selected, attempt]);
  if (history.id !== selected.id)
    return (
      <div className="history-loading">
        <InlineLoading description="正在加载作品记录…" />
      </div>
    );
  if (history.error)
    return (
      <RequestError
        title="作品记录加载失败"
        message={history.error}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  const years = [
    ...new Set(history.records.map((record) => record.date.slice(0, 4))),
  ]
    .sort()
    .reverse();
  const records = history.records
    .filter(
      (record) =>
        (route.historyYear === "all" ||
          record.date.startsWith(route.historyYear)) &&
        (route.historyMember === "all" ||
          record.members.includes(route.historyMember)),
    )
    .toSorted((a, b) =>
      route.order === "recent"
        ? b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
        : a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  const page = Math.min(
    route.historyPage,
    Math.max(1, Math.ceil(records.length / 20)),
  );
  const filter = (patch) => navigate({ ...patch, historyPage: 1 });
  return (
    <>
      <WorkPublications publications={history.publications} />
      {history.records.length > 0 && (
        <Layer
          as="section"
          level={1}
          className="history-filters"
          aria-label="演出记录筛选"
        >
          <Select
            id="history-year"
            labelText="演出年份"
            size="md"
            value={route.historyYear}
            onChange={(e) => filter({ historyYear: e.target.value })}
          >
            <SelectItem value="all" text="全部年份" />
            {years.map((year) => (
              <SelectItem key={year} value={year} text={`${year} 年`} />
            ))}
          </Select>
          <Select
            id="history-member"
            labelText="演出成员"
            size="md"
            value={route.historyMember}
            onChange={(e) => filter({ historyMember: e.target.value })}
          >
            {memberOptions.map((member) => (
              <SelectItem
                key={member.id}
                value={member.id}
                text={member.label}
              />
            ))}
          </Select>
          <Select
            id="history-order"
            labelText="排序"
            size="md"
            value={route.order}
            onChange={(e) => filter({ order: e.target.value })}
          >
            <SelectItem value="recent" text="最近在前" />
            <SelectItem value="oldest" text="最早在前" />
          </Select>
        </Layer>
      )}
      {history.records.length > 0 && (
        <p className="history-count" role="status" ref={countRef} tabIndex={-1}>
          全部 {history.records.length} 次演出 · 当前筛选 {records.length} 次
        </p>
      )}
      <ContainedList
        label={`演出记录 · ${records.length}`}
        kind="on-page"
        className="performance-list"
      >
        {!records.length && (
          <ContainedListItem>
            <div className="list-empty">
              <p>
                {history.records.length
                  ? "当前筛选没有匹配的演出。"
                  : "暂无已确认的演出记录。"}
              </p>
              {history.records.length > 0 && (
                <Button
                  kind="tertiary"
                  size="md"
                  onClick={() =>
                    filter({ historyYear: "all", historyMember: "all" })
                  }
                >
                  清除演出筛选
                </Button>
              )}
            </div>
          </ContainedListItem>
        )}
        {records.slice((page - 1) * 20, page * 20).map((record) => (
          <ContainedListItem key={record.id}>
            <div className="performance-record">
              <time dateTime={record.date} className="eyebrow">
                {record.date}
              </time>
              {record.kind === "livestream" ? (
                <button
                  type="button"
                  className="performance-result"
                  onClick={() => onOpenEvent(record)}
                  aria-label={`${record.date} ${record.title}，查看直播场次`}
                >
                  {record.title}
                </button>
              ) : (
                <p className="performance-title">{record.title}</p>
              )}
              <p className="record-members">
                {memberNames(record.members) || "成员未收录"}
                {performanceTypes[record.type] &&
                  ` · ${performanceTypes[record.type]}`}
              </p>
              {record.bvid && (
                <Link
                  href={videoUrl(record.bvid, record.videoParts[0])}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${record.date} ${record.title}，观看视频${record.videoParts.length > 0 ? ` · P${record.videoParts[0]}` : ""}（在新窗口打开）`}
                >
                  观看视频
                  {record.videoParts.length > 0 &&
                    ` · P${record.videoParts[0]}`}{" "}
                  <Launch size={16} aria-hidden="true" />
                </Link>
              )}
              {record.bvid && (
                <VideoPartLinks
                  bvid={record.bvid}
                  parts={record.videoParts}
                  label={record.title}
                />
              )}
            </div>
          </ContainedListItem>
        ))}
      </ContainedList>
      {records.length > 20 && (
        <ResultsPagination
          total={records.length}
          page={page}
          pageSize={20}
          sizes={[20]}
          onChange={({ page: nextPage }) => {
            navigate({ historyPage: nextPage });
            requestAnimationFrame(() => {
              countRef.current?.focus({ preventScroll: true });
              countRef.current?.scrollIntoView({ block: "start" });
            });
          }}
        />
      )}
    </>
  );
}

export function SongsView({ works, route, navigate, onOpenEvent }) {
  const normalized = route.songQuery.trim().toLocaleLowerCase();
  const matches = useMemo(
    () =>
      works
        .filter((work) =>
          [work.title, ...work.artists].some((value) =>
            value.toLocaleLowerCase().includes(normalized),
          ),
        )
        .toSorted(
          (a, b) =>
            b.performanceCount - a.performanceCount ||
            a.title.localeCompare(b.title),
        ),
    [works, normalized],
  );
  const page = Math.min(
    route.page,
    Math.max(1, Math.ceil(matches.length / route.pageSize)),
  );
  const selected = matches.find((work) => work.id === route.workId);
  const visibleWorks = normalized
    ? matches.slice((page - 1) * route.pageSize, page * route.pageSize)
    : matches.slice(0, 6);
  const rootRef = useRef(null);
  const { compact } = useResponsiveLayout(rootRef);
  const detailRef = useRef(null);
  const resultRef = useRef(null);
  const triggerRef = useRef(null);
  const triggerIdRef = useRef("");
  const scrollRef = useRef(0);
  const previousDetail = useRef(false);
  const detailVisible = compact && Boolean(selected);
  useEffect(() => {
    if (detailVisible) {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ block: "start" });
    } else if (previousDetail.current) {
      const trigger = triggerRef.current?.isConnected
        ? triggerRef.current
        : Array.from(rootRef.current.querySelectorAll("[data-work-id]")).find(
            (button) => button.dataset.workId === triggerIdRef.current,
          );
      (trigger ?? resultRef.current)?.focus({ preventScroll: true });
      window.scrollTo({ top: scrollRef.current });
    }
    previousDetail.current = detailVisible;
  }, [detailVisible]);
  function choose(work, target) {
    triggerRef.current = target;
    triggerIdRef.current = work.id;
    scrollRef.current = window.scrollY;
    navigate({
      workId: work.id,
      historyYear: "all",
      historyMember: "all",
      historyPage: 1,
    });
    if (!compact) {
      requestAnimationFrame(() => {
        const heading = detailRef.current;
        if (!heading) return;
        const { top, bottom } = heading.getBoundingClientRect();
        if (top < 48 || bottom > window.innerHeight) {
          heading.focus({ preventScroll: true });
          heading.scrollIntoView({ block: "start" });
        }
      });
    }
  }
  return (
    <div className="song-page" ref={rootRef}>
      <Layer
        as="section"
        level={1}
        className="song-search-panel song-results"
        aria-label="歌曲搜索"
        hidden={detailVisible}
      >
        <Search
          id="work-search"
          size="md"
          labelText="搜索歌曲或原唱"
          placeholder="搜索歌曲或原唱"
          closeButtonLabelText="清除搜索"
          value={route.songQuery}
          onChange={(e) =>
            navigate(
              {
                songQuery: e.target.value,
                page: 1,
                workId: "",
                historyPage: 1,
              },
              { replace: true },
            )
          }
        />
        {normalized && (
          <p className="search-hint" role="status">
            {matches.length} 个匹配结果
          </p>
        )}
        <ul
          className="work-results"
          aria-label="歌曲搜索结果"
          ref={resultRef}
          tabIndex={-1}
        >
          {visibleWorks.map((work) => (
            <SearchResult
              key={work.id}
              title={work.title}
              workId={work.id}
              selected={work.id === selected?.id}
              onClick={(e) => choose(work, e.currentTarget)}
              detail={
                <>
                  {work.artists.join(" / ") || "原唱未收录"} ·{" "}
                  {work.performanceCount} 次演出
                  {work.publicationCount > 0 &&
                    ` · ${work.publicationCount} 条投稿`}
                </>
              }
            />
          ))}
          {normalized && !matches.length && (
            <li className="search-empty">
              <h2>没有匹配的作品</h2>
              <p>尝试缩短歌名，或搜索原唱。</p>
              <Button
                kind="tertiary"
                size="md"
                onClick={() =>
                  navigate(
                    { songQuery: "", workId: "", page: 1 },
                    { replace: true },
                  )
                }
              >
                清除搜索
              </Button>
            </li>
          )}
        </ul>
        {normalized && matches.length > 0 && (
          <ResultsPagination
            total={matches.length}
            page={page}
            pageSize={route.pageSize}
            onChange={({ page: nextPage, pageSize }) => {
              navigate({
                page: pageSize === route.pageSize ? nextPage : 1,
                pageSize,
                workId: "",
              });
              requestAnimationFrame(() => {
                resultRef.current?.focus({ preventScroll: true });
                resultRef.current?.scrollIntoView({ block: "start" });
              });
            }}
          />
        )}
      </Layer>
      <section
        className="work-detail song-detail"
        aria-label={selected ? "作品详情" : "歌曲概览"}
      >
        {!selected && (
          <SongOverview
            works={matches}
            searching={Boolean(normalized)}
            onSelectArtist={(artist) => {
              navigate({
                songQuery: artist,
                page: 1,
                workId: "",
                historyPage: 1,
              });
              requestAnimationFrame(() => {
                const search = document.getElementById("work-search");
                search?.focus({ preventScroll: true });
                search?.scrollIntoView({ block: "center" });
              });
            }}
          />
        )}
        {selected && (
          <div className="detail-content" key={selected.id}>
            {detailVisible && (
              <Button
                kind="ghost"
                size="md"
                renderIcon={ArrowLeft}
                className="return-button"
                onClick={() => navigate({ workId: "" })}
              >
                返回搜索结果
              </Button>
            )}
            <div className="work-summary">
              <h2 ref={detailRef} tabIndex={-1}>
                {selected.title}
              </h2>
              <p>{selected.artists.join(" / ") || "原唱未收录"}</p>
              <p className="work-total">
                {selected.performanceCount} 次演出
                {selected.publicationCount > 0 &&
                  ` · ${selected.publicationCount} 条投稿`}
              </p>
              {(workKinds[selected.kind] || selected.series) && (
                <div className="session-tags">
                  {workKinds[selected.kind] && (
                    <Tag type="gray">{workKinds[selected.kind]}</Tag>
                  )}
                  {selected.series && (
                    <Tag type="cool-gray">{selected.series}</Tag>
                  )}
                </div>
              )}
            </div>
            <WorkHistory
              selected={selected}
              route={route}
              navigate={navigate}
              onOpenEvent={onOpenEvent}
            />
          </div>
        )}
      </section>
    </div>
  );
}
