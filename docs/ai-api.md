# 查询接口

公开入口为 `https://elfofera.com`，只提供查询。`GET /openapi.json` 描述参数与响应
schema，`GET /health` 检查应用和数据库连接。日期统一使用真实的 `YYYY-MM-DD`，
按 Asia/Shanghai 解释。

## 时间线

```text
GET /v1/timeline?from=2026-10-05&through=2026-10-11
GET /v1/timeline?from=2026-10-09&through=2026-10-09&member=luzao&include=events,performances,recordings
```

日期范围包含两端，最多 31 天。`include` 支持 `events,plans,performances,recordings,changes`，
默认包含 `events,plans,recordings,changes`；逐曲歌单需要显式请求 `performances`。
未知或重复分类、无效日期及逆序范围返回 400。

响应包含 `range`、`timeZone`、`included`、`completeness` 和按日期排列的 `days`。
范围内空日期也会返回。事件附带已关联表演；未关联事件或没有请求事件时，表演放在
当天的顶层 `performances`。录播保留 BV、直接观看链接和可靠关联的事件 ID。

`member` 支持 `luzao`（露早）、`youen`（柚恩）、`yumo`（虞莫）、`waner`（莞儿）和
`minuo`（米诺）。事件按录播明确提及的成员或计划成员筛选；两类成员在返回值中
分别保留。表演只按明确的 `creditedMembers` 筛选，不从整场参与者或上传者推断
演唱身份。计划仅保留匹配的场次，录播仅保留有匹配事件关联的记录。成员筛选可能
排除身份尚不明确的资料。

## 歌曲搜索

```text
GET /v1/works?q=Lemon&limit=20&offset=0
GET /v1/works?artist=米津玄師
```

`q` 匹配歌名和原唱，`artist` 只匹配原唱。搜索使用 NFKC、大小写、空白和标点
归一化后的字面包含匹配。关键词最多 200 字符，不能仅由标点或空白组成。
同名不同作品保留独立 ID；先核对原唱和来源，再查询对应的演唱历史。

## 演唱与表演历史

使用歌曲搜索返回的真实作品 ID：

```text
GET /v1/works/song_xxx/history?limit=20&offset=0
GET /v1/works/song_xxx/history?from=2022-07-24&through=2023-12-31&member=youen
```

响应包含 `work`、表演 `items`，每条保留日期、表演类型、明确署名成员、关联
事件及来源链接。`from`、`through` 和 `member` 可选；不存在的作品返回 404。

搜索与历史都返回 `total`、`limit`、`offset`、`hasMore` 和 `completeness`。
默认每页 20 条，最多 100 条。稳定排序后分页，下一页的 offset 为本页 offset
加实际返回条数。未翻完页时不能声称已列出全部历史；搜索接口不嵌入无界历史。

## 回答规则

- `completeness: known-records` 表示已确认的子集；空结果不能证明从未直播或演唱。
- 计划、取消、改期和实际事件分别返回，不能把计划当作发生证据。
- 成员没有明确署名时保留未知，不从录播上传者或整场参与者推断歌曲演唱者。
- 回答可引用 `sourceUrls` 和录播 `url`。接口不返回本机 evidence 路径、研究摘录或数据库 raw data。
- 请求失败明确报告查询未完成；400 修正参数，404 核对作品 ID，不能把失败当成空结果。

AstrBot 插件复用这三个接口，工具描述维护模型调用与回答规则。插件实现和服务器部署
由 infra fleet 管理，业务筛选与数据含义只在本项目维护。

## 数据维护与检查

独立开发数据库执行迁移和确认资料导入：

```sh
pnpm db:migrate
pnpm db:import:confirmed
pnpm test:integration
```

检查日期聚合、成员筛选、来源链接、歌名归一化和历史分页。全量导入在事务中替换
查询资料，生产导入由 fleet 的应用命令显式执行，部署不自动覆盖数据。
