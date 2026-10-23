# Elfofera API

EOE 时间线、作品和录播资料的只读查询 API。仓库只维护当前可发布资料和运行代码；整理过程、原始来源与历史批次保存在本机备份，不作为运行时依赖。

## 当前范围

- `data/calendar/confirmed/`：构建使用的确认资料。
- `data/calendar/releases/`：发布快照。
- `src/`：资料模型、关联索引、查询、Hono 接口和构建入口。
- `docs/`：当前业务规则与修订流程。

数据覆盖事件、计划、表演、作品和录播。它是当前确认子集，不宣称历史零遗漏。歌曲主要来自明确切片、合集分 P 和多来源曲目资料；录播每场保留一个主要可用版本。

## 开发环境

```sh
nix develop /path/to/infra
cd /path/to/elfofera-api
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 运行 Biome、TypeScript、测试和构建。Biome 只检查源码、测试和根目录配置，不格式化历史资料 JSON。

## 资料构建与运行

`pnpm build` 读取整个确认目录，通过 Zod 校验资料与关联，生成 `dist/archive.json`
和 `generated/tools.json`。范围来自资料本身，不另设导入日期边界。API 启动时加载并校验
只读快照、建立内存索引后才监听；无数据库服务、运行时导入或状态迁移。

```sh
pnpm build
pnpm start
curl --fail http://127.0.0.1:3000/health
```

`.local/`、登录状态和研究备份均被 Git 忽略。应用监听 `127.0.0.1:3000`。
`src/records.ts` 定义确认资料，`data.ts` 负责读取和关联校验，`queries.ts` 维护查询，
`views.ts` 负责公开字段投影，`contracts.ts` 和 `routes.ts` 定义响应与 HTTP 输入。
前端静态数据从同一索引生成；页面只负责展示与交互。

## API

- `GET /health`
- `GET /v1/timeline?from=&through=&member=&include=`：聚合最多 31 天的事件、计划、表演、录播和日程变更
- `GET /v1/works?q=&artist=&limit=&offset=`：分页搜索歌曲或原唱
- `GET /v1/works/{workId}/history?from=&through=&member=&limit=&offset=`：分页查询已确认表演历史
- `GET /openapi.json`

AI 查询接口的参数、返回结构和示例见 [AI 查询接口](docs/ai-api.md)。

公开服务为 `https://elfofera.com`。生产版本、依赖打包、HTTPS 和 AstrBot 查询插件由
`ooaaqq/nixos-server-fleet` 管理。确认资料、API 和前端作为同一个版本发布，
更新固定源码版本即可发布新资料。

`src/tools.ts` 从 HTTP 请求的同一份 Zod 定义导出四个 AstrBot 工具契约，
可选 HTTP 参数转换为显式 nullable 工具参数；`generated/tools.json` 是构建生成文件，
测试核对其与定义一致。插件只维护工具注册和 HTTP 传输，不重复维护字段规则。

更新资料时按 [最新数据更新规则](docs/design.md#最新数据更新) 核对动态、投稿与回放，
然后运行 `pnpm check` 和 `pnpm frontend:build`，验证实际日期与关联。

## 前端

```sh
pnpm frontend:dev
pnpm frontend:build
pnpm frontend:preview
```

前端使用官方 Carbon React 组件、Gray 10 主题、UI Shell SideNav 与 IBM Plex 字体。侧栏提供直播档案、歌曲档案和 API 使用说明；确认数据生成按年份拆分的静态 JSON，并在清单中提供全局直播摘要和作品索引。直播档案支持年月与成员筛选、跨年份标题搜索、月历/按日列表、场次与日程变更、录播和完整表演清单；歌曲档案支持歌曲/原唱搜索分页、全部年份的完整演出记录、年份/成员筛选及跨年份场次跳转。浅色外壳提供响应式布局与移动端详情返回，URL 保存筛选和选择，支持刷新与浏览器前进后退。开发服务默认监听 `127.0.0.1:4173`。页面规范见 [EOE LIVE INDEX 设计规范](docs/live-index.md)。

生成数据位于 `frontend/public/data/`，不提交 Git；Vite 构建时自动复制到 `frontend/dist/data/`。完整前端发布产物为 `frontend/dist/`。生产构建预览监听 `127.0.0.1:4174`，需先运行 `pnpm frontend:build`。

## 数据备份

完整整理资料位于本机 `.local/calendar-backup-*/`，包括原始来源、evidence、候选和审查过程。它们用于查证和修订，不提交 Git。仓库中的当前数据保留必要的来源 URL、BV 号、日期和定位摘要，足以支持 API 使用和后续定向修订。

更多规则见 [设计说明](docs/design.md)、[EOE LIVE INDEX 设计规范](docs/live-index.md)、[数据说明](data/calendar/README.md) 和 [确认资料说明](data/calendar/confirmed/README.md)。
