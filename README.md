# Elfofera API

EOE 时间线、作品和录播资料的只读查询 API。仓库只维护当前可发布资料和运行代码；整理过程、原始来源与历史批次保存在本机备份，不作为运行时依赖。

## 当前范围

- `data/calendar/confirmed/`：构建使用的确认资料。
- `dist/`：生成的快照、契约和发布包，不提交 Git。
- `rust/`：资料模型、关联索引、查询、Axum 接口和构建入口。
- `docs/`：当前业务规则与修订流程。

数据覆盖事件、计划、表演、作品和录播。它是当前确认子集，不宣称历史零遗漏。歌曲主要来自明确切片、合集分 P 和多来源曲目资料；录播每场保留一个主要可用版本。

## 开发环境

Rust 负责资料编译、查询、HTTP、契约和测试，依赖由 `Cargo.lock` 固定。应用版本只声明在 `Cargo.toml`。仓库的 `.envrc` 使用相邻 `../../infra` 仓库的 `applications` 开发环境。

```sh
nix develop /path/to/infra#applications
./scripts/check.sh
```

`scripts/check.sh` 运行 Rust 格式、严格 Clippy、集成测试和全量资料构建；检查与发布独立于 fleet。

## 资料构建与运行

`cargo run --locked -- build` 读取整个确认目录，通过严格 Rust 类型与业务规则校验资料及关联，生成 `dist/archive.json`、`dist/openapi.json`
、`dist/tools.json` 和 `dist/members.json`。范围来自资料本身，不另设导入日期边界。API 启动时加载并校验
只读快照、建立内存索引后才监听；无数据库服务、运行时导入或状态迁移。

```sh
cargo run --locked -- build
cargo run --locked --release -- serve --snapshot dist/archive.json
curl --fail http://127.0.0.1:3000/health
```

`.local/`、登录状态和研究备份均被 Git 忽略。默认监听 `127.0.0.1:3000`，可用 `serve --listen <地址:端口>` 显式指定。信号处理器和快照就绪后才监听，SIGINT／SIGTERM 触发最长 10 秒的优雅退出。
`rust/model.rs` 定义确认资料，`data.rs` 读取与校验关联并预先建立日期与关联索引、搜索文本和中文排序；
`queries.rs` 查询，`views.rs` 投影公开字段。`contract.rs` 的 Rust 输入类型同时用于请求校验、OpenAPI 和工具契约。

## API

- `GET /health`
- `GET /v1/timeline?from=&through=&member=&include=`：聚合最多 31 天的事件、计划、表演、录播和日程变更
- `GET /v1/works?q=&artist=&limit=&offset=`：分页搜索歌曲或原唱
- `GET /v1/works/{workId}/history?from=&through=&member=&limit=&offset=`：分页查询已确认表演历史
- `GET /v1/works/{workId}/statistics?from=&through=`：查询作品总次数与各成员署名次数
- `GET /openapi.json`

AI 查询接口的参数、返回结构和示例见 [AI 查询接口](docs/ai-api.md)。

公开服务为 `https://elfofera.com`。应用仓库构建并发布 API、确认资料和契约的同一版本；
`ooaaqq/nixos-server-fleet` 只锁定 release、配置 HTTPS 和 AstrBot 查询插件。

`rust/contract.rs` 导出四个 AstrBot 工具契约，可选 HTTP 参数转换为显式 nullable 工具参数。
`elfofera-api contract --output <目录>` 独立生成契约、OpenAPI 和成员映射，不读取确认资料。`cargo run --locked -- build` 同时生成资料快照与契约。

`dist/tools.json` 是构建产物，不提交 Git；fleet 插件直接消费同一个 release 的产物，避免手工副本。
插件只维护工具注册和 HTTP 传输，不重复维护字段规则。

更新资料时按 [最新数据更新规则](docs/design.md#最新数据更新) 核对动态、投稿与回放，
然后运行 `./scripts/check.sh`，验证实际日期与关联。

## 数据备份

完整整理资料位于本机 `.local/calendar-backup-*/`，包括原始来源、evidence、候选和审查过程。它们用于查证和修订，不提交 Git。仓库中的当前数据保留必要的来源 URL、BV 号、日期和定位摘要，足以支持 API 使用和后续定向修订。

更多规则见 [设计说明](docs/design.md)、[数据说明](data/calendar/README.md) 和 [确认资料说明](data/calendar/confirmed/README.md)。

## 发布

在 `Cargo.toml` 声明应用版本，提交后推送与版本一致的 `vX.Y.Z` tag。
GitHub Actions 使用稳定 Rust，运行全部检查后由待打包的发布二进制生成资料和契约，生成
`elfofera-api-X.Y.Z-x86_64-linux.tar.gz` 和 SHA-256，再创建 GitHub Release。
包内包含 `bin/elfofera-api`、`share/elfofera-api/archive.json` 和 `contract/`；
契约位于 `share/elfofera-api/` 下。包面向 Ubuntu 24.04 glibc，消费方适配加载器。
发布 tag 和资产不覆盖，修正时递增版本。生产只消费已发布资产，不从源码构建。

依赖由用户按需统一维护，使用 Cargo 和 Nix 原生工具，覆盖 Rust 依赖、锁文件、工具链和 Actions。默认跟进最新正式版，跨主版本升级同步调整调用方和配置；部署版本与哈希保持锁定。
