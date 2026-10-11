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
pnpm db:import:2022-2023
```

`.local/`、`.env.local`、登录状态和研究资料备份均被 Git 忽略。应用默认监听 `127.0.0.1:3000`：

```sh
pnpm dev
curl --fail http://127.0.0.1:3000/health
```

## API

- `GET /health`
- `GET /events?from=&through=`
- `GET /works`
- `GET /performances?eventId=&workId=`
- `GET /plans?from=&through=`
- `GET /openapi.json`

当前导入命令覆盖 2022-07 至 2023-12；后续年份的数据文件可以继续扩展导入范围。

## 数据备份

完整整理资料位于本机 `.local/calendar-backup-*/`，包括原始来源、evidence、候选和审查过程。它们用于查证和修订，不提交 Git。仓库中的当前数据保留必要的来源 URL、BV 号、日期和定位摘要，足以支持 API 使用和后续定向修订。

更多规则见 [设计说明](docs/design.md)、[数据说明](data/calendar/README.md) 和 [确认资料说明](data/calendar/confirmed/README.md)。
