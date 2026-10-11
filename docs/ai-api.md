# AI 查询接口

接口是只读的，返回稳定的 JSON 结构。日期统一使用 `YYYY-MM-DD`，时间按资料中的 Asia/Shanghai 解释。

## 查询某天或某周

```text
GET /v1/timeline?from=2026-10-05&through=2026-10-11
```

`include` 可以限制查询内容，默认包含 `events,plans,performances,recordings,changes`：

```text
GET /v1/timeline?from=2026-10-09&through=2026-10-09&include=events,performances
```

返回按日期分组的 `days`。每一天包含 `events`、`plans`、`performances`、`recordings` 和 `changes` 数组。已关联事件的表演会在事件对象上附加 `performances`；没有 `eventId` 的表演保留在当天的顶层 `performances`，不会丢失。录播保留 `eventId`（如果已有可靠关联），无法关联时保持为空。

`days` 会包含范围内的每一个日期，即使当天没有记录也会返回空数组。单次范围最多 366 天。

每个对象仍保留数据库中的 `data` 字段，因此需要来源或完整原始字段时可以继续读取；聚合字段用于直接回答问题。

## 模糊搜索歌曲或原唱

```text
GET /v1/works?q=lemon
GET /v1/works?q=残酷
GET /v1/works?artist=米津玄師
```

`q` 会匹配歌名和原唱字段，`artist` 只匹配原唱。搜索会先做 NFKC、大小写、空白和标点归一化，再进行不区分大小写的包含匹配，适合不完整歌名和艺人名；不会把搜索结果误写成确定的别名关系。

结果默认最多 50 条，可使用 `limit` 和 `offset` 分页，`limit` 最大为 200。

## 查询一首歌唱过的时间

先使用 `/v1/works` 获取 `id`，再查询：

```text
GET /v1/works/song_xxx/history
```

响应包含作品信息和 `history`，每条记录提供演出日期、演出成员、表演形式以及关联直播事件。

也可以直接附带历史：

```text
GET /v1/works?q=Lemon&include=history
```

## 规范入口

```text
GET /openapi.json
```

AI 客户端应优先使用结构化参数，不需要先拼接自然语言查询。MCP 接入后复用这些接口和同一套业务函数，不另建一套数据规则。

数据库首次启用或更新确认数据时，先运行迁移，再运行导入：

```sh
pnpm db:migrate
pnpm db:import:confirmed
```

导入命令读取确认目录中 2022-07 至 2026-10 的数据。

## 数据库回归检查

在独立开发数据库执行迁移与全量导入后，用相同的 `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER` 环境变量运行：

```sh
pnpm test:integration
```

检查首播当天、整周日程变更、2026 年事件、未关联事件的表演、歌曲搜索归一化和完整演唱历史。测试只查询已有数据，不清空或写入数据库；全量导入会在事务中替换数据，只在独立开发数据库验证。
