# Elfofera API

EOE 时间线、作品和录播资料的只读查询 API。仓库只维护当前可发布资料和运行代码；整理过程、原始来源与历史批次保存在本机备份，不作为运行时依赖。

## 当前范围

- `data/calendar/confirmed/`：数据库导入使用的确认数据。
- `data/calendar/releases/`：发布快照。
- `src/`：Hono API、数据库连接、schema 和导入脚本。
- `docs/`：当前业务规则与修订流程。

数据覆盖事件、计划、表演、作品和录播。它是当前确认子集，不宣称历史零遗漏。歌曲主要来自明确切片、合集分 P 和多来源曲目资料；录播每场保留一个主要可用版本。

## 开发环境

```sh
nix develop
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 运行 Biome、TypeScript、测试和构建。Biome 只检查源码、测试和根目录配置，不格式化历史资料 JSON。

## 本地数据库

复制 `.env.example` 为 `.env.local`，使用独立的本地 PostgreSQL socket：

```sh
mkdir -p .local/pgsocket
initdb -D .local/postgres --auth-local=peer --auth-host=reject
pg_ctl -D .local/postgres -l "$PWD/.local/postgres.log" \
  -o "-k $PWD/.local/pgsocket -c listen_addresses=''" start
createdb elfofera
pnpm db:migrate
pnpm db:import:confirmed
```

`.local/`、`.env.local`、登录状态和研究资料备份均被 Git 忽略。应用默认监听 `127.0.0.1:3000`：

```sh
pnpm dev
curl --fail http://127.0.0.1:3000/health
```

## API

- `GET /health`
- `GET /v1/timeline?from=&through=&member=&include=`：聚合最多 31 天的事件、计划、表演、录播和日程变更
- `GET /v1/works?q=&artist=&limit=&offset=`：分页搜索歌曲或原唱
- `GET /v1/works/{workId}/history?from=&through=&member=&limit=&offset=`：分页查询已确认表演历史
- `GET /openapi.json`

AI 查询接口的参数、返回结构和示例见 [AI 查询接口](docs/ai-api.md)。

公开服务为 `https://elfofera.com`。生产版本、依赖打包、HTTPS 和 AstrBot 查询插件由
`ooaaqq/nixos-server-fleet` 管理；启动执行结构迁移，确认资料由应用命令显式导入。

当前导入命令覆盖确认目录中的 2022-07 至 2026-10 数据；范围由导入脚本的日期边界控制。

更新数据库结构和当前确认数据：

```sh
pnpm db:migrate
pnpm db:import:confirmed
```

更新最新资料时，先按 [最新数据更新规则](docs/design.md#最新数据更新) 检查组合及五位成员的动态、投稿和回放目录，再按实际缺口补查主要录播号与周报。采集不是自动任务；确认后更新数据、导入开发数据库并重新生成前端数据。

## 前端原型

```sh
pnpm frontend:dev
pnpm frontend:build
pnpm frontend:preview
```

前端使用确认数据生成静态展示数据，按年份拆分 JSON；首屏只加载默认年份，其他年份在切换时加载并缓存。页面支持年份与成员筛选、月份选择与单月日历、日期及场次选择、录播链接和内部滚动的完整表演清单。开发服务默认监听 `127.0.0.1:4173`。页面规范见 [EOE LIVE INDEX 设计规范](docs/live-index.md)。

生成数据位于 `frontend/public/data/`，不提交 Git；Vite 构建时自动复制到 `frontend/dist/data/`。完整前端发布产物为 `frontend/dist/`。生产构建预览监听 `127.0.0.1:4174`，需先运行 `pnpm frontend:build`。

## 数据备份

完整整理资料位于本机 `.local/calendar-backup-*/`，包括原始来源、evidence、候选和审查过程。它们用于查证和修订，不提交 Git。仓库中的当前数据保留必要的来源 URL、BV 号、日期和定位摘要，足以支持 API 使用和后续定向修订。

更多规则见 [设计说明](docs/design.md)、[EOE LIVE INDEX 设计规范](docs/live-index.md)、[数据说明](data/calendar/README.md) 和 [确认资料说明](data/calendar/confirmed/README.md)。
