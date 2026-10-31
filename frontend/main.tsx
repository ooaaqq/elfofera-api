import { Button } from "@react-spectrum/s2/Button";
import { Content } from "@react-spectrum/s2/Content";
import { Heading } from "@react-spectrum/s2/Heading";
import { InlineAlert } from "@react-spectrum/s2/InlineAlert";
import { Link } from "@react-spectrum/s2/Link";
import { ProgressCircle } from "@react-spectrum/s2/ProgressCircle";
import { Provider } from "@react-spectrum/s2/Provider";
import { SearchField } from "@react-spectrum/s2/SearchField";
import { StatusLight } from "@react-spectrum/s2/StatusLight";
import { Text } from "@react-spectrum/s2/Text";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { manifestQuery, statusQuery } from "./data";
import { serviceStatus } from "./status";
import "./spectrum.css";

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path === "/" ? "/archive" : path;
}
function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} onPress={() => navigate(href)}>
      {children}
    </Link>
  );
}
function Loading() {
  return <ProgressCircle aria-label="正在加载" isIndeterminate />;
}
function ErrorMessage() {
  return (
    <InlineAlert variant="negative">
      <Heading>加载失败</Heading>
      <Content>无法读取当前发布资料，请稍后重试。</Content>
    </InlineAlert>
  );
}
function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · EOE`;
  }, [title]);
  return (
    <main>
      <Heading level={1}>{title}</Heading>
      {children}
    </main>
  );
}
function Archive({ songs }: { songs: boolean }) {
  const query = useQuery(manifestQuery);
  const [search, setSearch] = useState("");
  const data = query.data;
  const records = useMemo(() => {
    if (!data) return [];
    const source = songs ? data.works : data.livestreams;
    const q = search.trim().toLocaleLowerCase();
    return source.filter((item) =>
      `${item.title} ${"artists" in item ? item.artists.join(" ") : item.members.join(" ")}`
        .toLocaleLowerCase()
        .includes(q),
    );
  }, [data, search, songs]);
  if (query.isLoading)
    return (
      <Page title={songs ? "歌曲档案" : "直播档案"}>
        <Loading />
      </Page>
    );
  if (query.isError || !data)
    return (
      <Page title="错误">
        <ErrorMessage />
      </Page>
    );
  return (
    <Page title={songs ? "歌曲档案" : "直播档案"}>
      <div>
        <SearchField label="搜索" value={search} onChange={setSearch} />
        <Text>{records.length} 条记录</Text>
        <div>
          {records.slice(0, 60).map((item) => (
            <section key={item.id}>
              <Heading level={2}>{item.title}</Heading>
              <Text>
                {"date" in item ? item.date : item.artists.join("、")}
              </Text>
            </section>
          ))}
        </div>
      </div>
    </Page>
  );
}
function statusVariant(state: ReturnType<typeof serviceStatus>["state"]) {
  if (state === "up") return "positive" as const;
  if (state === "down") return "negative" as const;
  return "neutral" as const;
}
function Status() {
  const query = useQuery(statusQuery);
  const now = Date.now();
  if (query.isLoading)
    return (
      <Page title="服务状态">
        <Loading />
      </Page>
    );
  if (query.isError || !query.data)
    return (
      <Page title="服务状态">
        <ErrorMessage />
      </Page>
    );
  return (
    <Page title="服务状态">
      <div>
        {query.data.map((endpoint) => {
          const state = serviceStatus(endpoint, now);
          return (
            <section key={endpoint.key}>
              <StatusLight variant={statusVariant(state.state)}>
                {endpoint.name}
              </StatusLight>
              <Text>
                {state.latest
                  ? new Date(state.latest.timestamp).toLocaleString("zh-CN")
                  : "暂无检查记录"}
              </Text>
            </section>
          );
        })}
      </div>
    </Page>
  );
}
function Documentation() {
  return (
    <Page title="API 使用说明">
      <div>
        <Heading level={2}>只读查询 API</Heading>
        <Text>接口契约由 Rust 构建程序生成，前端只读取已校验的发布快照。</Text>
        <pre>
          <code>GET /v1/timeline?from=2024-01-01&amp;through=2024-01-31</code>
        </pre>
        <Button onPress={() => navigate("/archive")}>浏览档案</Button>
      </div>
    </Page>
  );
}
function App() {
  const path = useRoute();
  let content = <Archive songs={false} />;
  if (path === "/songs") content = <Archive songs />;
  if (path === "/api") content = <Documentation />;
  if (path === "/status") content = <Status />;
  return (
    <Provider locale="zh-CN">
      <div>
        <nav aria-label="主导航">
          <Heading level={2}>EOE 档案</Heading>
          <NavLink href="/archive">直播档案</NavLink>
          <NavLink href="/songs">歌曲档案</NavLink>
          <NavLink href="/api">API 使用说明</NavLink>
          <NavLink href="/status">服务状态</NavLink>
        </nav>
        {content}
      </div>
    </Provider>
  );
}

export default App;
