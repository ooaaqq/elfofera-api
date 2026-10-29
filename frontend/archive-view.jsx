import { ArrowLeft, ArrowRight, Reset } from "@carbon/icons-react";
import {
  Button,
  Dropdown,
  Layer,
  Search,
  Select,
  SelectItem,
  SkeletonPlaceholder,
} from "@carbon/react";
import { useEffect, useRef } from "react";
import { ArchiveSearch } from "./archive-search.jsx";
import { memberNames, memberOptions } from "./members.js";
import { SessionDetail } from "./session-detail.jsx";
import { pad, RequestError } from "./ui.jsx";
import { useResponsiveLayout } from "./use-responsive-layout.js";

const months = Array.from({ length: 12 }, (_, index) => index + 1);
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

function EventButton({ event, selected, onSelect }) {
  return (
    <button
      type="button"
      className="calendar-event"
      aria-pressed={selected}
      aria-label={`${event.date} ${event.title}，${memberNames(event.members)}`}
      onClick={(click) => onSelect(event.date, event.id, click.currentTarget)}
    >
      <span className="calendar-event-members">
        {memberNames(event.members) || "成员未收录"}
      </span>
      <span>{event.title}</span>
    </button>
  );
}

function ChangeButton({ date, count, eventId, onSelect }) {
  return (
    <button
      className="calendar-change"
      type="button"
      onClick={(click) => onSelect(date, eventId, click.currentTarget)}
      aria-label={`${date}，查看 ${count} 项日程变更`}
    >
      {count} 项变更 <ArrowRight size={16} />
    </button>
  );
}

function MonthCalendar({
  year,
  month,
  events,
  changes,
  selectedDate,
  selectedEventId,
  onSelect,
}) {
  const byDate = Map.groupBy(events, (event) => event.date);
  const changesByDate = Map.groupBy(changes, (change) => change.date);
  const first = (new Date(Number(year), month - 1, 1).getDay() + 6) % 7;
  const length = new Date(Number(year), month, 0).getDate();
  const weeks = Math.ceil((first + length) / 7);
  return (
    <section
      className="calendar-scroll"
      aria-label="可横向滚动的月份日历"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: This overflow region must support keyboard scrolling.
      tabIndex={0}
    >
      <table className="month-calendar">
        <caption className="visually-hidden">
          {year} 年 {month} 月直播日历
        </caption>
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th scope="col" key={day}>
                星期{day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: weeks }, (_, week) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Calendar rows have stable positional identities and contain no independent state.
            <tr key={`${year}-${month}-week-${week * 7 - first + 1}`}>
              {weekdays.map((weekday, index) => {
                const day = week * 7 + index - first + 1;
                if (day < 1 || day > length)
                  return <td className="calendar-blank" key={weekday} />;
                const date = `${year}-${pad(month)}-${pad(day)}`;
                const sessions = byDate.get(date) ?? [];
                const dayChanges = changesByDate.get(date) ?? [];
                return (
                  <td
                    key={weekday}
                    className={`calendar-day${date === selectedDate ? " is-selected" : ""}`}
                  >
                    <time className="day-number" dateTime={date}>
                      {pad(day)}
                    </time>
                    <div className="day-events">
                      {sessions.map((event) => (
                        <EventButton
                          key={event.id}
                          event={event}
                          selected={selectedEventId === event.id}
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                    {dayChanges.length > 0 && (
                      <ChangeButton
                        date={date}
                        count={dayChanges.length}
                        eventId=""
                        onSelect={onSelect}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Agenda({ events, changes, selectedId, onSelect }) {
  const byDate = Map.groupBy(events, (event) => event.date);
  const changesByDate = Map.groupBy(changes, (change) => change.date);
  const dates = [
    ...new Set([...byDate.keys(), ...changesByDate.keys()]),
  ].sort();
  return (
    <div className="agenda">
      {dates.map((date) => (
        <section
          key={date}
          className="agenda-day"
          aria-labelledby={`day-${date}`}
        >
          <h2 id={`day-${date}`}>
            <time dateTime={date}>{date.slice(5).replace("-", " 月 ")} 日</time>
          </h2>
          <div className="agenda-events">
            {(byDate.get(date) ?? []).map((event) => (
              <EventButton
                key={event.id}
                event={event}
                selected={selectedId === event.id}
                onSelect={onSelect}
              />
            ))}
          </div>
          {changesByDate.has(date) && (
            <ChangeButton
              date={date}
              count={changesByDate.get(date).length}
              eventId=""
              onSelect={onSelect}
            />
          )}
        </section>
      ))}
    </div>
  );
}

function filterEvents(yearData, route) {
  return yearData.filter(
    (event) =>
      Number(event.date.slice(5, 7)) === route.month &&
      (route.member === "all" || event.members.includes(route.member)),
  );
}

function filterChanges(changes, route) {
  return changes.filter(
    (change) =>
      change.date.startsWith(`${route.year}-${pad(route.month)}`) &&
      (route.member === "all" ||
        !change.members.length ||
        change.members.includes(route.member)),
  );
}

function ArchiveFilters({
  manifest,
  route,
  reset,
  loading,
  navigate,
  searching,
}) {
  return (
    <Layer
      as="section"
      level={1}
      className={`filter-panel${searching ? " is-searching" : ""}`}
      aria-label="档案筛选"
    >
      {!searching && (
        <>
          <Select
            id="year"
            labelText="年份"
            size="md"
            value={route.year}
            disabled={loading}
            onChange={(e) => reset({ year: e.target.value, month: 0 })}
          >
            {manifest.years.toReversed().map((year) => (
              <SelectItem key={year} value={year} text={`${year} 年`} />
            ))}
          </Select>
          <Select
            id="month"
            labelText="月份"
            size="md"
            value={route.month}
            disabled={loading}
            onChange={(e) => reset({ month: Number(e.target.value) })}
          >
            {!route.month && <SelectItem value={0} text="加载中" />}
            {months.map((month) => (
              <SelectItem key={month} value={month} text={`${month} 月`} />
            ))}
          </Select>
        </>
      )}
      <Dropdown
        id="member"
        className="member-filter"
        titleText="成员"
        size="md"
        label="全部成员"
        items={memberOptions}
        itemToString={(item) => item?.label ?? ""}
        selectedItem={memberOptions.find((item) => item.id === route.member)}
        disabled={loading && !searching}
        onChange={({ selectedItem }) => {
          if (selectedItem) reset({ member: selectedItem.id });
        }}
      />
      <div className="title-search">
        <Search
          id="title-search"
          size="md"
          labelText="搜索全部年份的直播标题"
          placeholder="搜索全部直播标题"
          closeButtonLabelText="清除搜索"
          value={route.query}
          onChange={(e) =>
            navigate(
              { query: e.target.value, archivePage: 1 },
              { replace: true },
            )
          }
        />
      </div>
      <Button
        kind="ghost"
        size="md"
        renderIcon={Reset}
        hasIconOnly
        iconDescription="重置筛选"
        tooltipAlignment="end"
        disabled={route.member === "all" && !route.query}
        onClick={() => reset({ member: "all", query: "", archivePage: 1 })}
      />
    </Layer>
  );
}

function ArchiveContent({
  loading,
  error,
  onRetry,
  events,
  changes,
  route,
  reset,
  mode,
  selectedDate,
  selectedEventId,
  onSelect,
}) {
  return (
    <>
      {loading && (
        <div className="calendar-loading">
          <SkeletonPlaceholder />
          <p role="status">正在加载所选年份…</p>
        </div>
      )}
      {!loading && error && (
        <RequestError
          title="直播档案加载失败"
          message={error}
          onRetry={onRetry}
        />
      )}
      {!loading && !error && (
        <>
          {!events.length && !changes.length && (
            <div className="calendar-empty" role="status">
              <p>本月没有匹配的直播。可切换月份或清除筛选。</p>
              {(route.member !== "all" || route.query) && (
                <Button
                  kind="tertiary"
                  size="md"
                  onClick={() =>
                    reset({ member: "all", query: "", archivePage: 1 })
                  }
                >
                  清除筛选
                </Button>
              )}
            </div>
          )}
          {mode === "calendar" ? (
            <MonthCalendar
              year={route.year}
              month={route.month}
              events={events}
              changes={changes}
              selectedDate={selectedDate}
              selectedEventId={selectedEventId}
              onSelect={onSelect}
            />
          ) : (
            <Agenda
              events={events}
              changes={changes}
              selectedId={selectedEventId}
              onSelect={onSelect}
            />
          )}
        </>
      )}
    </>
  );
}

export function ArchiveView({
  manifest,
  route,
  navigate,
  yearData,
  loading,
  error,
  onRetry,
}) {
  const searching = Boolean(route.query.trim());
  const pendingSearchSelection = useRef(false);
  const rootRef = useRef(null);
  const detailRef = useRef(null);
  const triggerRef = useRef(null);
  const scrollRef = useRef(0);
  const { compact, mobile } = useResponsiveLayout(rootRef);
  const detailVisible =
    compact && Boolean(route.date) && !searching && !loading && !error;
  const previousDetailVisible = useRef(false);
  useEffect(() => {
    if (detailVisible && !loading) {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ block: "start" });
    } else if (previousDetailVisible.current && !detailVisible) {
      const trigger = triggerRef.current?.isConnected
        ? triggerRef.current
        : rootRef.current?.querySelector(".calendar-event[aria-pressed=true]");
      trigger?.focus({ preventScroll: true });
      window.scrollTo({ top: scrollRef.current });
    }
    previousDetailVisible.current = detailVisible;
  }, [detailVisible, loading]);
  useEffect(() => {
    if (!pendingSearchSelection.current || searching || loading || error)
      return;
    pendingSearchSelection.current = false;
    detailRef.current?.focus({ preventScroll: true });
    detailRef.current?.scrollIntoView({ block: "start" });
  }, [searching, loading, error]);
  const events = filterEvents(yearData, route);
  const event = route.date
    ? events.find(
        (item) => item.id === route.eventId && item.date === route.date,
      )
    : events[0];
  const selectedDate = route.date || event?.date;
  const changes = filterChanges(manifest.changes, route);
  const mode = mobile ? "list" : "calendar";
  const reset = (patch, options) =>
    navigate({ ...patch, date: "", eventId: "", archivePage: 1 }, options);
  function select(date, eventId, trigger) {
    triggerRef.current = trigger;
    scrollRef.current = window.scrollY;
    navigate({ date, eventId });
  }
  return (
    <div
      className={`archive-layout${searching ? " is-searching" : ""}`}
      ref={rootRef}
    >
      <section
        className="calendar-panel archive-calendar"
        aria-labelledby="calendar-title"
        aria-busy={!searching && loading}
        hidden={detailVisible}
      >
        <ArchiveFilters
          manifest={manifest}
          route={route}
          reset={reset}
          loading={loading}
          navigate={navigate}
          searching={searching}
        />
        <h2 id="calendar-title" className="visually-hidden">
          {searching
            ? "直播搜索结果"
            : `${route.year} 年 ${pad(route.month)} 月直播档案`}
        </h2>
        {searching ? (
          <ArchiveSearch
            livestreams={manifest.livestreams}
            route={route}
            navigate={navigate}
            onClear={() =>
              navigate({ query: "", archivePage: 1 }, { replace: true })
            }
            onSelect={(result) => {
              pendingSearchSelection.current = true;
              triggerRef.current = null;
              scrollRef.current = 0;
              navigate({
                year: result.date.slice(0, 4),
                month: Number(result.date.slice(5, 7)),
                date: result.date,
                eventId: result.id,
                query: "",
              });
            }}
          />
        ) : (
          <ArchiveContent
            loading={loading}
            error={error}
            onRetry={onRetry}
            events={events}
            changes={changes}
            route={route}
            reset={reset}
            mode={mode}
            selectedDate={selectedDate}
            selectedEventId={event?.id}
            onSelect={select}
          />
        )}
      </section>
      <div
        className="archive-detail"
        hidden={
          searching || (compact && !detailVisible) || loading || Boolean(error)
        }
      >
        {detailVisible && (
          <Button
            kind="ghost"
            size="md"
            renderIcon={ArrowLeft}
            className="return-button"
            onClick={() => navigate({ date: "", eventId: "" })}
          >
            返回直播列表
          </Button>
        )}
        <SessionDetail
          key={event?.id || selectedDate || "empty"}
          event={event}
          date={selectedDate}
          changes={changes.filter((change) => change.date === selectedDate)}
          detailRef={detailRef}
        />
      </div>
    </div>
  );
}
