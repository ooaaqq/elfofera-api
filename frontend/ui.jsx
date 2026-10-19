import { Launch } from "@carbon/icons-react";
import { Button, InlineNotification, Link, Pagination } from "@carbon/react";
import { videoUrl } from "./video.js";

export function SearchResult({ title, detail, selected, workId, onClick }) {
  return (
    <li>
      <button
        className="work-result"
        type="button"
        aria-pressed={selected}
        data-work-id={workId}
        onClick={onClick}
      >
        <span>{title}</span>
        <small>{detail}</small>
      </button>
    </li>
  );
}

export function VideoPartLinks({ bvid, parts, label }) {
  if (parts.length < 2) return null;
  return (
    <div className="video-parts">
      {parts.slice(1).map((part) => (
        <Link
          key={part}
          href={videoUrl(bvid, part)}
          target="_blank"
          rel="noreferrer"
          aria-label={`${label}，观看 P${part}（在新窗口打开）`}
        >
          P{part} <Launch size={16} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

export const pad = (value) => String(value).padStart(2, "0");
export const performanceTypes = {
  dance: "舞蹈",
  instrumental: "演奏",
  "singing-and-dance": "唱跳",
};

export function RequestError({ title, message, onRetry }) {
  return (
    <div className="request-error">
      <InlineNotification
        kind="error"
        title={title}
        subtitle={message}
        hideCloseButton
      />
      <Button kind="tertiary" size="md" onClick={onRetry}>
        重新加载
      </Button>
    </div>
  );
}

export function ResultsPagination({
  total,
  page,
  pageSize,
  onChange,
  sizes = [10, 20, 50],
}) {
  return (
    <Pagination
      totalItems={total}
      page={page}
      pageSize={pageSize}
      pageSizes={sizes}
      onChange={onChange}
      itemsPerPageText="每页条数"
      pageNumberText="页码"
      pageSelectLabelText={(total) => `页码，共 ${total} 页`}
      pageText={(pageNumber) => `第 ${pageNumber} 页`}
      pageRangeText={(_, totalPages) => `共 ${totalPages} 页`}
      itemRangeText={(min, max, totalItems) =>
        `${min}–${max} / ${totalItems} 条`
      }
      backwardText="上一页"
      forwardText="下一页"
    />
  );
}
