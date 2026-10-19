import { Calendar, Launch } from "@carbon/icons-react";
import {
  Button,
  ContainedList,
  ContainedListItem,
  Link,
  Tag,
  Tile,
} from "@carbon/react";
import { memberNames } from "./members.js";
import { pad, performanceTypes, VideoPartLinks } from "./ui.jsx";
import { videoUrl } from "./video.js";

const contentTypes = {
  talk: "杂谈",
  singing: "歌回",
  dance: "舞蹈",
  radio: "电台",
  game: "游戏",
  lesson: "练习",
  celebration: "庆典",
  special: "特别节目",
  mixed: "综合",
};
function SessionTags({ event }) {
  if (
    !contentTypes[event.contentType] &&
    event.dimension === "unknown" &&
    !event.isUnannounced
  )
    return null;
  return (
    <div className="session-tags">
      {contentTypes[event.contentType] && (
        <Tag type="gray">{contentTypes[event.contentType]}</Tag>
      )}
      {event.dimension !== "unknown" && (
        <Tag type="cool-gray">{event.dimension.toUpperCase()}</Tag>
      )}
      {event.isUnannounced && <Tag type="blue">突击</Tag>}
    </div>
  );
}

export function SessionDetail({ event, date, changes, detailRef }) {
  return (
    <aside
      className="session-panel"
      aria-labelledby="detail-title"
      ref={detailRef}
      tabIndex={-1}
    >
      <div className="panel-heading">
        <h2 id="detail-title">
          {!event && changes.length ? "日程变更" : "场次详情"}
        </h2>
        <Calendar size={20} />
      </div>
      {!event && changes.length === 0 && (
        <Tile className="empty-state">
          <Calendar size={32} />
          <h3>{date ? "当日没有匹配的直播" : "没有匹配的直播"}</h3>
        </Tile>
      )}
      {event && (
        <>
          <div className="session-summary">
            <div className="session-heading">
              <p className="eyebrow">{event.date.replaceAll("-", " / ")}</p>
              <h3>{event.title}</h3>
              <p className="session-members">
                {memberNames(event.members) || "成员未收录"}
              </p>
              <SessionTags event={event} />
            </div>
            <div className="session-recordings">
              {event.bvid ? (
                <Button
                  as="a"
                  href={videoUrl(event.bvid, event.videoParts[0])}
                  target="_blank"
                  rel="noreferrer"
                  renderIcon={Launch}
                  aria-label={`观看录播${event.videoParts.length > 0 ? ` · P${event.videoParts[0]}` : ""}（在新窗口打开）`}
                  size="md"
                >
                  观看录播
                  {event.videoParts.length > 0 && ` · P${event.videoParts[0]}`}
                </Button>
              ) : (
                <p className="secondary-text">暂未收录可用录播</p>
              )}
              {event.bvid && (
                <VideoPartLinks
                  bvid={event.bvid}
                  parts={event.videoParts}
                  label={event.title}
                />
              )}
            </div>
          </div>
          <ContainedList
            label={`表演曲目 · ${event.tracks.length}`}
            kind="on-page"
            className="track-list"
          >
            {event.tracks.length === 0 && (
              <ContainedListItem>
                <p className="secondary-text">暂未收录曲目</p>
              </ContainedListItem>
            )}
            {event.tracks.map((track, index) => (
              <ContainedListItem key={track.id}>
                <div className="track-row">
                  <span className="track-index">{pad(index + 1)}</span>
                  <div className="track-copy">
                    <Link
                      href={
                        track.bvid
                          ? videoUrl(track.bvid, track.videoParts[0])
                          : `https://search.bilibili.com/all?keyword=${encodeURIComponent(track.title)}`
                      }
                      aria-label={`${track.title}，${track.bvid ? "观看视频" : "B 站搜索"}（在新窗口打开）`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {track.title}
                      <Launch size={16} aria-hidden="true" />
                    </Link>
                    {track.bvid && (
                      <VideoPartLinks
                        bvid={track.bvid}
                        parts={track.videoParts}
                        label={track.title}
                      />
                    )}
                    <p>{track.artists.join(" / ") || "原唱未收录"}</p>
                    <p>
                      {memberNames(track.members) || "成员未收录"}
                      {performanceTypes[track.type] &&
                        ` · ${performanceTypes[track.type]}`}
                    </p>
                    {!track.bvid && <p>站内搜索 · 暂无切片</p>}
                  </div>
                </div>
              </ContainedListItem>
            ))}
          </ContainedList>
        </>
      )}
      {changes.length > 0 && (
        <div className="schedule-changes">
          <h3>{date} · 日程变更</h3>
          <ul className="change-list">
            {changes.map((change) => (
              <li key={change.id}>{change.description}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
