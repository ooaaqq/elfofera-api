import { CodeSnippet, Link, Tag } from "@carbon/react";

const baseUrl = "https://elfofera.com";

function Example({ children }) {
  return (
    <CodeSnippet
      type="multi"
      wrapText
      maxCollapsedNumberOfRows={0}
      maxExpandedNumberOfRows={0}
      copyButtonDescription="复制代码"
      aria-label="复制代码"
      feedback="已复制"
    >
      {children}
    </CodeSnippet>
  );
}

function Parameters({
  rows,
  columns = ["参数", "要求", "说明"],
  caption = "查询参数",
}) {
  return (
    <table className="api-parameters">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, requirement, description]) => (
          <tr key={name}>
            <th scope="row">
              <code>{name}</code>
            </th>
            <td>{requirement}</td>
            <td>{description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Endpoint({ id, path, title, children }) {
  return (
    <section id={id} className="api-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <div className="api-endpoint">
        <Tag type="blue">GET</Tag>
        <code>{path}</code>
      </div>
      {children}
    </section>
  );
}

export function ApiView() {
  return (
    <article className="api-page" aria-labelledby="api-title">
      <header className="api-intro">
        <h1 id="api-title">API 使用说明</h1>
        <p>查询 EOE 的时间线、作品、录播和已确认表演记录。</p>
        <div className="api-links">
          <code>{baseUrl}</code>
          <Link href={`${baseUrl}/openapi.json`}>OpenAPI JSON</Link>
          <Link href={`${baseUrl}/health`}>服务状态</Link>
        </div>
      </header>

      <section className="api-section" aria-labelledby="api-start-title">
        <h2 id="api-start-title">快速开始</h2>
        <p>
          接口均为只读 GET 请求，无需 API Key，返回 JSON。日期使用
          YYYY-MM-DD，时区为 Asia/Shanghai。
        </p>
        <Example>{`curl --fail --get '${baseUrl}/v1/works' \\\n  --data-urlencode 'q=宝贝' \\\n  --data-urlencode 'limit=20'`}</Example>
        <p>
          先从搜索结果的 <code>items</code> 中核对歌名和{" "}
          <code>originalArtists</code>，再用对应的 <code>id</code>{" "}
          查询历史或统计。同名作品可能有不同 ID。
        </p>
      </section>

      <Endpoint id="api-timeline" path="/v1/timeline" title="时间线">
        <p>
          按日期聚合事件、计划、录播、日程变更和表演。范围包含起止两天，最多 31
          天；更长范围请分段查询。
        </p>
        <Parameters
          rows={[
            ["from", "必填", "起始日期。"],
            ["through", "必填", "结束日期，不早于起始日期。"],
            ["member", "可选", "成员代码，省略时查询全部成员。"],
            [
              "include",
              "可选",
              "逗号分隔：events、plans、performances、recordings、changes。默认 events,plans,recordings,changes；歌单需显式加入 performances。不能重复分类。",
            ],
          ]}
        />
        <Example>{`curl --fail --get '${baseUrl}/v1/timeline' \\\n  --data-urlencode 'from=2026-10-05' \\\n  --data-urlencode 'through=2026-10-11' \\\n  --data-urlencode 'member=luzao' \\\n  --data-urlencode 'include=events,performances,recordings,changes'`}</Example>
        <p>
          响应的 <code>days</code>{" "}
          按日期排列，空日期也返回。表演优先放在关联事件的{" "}
          <code>performances</code> 中；无关联事件或未请求 events
          时，放在当天的顶层 <code>performances</code>。录播提供{" "}
          <code>bvid</code> 和 <code>url</code>。
        </p>
      </Endpoint>

      <Endpoint id="api-works" path="/v1/works" title="歌曲搜索">
        <Parameters
          rows={[
            ["q", "可选", "匹配歌名或原唱，最多 200 字符。"],
            [
              "artist",
              "可选",
              "只匹配原唱，最多 200 字符；与 q 同时传入时需同时满足。",
            ],
            ["limit", "可选", "每页 1–100 条，默认 20。"],
            ["offset", "可选", "跳过的记录数，0–100000，默认 0。"],
          ]}
        />
        <p>
          搜索会归一化全角半角、大小写、空白和标点后进行字面包含匹配；关键词不能仅由空白或标点组成。省略
          q 和 artist 时分页列出作品。
        </p>
        <p>
          响应包含 <code>items</code>、<code>total</code>、<code>limit</code>、
          <code>offset</code>、<code>hasMore</code> 和 <code>completeness</code>
          ；作品包含 id、title、originalArtists 和 sourceUrls。total
          为匹配作品数。
        </p>
      </Endpoint>

      <Endpoint
        id="api-history"
        path="/v1/works/{workId}/history"
        title="表演历史"
      >
        <p>
          将路径中的 <code>{"{workId}"}</code> 替换为歌曲搜索返回的真实作品 ID。
        </p>
        <Parameters
          rows={[
            [
              "from / through",
              "可选",
              "分别限制起止日期，包含两端；不受时间线的 31 天上限限制。",
            ],
            ["member", "可选", "仅匹配明确署名的表演成员。"],
            ["limit / offset", "可选", "与歌曲搜索相同的分页参数。"],
          ]}
        />
        <p>
          响应包含 <code>work</code>、<code>items</code>{" "}
          和分页字段。记录按日期从早到晚排列，保留
          type、creditedMembers、creditedGroup、event 和 sourceUrls。total
          为当前筛选下的表演记录数。
        </p>
        <p>
          <code>hasMore</code> 为 true 时，下一页 offset = 本页 offset +
          items.length。需要完整历史时继续分页；只需要次数时使用统计接口。
        </p>
      </Endpoint>

      <Endpoint
        id="api-statistics"
        path="/v1/works/{workId}/statistics"
        title="表演次数统计"
      >
        <Parameters
          rows={[
            [
              "from / through",
              "可选",
              "分别限制起止日期，包含两端；不传时统计全部已确认记录。",
            ],
          ]}
        />
        <p>
          响应包含 <code>work</code>、<code>range</code>、<code>total</code>、
          <code>uncredited</code> 和 <code>byMember</code>，不分页，不支持
          member 参数。
        </p>
        <p>
          计数单位为
          performance-record：一条表演记录计一次，多个来源不重复计数。合唱分别计入明确署名成员，成员次数之和可能大于
          total；没有个人署名的记录计入 uncredited。
        </p>
      </Endpoint>

      <section className="api-section" aria-labelledby="api-js-title">
        <h2 id="api-js-title">JavaScript 示例</h2>
        <p>
          Node.js 中搜索作品，再读取指定作品的统计。示例打印候选 ID，核对后传给
          getStatistics。
        </p>
        <Example>{`const base = '${baseUrl}';

async function getJson(path) {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error('API 请求失败：' + response.status);
  }
  return response.json();
}

const query = new URLSearchParams({ q: '宝贝', limit: '20' });
const results = await getJson('/v1/works?' + query);
console.log(results.items);

async function getStatistics(workId) {
  return getJson('/v1/works/' + encodeURIComponent(workId) + '/statistics');
}`}</Example>
      </section>

      <section className="api-section" aria-labelledby="api-members-title">
        <h2 id="api-members-title">成员与资料含义</h2>
        <dl className="api-members">
          <div>
            <dt>露早</dt>
            <dd>
              <code>luzao</code>
            </dd>
          </div>
          <div>
            <dt>柚恩</dt>
            <dd>
              <code>youen</code>
            </dd>
          </div>
          <div>
            <dt>虞莫</dt>
            <dd>
              <code>yumo</code>
            </dd>
          </div>
          <div>
            <dt>莞儿</dt>
            <dd>
              <code>waner</code>
            </dd>
          </div>
          <div>
            <dt>米诺</dt>
            <dd>
              <code>minuo</code>
            </dd>
          </div>
        </dl>
        <p>
          查询全部成员时省略 member，不传
          all。事件按已确认参与、开播或计划成员筛选；表演只按 creditedMembers
          筛选，开播账号和录播上传者不代表演唱者。只有组合署名时保留
          creditedGroup，不自动展开为五位成员。
        </p>
        <p>
          <code>completeness: known-records</code>{" "}
          表示当前已确认资料，空结果不能证明从未发生。计划、取消、改期和实际事件分别记录；引用结果时可使用
          sourceUrls 和录播 url。
        </p>
      </section>

      <section className="api-section" aria-labelledby="api-errors-title">
        <h2 id="api-errors-title">错误处理</h2>
        <Parameters
          columns={["状态码", "含义", "处理"]}
          caption="错误响应"
          rows={[
            [
              "400",
              "参数错误",
              "检查日期、范围、成员、include、分页及未知参数；响应 error 包含原因。",
            ],
            [
              "404",
              "资源不存在",
              "核对路径或作品 ID，作品不存在时 error 为 work_not_found。",
            ],
            ["500", "服务错误", "查询未完成，不能作为空结果使用。"],
            [
              "503",
              "健康检查失败",
              "GET /health 返回 database: unavailable，表示数据库不可用。",
            ],
          ]}
        />
        <p>
          完整参数和响应字段见{" "}
          <Link href={`${baseUrl}/openapi.json`}>OpenAPI JSON</Link>。
        </p>
      </section>
    </article>
  );
}
