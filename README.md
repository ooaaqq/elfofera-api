# Elfofera API

EOE 时间线、作品和录播资料的只读查询 API。仓库只维护当前可发布资料和运行代码；整理过程、原始来源与历史批次保存在本机备份，不作为运行时依赖。

## 当前范围

- `data/calendar/confirmed/`：构建使用的确认资料。
- `data/calendar/releases/`：发布快照。
- `rust/`：资料模型、关联索引、查询、Axum 接口和构建入口。
- `docs/`：当前业务规则与修订流程。

数据覆盖事件、计划、表演、作品和录播。它是当前确认子集，不宣称历史零遗漏。歌曲主要来自明确切片、合集分 P 和多来源曲目资料；录播每场保留一个主要可用版本。

## 开发环境

JavaScript 工具链统一使用 `.bun-version` 指定的 Bun，依赖锁为 `bun.lock`。Bun 负责依赖安装、脚本运行和原生测试；Vite、TypeScript 与 Biome 也通过 Bun 启动。Rust 负责 API 与资料构建。

```sh
nix develop /path/to/infra
cd /path/to/elfofera-api
bun install --frozen-lockfile
bun run check
```

`scripts/check.sh` 在本仓库安装锁定的前端依赖并执行 `bun run check`；检查与发布独立于 fleet。

`bun run check` 运行 Rust 格式、严格 Clippy、行为测试，以及前端 Biome、TypeScript、Bun 测试和构建。Biome 只检查源码、测试和根目录配置，不格式化历史资料 JSON。依赖无需安装脚本，`trustedDependencies` 保持为空。

## 资料构建与运行

`bun run build` 读取整个确认目录，通过 Rust 类型与 JSON Schema 校验资料及关联，生成 `dist/archive.json`、`dist/openapi.json`
和 `dist/tools.json`。范围来自资料本身，不另设导入日期边界。API 启动时加载并校验
只读快照、建立内存索引后才监听；无数据库服务、运行时导入或状态迁移。

```sh
bun run build
bun run start
curl --fail http://127.0.0.1:3000/health
```

`.local/`、登录状态和研究备份均被 Git 忽略。应用监听 `127.0.0.1:3000`。
`rust/model.rs` 定义确认资料，`data.rs` 读取与校验关联并预先建立日期与关联索引、搜索文本和中文排序；
`queries.rs` 查询，`views.rs` 投影公开字段。`contract.rs` 的 Rust 输入类型同时用于请求校验、OpenAPI 和工具契约。
前端构建只读取这份已校验快照，不再重复导入和验证原始资料。生产后端是独立 Rust 可执行程序与只读快照，不携带 Bun 或前端依赖。

## API

- `GET /health`
- `GET /v1/timeline?from=&through=&member=&include=`：聚合最多 31 天的事件、计划、表演、录播和日程变更
- `GET /v1/works?q=&artist=&limit=&offset=`：分页搜索歌曲或原唱
- `GET /v1/works/{workId}/history?from=&through=&member=&limit=&offset=`：分页查询已确认表演历史
- `GET /openapi.json`

AI 查询接口的参数、返回结构和示例见 [AI 查询接口](docs/ai-api.md)。

公开服务为 `https://elfofera.com`。应用仓库构建并发布 API、确认资料、前端和契约的同一版本；
`ooaaqq/nixos-server-fleet` 只锁定 release、配置 HTTPS 和 AstrBot 查询插件。

`rust/contract.rs` 导出四个 AstrBot 工具契约，可选 HTTP 参数转换为显式 nullable 工具参数。
`elfofera-api contract --output <目录>` 独立生成契约、OpenAPI 和成员映射，不读取确认资料。`bun run build` 同时生成资料快照与契约。

`dist/tools.json` 是构建产物，不提交 Git；fleet 插件直接消费同一个 release 的产物，避免手工副本。
插件只维护工具注册和 HTTP 传输，不重复维护字段规则。

更新资料时按 [最新数据更新规则](docs/design.md#最新数据更新) 核对动态、投稿与回放，
然后运行 `bun run check`，验证实际日期与关联。

## 前端

```sh
# 首次开发或资料变更时生成数据
bun run build && bun run frontend:data
# 页面开发直接启动，不再重复生成资料
bun run frontend:dev
bun run frontend:build
bun run frontend:preview
```

前端使用 React Spectrum 2（S2）组件和官方 token；路由使用原生 History API，只维护当前路径。当前界面提供直播档案、歌曲档案、API 使用说明和服务状态四个只读入口，搜索只作用于当前发布快照。开发服务默认监听 `127.0.0.1:4173`。页面规范见 [前端设计与约束](docs/frontend-design.md)。

生成数据位于 `frontend/public/data/`，不提交 Git；Vite 构建时自动复制到 `frontend/dist/data/`。完整前端发布产物为 `frontend/dist/`。生产构建预览监听 `127.0.0.1:4174`，需先运行 `bun run frontend:build`。

### 服务状态预览

`/status` 展示所有已接入的公开服务状态，使用 Spectrum 2 的 Provider 和组件样式。页面每 30 秒读取同域
`/status-api/endpoints/statuses`，展示当前状态和最近检查历史。超过 3 分钟的探测数据或状态接口请求失败均标记为未知。

本地通过 Vite 代理接入 Gatus，监控地址只供开发服务器使用，不进入浏览器构建：

```sh
STATUS_BACKEND_URL=http://your-monitor:3001 bun run frontend:dev
```

Vite 提供页面热更新。Gatus 探测与存储、生产同域只读接口转发由 infra 管理，应用不运行自己的探测任务。
infra 的 Caddy 配置将该只读 GET 接口转发到同机 Gatus；随下次 infra 部署生效。

## 数据备份

完整整理资料位于本机 `.local/calendar-backup-*/`，包括原始来源、evidence、候选和审查过程。它们用于查证和修订，不提交 Git。仓库中的当前数据保留必要的来源 URL、BV 号、日期和定位摘要，足以支持 API 使用和后续定向修订。

更多规则见 [设计说明](docs/design.md)、[前端设计与约束](docs/frontend-design.md)、[数据说明](data/calendar/README.md) 和 [确认资料说明](data/calendar/confirmed/README.md)。

## 发布

保持 Cargo.toml、Cargo.lock 和 package.json 的版本一致，提交后推送 `vX.Y.Z` tag。
GitHub Actions 使用稳定 Rust 和 `.bun-version` 指定的 Bun，运行全部检查后复用资料、契约和前端产物，生成
`elfofera-api-X.Y.Z-x86_64-linux.tar.gz` 和 SHA-256，再创建 GitHub Release。
包内包含 `bin/elfofera-api`、`share/elfofera-api/archive.json`、`frontend/` 和 `contract/`；
前端和契约均位于 `share/elfofera-api/` 下。包面向 Ubuntu 24.04 glibc，消费方适配加载器。
发布 tag 和资产不覆盖，修正时递增版本。生产只消费已发布资产，不从源码构建。

依赖更新由 `renovate.json` 配置：Bun 依赖与锁文件、Bun 运行时、Cargo 和 Actions；Spectrum 2 只接受显式版本更新，升级前核对官方迁移文档。仓库需在 Renovate 的安装范围内，配置文件本身不会启动机器人。
