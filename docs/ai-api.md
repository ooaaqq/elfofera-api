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

事件的 `series` 返回已确认的节目系列名称，例如 `"萌妹玩游戏"`；没有系列关联时为 `null`。系列不替代单场标题或 `contentType`，同一系列可以包含游戏、杂谈和混合内容。

事件的 `guests` 返回已确认的外部嘉宾账号列表，每项含 `accountId`、`name`、`url`；没有已登记嘉宾时返回空数组。嘉宾与 EOE 成员分开记录，不依据联动参与者名单推断逐曲表演者。

事件的 `stages` 按顺序返回已确认的连续直播阶段，包含 `title`、`dimension`、
`titleHours` 和 `recordingBvids`；没有登记阶段时为空数组。阶段切换或断线重开
不增加直播场次。`titleHours` 来自录播标题，不表示精确开播时间；事件的
`dimension` 表示主要录播形态，完整切换过程参照阶段记录。

`member` 支持 `luzao`（露早）、`youen`（柚恩）、`yumo`（虞莫）、`waner`（莞儿）和
`minuo`（米诺）。事件按录播明确提及的成员、开播成员 `hostMember` 或计划成员筛选；这些身份在返回值中
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

## 表演次数统计

`GET /v1/works/{workId}/statistics` 返回 `work`、可选日期范围 `range`、
`total`、`uncredited` 和五位成员的 `byMember` 统计。支持 `from`、`through`，
不分页；查询次数直接读取统计，查询完整明细才翻历史页。

计数单位 `countingUnit: performance-record`：一条独立表演记录计一次，多个来源
不增加次数；合唱分别计入明确署名的成员，因此成员次数之和可能大于总数。
没有个人成员署名的记录计入 `uncredited`，不推断演唱者。只有组合署名的表演返回 `creditedGroup`，仍计入 `uncredited`，不自动展开为五人。没有组合署名时该字段为 `null`。`hostMember` 仅表示开播账号，不表示完整参与名单。各成员的 `sourceUrls` 最多
提供三个去重的来源示例，完整来源通过历史接口查看。统计只覆盖已确认资料。

## 回答规则

- `completeness: known-records` 表示已确认的子集；空结果不能证明从未直播或演唱。
- 计划、取消、改期和实际事件分别返回，不能把计划当作发生证据。
- 成员没有明确署名时保留未知，不从录播上传者或整场参与者推断歌曲演唱者。
- 回答可引用 `sourceUrls` 和录播 `url`（`eventIds` 保留合集关联的所有场次）。接口不返回本机 evidence 路径、研究摘录或完整来源原记录。
- 请求失败明确报告查询未完成；400 修正参数，404 核对作品 ID，不能把失败当成空结果。

AstrBot 插件消费本项目 `generated/tools.json`。工具字段、路由和限制由 Zod 请求定义生成，
模型调用与回答规则由 `src/tools.ts` 维护。fleet 只提供注册和 HTTP 传输。
HTTP 可选参数在工具中显式填 `null`；`null` 不发送为查询参数。

## 数据维护与检查

```sh
pnpm check
pnpm frontend:build
```

检查整个确认目录的结构、引用、日期聚合、署名筛选、来源、搜索和历史分页。
资料和前端随同一版本发布，不再单独导入。服务只在资料快照加载成功后监听。
