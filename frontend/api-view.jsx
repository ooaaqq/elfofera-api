import { CodeSnippet, Link, Tag } from "@carbon/react";
import {
  DocumentationPage,
  DocumentationSection,
} from "./documentation-page.jsx";
import { members } from "./members.js";

const baseUrl = "https://elfofera.com";
const sections = [
  { id: "api-start", title: "开始查询" },
  { id: "api-timeline", title: "查询时间线" },
  { id: "api-works", title: "查找歌曲" },
  { id: "api-history", title: "读取表演历史" },
  { id: "api-statistics", title: "统计表演次数" },
  { id: "api-bun", title: "在 Bun 中调用" },
  { id: "api-records", title: "理解资料" },
  { id: "api-errors", title: "处理错误" },
];

function Example({ label, children }) {
  return (
    <div className="documentation-example">
      <p className="documentation-caption">{label}</p>
      <CodeSnippet
        type="multi"
        wrapText
        maxCollapsedNumberOfRows={0}
        maxExpandedNumberOfRows={0}
        copyButtonDescription="复制代码"
        aria-label={label}
        feedback="已复制"
      >
        {children}
      </CodeSnippet>
    </div>
  );
}

function Parameters({ rows, columns = ["参数", "取值", "说明"], caption }) {
  return (
    <section
      className="documentation-table-scroll"
      aria-label={caption}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: This overflow region supports keyboard scrolling.
      tabIndex={0}
    >
      <table className="documentation-table">
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
          {rows.map(([name, value, description]) => (
            <tr key={name}>
              <th scope="row">
                <code>{name}</code>
              </th>
              <td>{value}</td>
              <td>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Endpoint({ path }) {
  return (
    <div className="api-endpoint">
      <Tag type="blue">GET</Tag>
      <code>{path}</code>
    </div>
  );
}

export function ApiView({ route, navigate }) {
  return (
    <DocumentationPage
      title="API 使用说明"
      intro="通过只读接口查询 EOE 的时间线、歌曲和表演记录。从查找作品开始，按需读取历史或统计。"
      sections={sections}
      route={route}
      navigate={navigate}
    >
      <DocumentationSection {...sections[0]}>
        <p>所有接口使用 GET 请求，返回 JSON，无需 API Key。</p>
        <dl className="documentation-facts">
          <div>
            <dt>服务地址</dt>
            <dd>
              <code>{baseUrl}</code>
            </dd>
          </div>
          <div>
            <dt>日期格式</dt>
            <dd>
              <code>YYYY-MM-DD</code>，时区为 Asia/Shanghai。
            </dd>
          </div>
          <div>
            <dt>接口契约</dt>
            <dd>
              <Link href={`${baseUrl}/openapi.json`}>查看 OpenAPI JSON</Link>
            </dd>
          </div>
        </dl>
        <Example label="使用 curl 搜索歌曲">{`curl --fail --get '${baseUrl}/v1/works' \\
  --data-urlencode 'q=宝贝' \\
  --data-urlencode 'limit=20'`}</Example>
        <p>
          从 <code>items</code> 中核对歌名和 <code>originalArtists</code>
          ，再使用对应的 <code>id</code> 查询历史。同名作品可能有不同 ID。
        </p>
      </DocumentationSection>

      <DocumentationSection {...sections[1]}>
        <p>
          按日期查看事件、计划、录播、日程变更和表演。日期范围包含起止两天，最多
          31 天。
        </p>
        <Endpoint path="/v1/timeline" />
        <Parameters
          caption="时间线参数"
          rows={[
            [
              "from / through",
              "必填 · 日期",
              "范围起止日期，through 不早于 from。超过 31 天时分段查询。",
            ],
            [
              "member",
              "可选 · 成员代码",
              "省略时查询全部成员。成员代码见“理解资料”。",
            ],
            [
              "include",
              "可选 · 逗号分隔",
              "支持 events、plans、performances、recordings、changes。默认 events,plans,recordings,changes；查询歌单需加入 performances。分类不能重复。",
            ],
          ]}
        />
        <Example label="查询一周内露早的直播与曲目">{`curl --fail --get '${baseUrl}/v1/timeline' \\
  --data-urlencode 'from=2026-10-05' \\
  --data-urlencode 'through=2026-10-11' \\
  --data-urlencode 'member=luzao' \\
  --data-urlencode 'include=events,performances,recordings,changes'`}</Example>
        <p>
          <code>days</code>{" "}
          按日期排列，范围内的空日期也会返回。表演放在已关联事件的{" "}
          <code>performances</code> 中；没有关联事件或未请求 events
          时，放在当天的顶层 <code>performances</code>。录播提供{" "}
          <code>bvid</code> 和观看链接 <code>url</code>。
        </p>
      </DocumentationSection>

      <DocumentationSection {...sections[2]}>
        <p>按歌名或原唱查找作品。省略搜索词时，分页列出已收录作品。</p>
        <Endpoint path="/v1/works" />
        <Parameters
          caption="歌曲搜索参数"
          rows={[
            ["q", "可选 · 最多 200 字符", "匹配歌名或原唱。"],
            [
              "artist",
              "可选 · 最多 200 字符",
              "只匹配原唱；与 q 同时传入时，作品需同时满足两个条件。",
            ],
            ["limit", "可选 · 1–100", "每页条数，默认 20。"],
            ["offset", "可选 · 0–100000", "跳过的记录数，默认 0。"],
          ]}
        />
        <p>
          搜索会归一化全角半角、大小写、空白和标点，再进行字面包含匹配。搜索词不能仅由空白或标点组成。
        </p>
        <p>
          响应的 <code>items</code> 包含作品的 <code>id</code>、
          <code>title</code>、<code>originalArtists</code> 和{" "}
          <code>sourceUrls</code>；<code>total</code> 为命中的作品总数。
        </p>
      </DocumentationSection>

      <DocumentationSection {...sections[3]}>
        <p>使用歌曲搜索返回的作品 ID，读取已确认的表演记录。</p>
        <Endpoint path="/v1/works/{workId}/history" />
        <Parameters
          caption="表演历史参数"
          rows={[
            [
              "from / through",
              "可选 · 日期",
              "分别限制起止日期，包含两端，不受 31 天上限限制。",
            ],
            ["member", "可选 · 成员代码", "只匹配明确署名的表演成员。"],
            ["limit / offset", "可选 · 分页", "取值与歌曲搜索相同。"],
          ]}
        />
        <p>
          响应包含 <code>work</code> 和按日期从早到晚排列的 <code>items</code>
          。每条记录保留表演类型、成员或组合署名、关联事件和来源链接。
        </p>
        <div className="documentation-subsection">
          <h3>读取下一页</h3>
          <p>
            歌曲搜索和表演历史均返回 <code>total</code>、<code>limit</code>、
            <code>offset</code> 和 <code>hasMore</code>。当 <code>hasMore</code>{" "}
            为 true 时，以本页 <code>offset + items.length</code> 作为下一页的
            offset，直到返回 false。
          </p>
        </div>
      </DocumentationSection>

      <DocumentationSection {...sections[4]}>
        <p>只需要演出次数时，直接读取统计，无需遍历历史页。</p>
        <Endpoint path="/v1/works/{workId}/statistics" />
        <Parameters
          caption="表演统计参数"
          rows={[
            [
              "from / through",
              "可选 · 日期",
              "分别限制起止日期。不传时统计全部已确认记录。",
            ],
          ]}
        />
        <p>
          响应包含 <code>work</code>、<code>range</code>、总数{" "}
          <code>total</code>、无个人署名的记录数 <code>uncredited</code>{" "}
          和成员统计 <code>byMember</code>。此接口不分页，不接受 member 参数。
        </p>
        <p>
          一条表演记录计一次，多个来源不会增加次数。合唱分别计入明确署名的成员，因此成员次数之和可能大于总数。只有组合署名的记录计入
          uncredited，不自动分配给五位成员。
        </p>
      </DocumentationSection>

      <DocumentationSection {...sections[5]}>
        <p>
          将下面的代码保存为 <code>query.js</code>，运行{" "}
          <code>bun query.js</code> 查找作品。核对输出的作品 ID 后，可用{" "}
          <code>getStatistics</code> 读取统计。
        </p>
        <Example label="Bun · 搜索作品与读取统计">{`const base = '${baseUrl}';

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
}

// 核对作品 ID 后调用：
// console.log(await getStatistics('作品 ID'));`}</Example>
      </DocumentationSection>

      <DocumentationSection {...sections[6]}>
        <p>
          使用下列成员代码筛选。查询全部成员时省略 <code>member</code>，不要传入
          all。
        </p>
        <dl className="api-members">
          {Object.entries(members).map(([id, name]) => (
            <div key={id}>
              <dt>{name}</dt>
              <dd>
                <code>{id}</code>
              </dd>
            </div>
          ))}
        </dl>
        <div className="documentation-subsection">
          <h3>成员署名</h3>
          <p>
            事件按已确认参与、开播或计划成员筛选；表演只按{" "}
            <code>creditedMembers</code>{" "}
            筛选。开播账号、录播上传者和整场参与名单不代表逐曲演唱者。组合署名保留在{" "}
            <code>creditedGroup</code> 中。
          </p>
        </div>
        <div className="documentation-subsection">
          <h3>收录范围</h3>
          <p>
            <code>completeness: known-records</code>{" "}
            表示当前已确认的资料子集。空结果不能证明从未发生；计划、取消、改期和实际事件分别记录。引用资料时，使用返回的{" "}
            <code>sourceUrls</code> 或录播 <code>url</code>。
          </p>
        </div>
      </DocumentationSection>

      <DocumentationSection {...sections[7]}>
        <p>
          请求失败时，读取响应的 <code>error</code>{" "}
          字段，再按状态码处理。失败表示查询未完成。
        </p>
        <Parameters
          caption="错误状态码"
          columns={["状态码", "含义", "处理方式"]}
          rows={[
            [
              "400",
              "参数无效",
              "检查日期、范围、成员、分类和分页参数。未知参数也会被拒绝。",
            ],
            [
              "404",
              "资源不存在",
              "检查路径或作品 ID。作品不存在时返回 work_not_found。",
            ],
            ["500", "服务内部错误", "保留错误信息；不要将失败作为空结果使用。"],
          ]}
        />
        <div className="documentation-subsection">
          <h3>检查服务状态</h3>
          <p>
            <Link href={`${baseUrl}/health`}>GET /health</Link> 返回{" "}
            <code>{'{"service":"available"}'}</code>
            。服务在资料快照加载并校验成功后开始监听。
          </p>
        </div>
        <p>
          完整参数与响应字段见{" "}
          <Link href={`${baseUrl}/openapi.json`}>OpenAPI JSON</Link>。
        </p>
      </DocumentationSection>
    </DocumentationPage>
  );
}
