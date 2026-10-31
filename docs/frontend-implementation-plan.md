# Spectrum 2 前端实施计划

这份计划面向后续实施 agent。当前提交 `977eac0` 已经完成基础迁移：旧 Carbon 页面和样式全部删除，应用入口改为 React Spectrum 2，数据契约和纯查询逻辑保留。后续工作是在这个干净基线上逐页恢复业务能力，不恢复旧页面结构。

## 目标

把 Elfofera API 做成一个严格、只读、低自由度的资料浏览器：

- 所有可见交互使用 Spectrum 2 组件和其默认行为。
- 所有页面只读取构建后的发布快照或状态代理，不读取 `.local`、Cookie、原始证据或后端内部字段。
- Rust 资料模型、生成脚本和前端 Zod 契约保持单一数据边界。
- 页面结构简单，组件数量少，删除历史兼容层、旧路由和自定义视觉实现。
- 失败直接可见；不加全局 retry、猜测值、隐藏 fallback 或自建状态机。

## 当前基线

当前入口在 `frontend/main.tsx`，包含四条路径：

- `/archive`：直播资料搜索的最小入口。
- `/songs`：歌曲资料搜索的最小入口。
- `/api`：API 使用说明。
- `/status`：Gatus 只读状态展示。

当前纯数据代码保存在：

- `frontend/data.ts`
- `frontend/data-contract.ts`
- `frontend/records.ts`
- `frontend/members.ts`
- `frontend/video.ts`
- `frontend/archive-search.ts`
- `frontend/song-statistics.ts`
- `frontend/status.ts`

不要重新拆出 Carbon 时代的 `app-shell`、`page`、`ui`、页面级 SCSS 或通用组件目录。若文件职责明显膨胀，按业务边界拆成纯页面模块，但不建立自定义设计系统。

## 实施顺序

### 1. 固定应用外壳

在 `frontend/main.tsx` 内完成：

- 使用 `Provider locale="zh-CN"` 作为唯一 Spectrum 根节点。
- 用 `Link` 或 `LinkButton` 实现四个路径的导航。
- 用 `Heading`、`Content`、`Text` 表达页面层级，不手写字体和颜色。
- 用 `ProgressCircle`、`InlineAlert` 表达加载和失败状态。
- 处理当前路径、刷新、前进后退和未知路径；不引入第二套路由协议。
- 确保每个可交互元素有可访问名称，键盘可完成全部导航和搜索。

### 2. 完成直播档案

使用已有的 `manifestQuery`、`yearQuery`、`archive-search.ts` 和 `data-contract.ts`：

- 年份、月份和成员筛选使用 `Picker` 或 `ComboBox`。
- 标题搜索使用 `SearchField`。
- 月份/日期展示优先使用 `TableView` 或 `ListView`，不要手写日历网格。
- 场次详情使用 `Disclosure`；录播和分 P 使用 `Link`。
- 取消、改期和未确认信息使用 `InlineAlert` 或明确的文本状态。
- 保持 URL 查询参数可复制、可刷新；每个页面只解析自身参数。
- 不恢复旧版复杂侧栏、滚动监听、焦点补偿和自定义分页组件。

### 3. 完成歌曲档案

使用 `works` 清单和 `workQuery`：

- 搜索使用 `SearchField`，成员和年份使用 `Picker`。
- 结果对比字段多时使用 `TableView`；只展示标题、原唱、系列和数量等真实字段。
- 选择作品后用 `Disclosure` 或页面内 `TableView` 展示演出、投稿和分 P。
- 保留跨年份完整历史和数量一致性校验；校验失败直接显示错误。
- 分页只在数据量确实需要时使用 `TableView` 的集合能力，不复制旧手写分页状态机。

### 4. 完成 API 文档页

`/api` 只描述实际可用的接口：

- 来源以 Rust `contract.rs` 生成的 OpenAPI 和工具契约为准。
- 使用 `Heading`、`Content`、`TableView`、`Code`（若 S2 有对应组件）表达参数和示例。
- 不添加营销文案、伪造的请求示例或不存在的字段。
- 每次契约变化同时更新该页和 `docs/ai-api.md`。

### 5. 完成服务状态页

继续使用 `statusQuery` 和 `status.ts`：

- `StatusLight` 表达 up/down/unknown。
- `TableView` 或 `ListView` 展示服务名称、当前状态、最后检查时间。
- 只展示 Gatus 投影后的 `key`、`name`、状态和公开检查时间；不泄露节点、地址、内部端口或 token。
- 保持 30 秒轮询和无自动重试；请求失败显示 `InlineAlert`。
- 不在前端实现探测、push token、历史采集或服务端逻辑。

### 6. 加入有行为价值的测试

只为业务行为写测试，不测试 Spectrum 自身：

- 路径和查询参数刷新后保持一致。
- 搜索、筛选和分页不会串页。
- 直播和歌曲详情不会展示快照中不存在的关联。
- 状态过期、失败和未知状态不会误显示为正常。
- 使用 Spectrum 测试工具时遵循 `react-spectrum-s2` skill 中的测试指引；不要依赖脆弱的 CSS 类名。

## 强制约束

实现前必须阅读：

- `AGENTS.md`
- `docs/frontend-design.md`
- `react-spectrum-s2` skill
- 涉及审查时的 `spectrum-audit` skill

禁止：

- Carbon、MUI、Ant、Fluent、Tailwind、shadcn、Radix 或另一套组件库。
- 普通 CSS、SCSS、CSS Modules、styled-components、硬编码颜色、字体、阴影和任意 z-index。
- `UNSAFE_className`、`UNSAFE_style`、自建 token、拼接 style macro 结果。
- 直接使用 `react-aria-components` 或 `react-stately` 替代已有 S2 组件。
- 为兼容旧 URL、旧 DOM、旧 CSS 类名或旧 API 增加适配层。
- 把前端逻辑复制到 Rust 或把 Rust 资料模型复制成第二套 TypeScript 模型。

## 验收命令

在应用目录执行：

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run frontend:build
bun test
```

完成一页后先运行受影响的检查，再运行完整检查。最终还要确认：

- `rg -n -i 'carbon|@carbon|\.scss|UNSAFE_' frontend docs package.json vite.config.ts` 只有约束文档中的禁止说明。
- 生产构建能在无 `STATUS_BACKEND_URL` 时正常完成。
- `STATUS_BACKEND_URL` 只存在于 Vite 开发代理，不进入静态构建产物。
- 工作区没有凭据、Cookie、`.local` 资料或临时抓取响应。
