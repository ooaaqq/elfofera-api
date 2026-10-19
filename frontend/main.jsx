import { Button, SkeletonPlaceholder } from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ApiView } from "./api-view.jsx";
import { AppShell } from "./app-shell.jsx";
import { ArchiveView } from "./archive-view.jsx";
import { defaultLocation, useLocationState } from "./navigation.js";
import { SongsView } from "./songs-view.jsx";
import { RequestError } from "./ui.jsx";
import { createYearLoader, loadManifest } from "./year-data.js";
import "./style.scss";

const viewTitles = {
  archive: "直播档案",
  songs: "歌曲档案",
  api: "API 使用说明",
};

function App() {
  const { state: route, navigate, invalid } = useLocationState();
  const [manifestState, setManifest] = useState({ data: null, error: null });
  const [manifestAttempt, setManifestAttempt] = useState(0);
  const [yearState, setYear] = useState({
    year: "",
    events: [],
    loading: true,
    error: null,
  });
  const [yearAttempt, setYearAttempt] = useState(0);
  const loadYear = useRef(createYearLoader(fetch));
  const manifest = manifestState.data;
  const apiView = route.view === "api";
  const searching = Boolean(route.query.trim());
  const year = route.year || manifest?.years.at(-1) || "";
  const monthRef = useRef(route.month);
  monthRef.current = route.month;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const previousView = useRef(route.view);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Load on entering a data view or explicit retry; keep an already loaded manifest.
  useEffect(() => {
    if (apiView || manifest) return;
    const controller = new AbortController();
    setManifest({ data: null, error: null });
    loadManifest(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setManifest({ data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setManifest({ data: null, error: error.message });
      });
    return () => controller.abort();
  }, [manifestAttempt, apiView]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Month is resolved only when loading a year, while yearAttempt is an explicit retry.
  useEffect(() => {
    if (!manifest || route.view !== "archive" || invalid || searching) return;
    if (!manifest.years.includes(year)) {
      setYear({
        year,
        events: [],
        loading: false,
        error: `${year} 年不在当前档案范围内，请选择已收录年份。`,
      });
      return;
    }
    let active = true;
    setYear({ year, events: [], loading: true, error: null });
    loadYear
      .current(year)
      .then((result) => {
        if (!active || !result.current) return;
        setYear({
          year,
          events: result.indexed.events,
          loading: false,
          error: null,
        });
        navigateRef.current(
          {
            year,
            month:
              monthRef.current ||
              Number(result.indexed.events.at(-1)?.date.slice(5, 7) || 1),
          },
          { replace: true },
        );
      })
      .catch((error) => {
        if (active)
          setYear({ year, events: [], loading: false, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [manifest, route.view, year, yearAttempt, invalid, searching]);

  useEffect(() => {
    document.title = `${viewTitles[route.view]} · EOE`;
    if (previousView.current !== route.view) {
      document.getElementById("main-content")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
    previousView.current = route.view;
  }, [route.view]);

  const loading = yearState.year !== year || yearState.loading || !route.month;
  let content;
  if (invalid) {
    content = (
      <section className="page-state">
        <h1>无法打开此档案位置</h1>
        <p>链接中的筛选或页码无效。</p>
        <Button
          size="md"
          onClick={() => navigate(defaultLocation, { replace: true })}
        >
          返回直播档案
        </Button>
      </section>
    );
  } else if (apiView) {
    content = <ApiView />;
  } else {
    content = (
      <>
        {manifestState.error && (
          <section className="page-state">
            <h1>档案暂时无法加载</h1>
            <RequestError
              title="档案清单加载失败"
              message={manifestState.error}
              onRetry={() => setManifestAttempt((value) => value + 1)}
            />
          </section>
        )}
        {!manifest && !manifestState.error && (
          <section className="page-state" aria-busy="true">
            <h1>{viewTitles[route.view]}</h1>
            <SkeletonPlaceholder />
            <p role="status">正在加载档案清单…</p>
          </section>
        )}
        {manifest && route.view === "songs" && (
          <SongsView
            works={manifest.works}
            route={route}
            navigate={navigate}
            onOpenEvent={(event) =>
              navigate({
                view: "archive",
                year: event.date.slice(0, 4),
                month: Number(event.date.slice(5, 7)),
                date: event.date,
                eventId: event.eventId,
                member: "all",
                query: "",
              })
            }
          />
        )}
        {manifest && route.view === "archive" && (
          <ArchiveView
            manifest={manifest}
            route={{ ...route, year }}
            navigate={navigate}
            yearData={yearState.year === year ? yearState.events : []}
            loading={loading && !yearState.error}
            error={yearState.error}
            onRetry={() => setYearAttempt((value) => value + 1)}
          />
        )}
      </>
    );
  }
  return (
    <AppShell view={route.view} onChangeView={(view) => navigate({ view })}>
      {content}
    </AppShell>
  );
}

createRoot(document.getElementById("root")).render(<App />);
