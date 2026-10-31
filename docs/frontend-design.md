# 前端设计与约束

本项目的前端是 API 的只读观察界面。它展示已构建的发布快照和服务状态，不导入原始资料、不维护浏览器数据库，也不把业务数据重新校验成第二套契约。

## 唯一设计语言

- UI 组件唯一来源是 `@react-spectrum/s2`（Spectrum 2）；当前锁定版本写在 `package.json`。
- 根节点必须使用 `@react-spectrum/s2/Provider`，固定 `locale="zh-CN"`。组件从文档对应的子路径导入，不使用包的聚合入口。
- 交互优先选用 S2 组件：`Button`、`Link`、`SearchField`、`Picker`、`TableView`、`ListView`、`Disclosure`、`InlineAlert`、`StatusLight`、`ProgressCircle` 等。组件选择遵循官方 [component decision tree](https://react-spectrum.adobe.com/s2/component-decision-tree)。
- `react-aria-components`、`react-stately` 只能在 S2 没有对应组件且确实需要行为原语时使用；使用前必须在代码旁说明缺口。
- 禁止 Carbon、MUI、Ant、Fluent、Tailwind、shadcn、Radix 和自建组件库。禁止把旧 Carbon 页面、类名、token 或文案迁移回来。

## 布局和样式

- 页面结构只使用原生语义 HTML 和 S2 组件默认布局；S2 没有 `Flex`、`Grid`、`View` 这些旧版布局组件，不得伪造或新增一层布局组件。当前前端不引入自定义布局样式。
- 样式必须来自 S2 组件。禁止普通 CSS、SCSS、CSS Modules、styled-components、style macro、内联颜色、硬编码字体、阴影和任意 z-index。只有未来确有布局缺口时，才可单独评估官方 style macro，并先解决其构建支持。
- 一个元素只调用一次 `style({...})`；运行时状态写入同一调用的条件对象，不拼接 className，不使用 `UNSAFE_className` 或 `UNSAFE_style`。
- 间距只用官方 4px 网格；使用逻辑方向属性（`paddingStart`、`marginEnd` 等），不写左右物理属性。
- 组件内部结构、slot、表格和集合的滚动行为以官方组件文档为准；不得用外层 div 覆盖组件 DOM 或自行重建其键盘行为。
- 页面只提供必要的导航、标题、状态、数据和操作。没有对应的 S2 组件时，重组信息结构，不创造新的视觉语言。

## API 前端边界

- `frontend/data-contract.ts` 是前端快照的唯一运行时契约；生成脚本和界面共享 Rust 产物，不复制后端模型。
- TanStack Query 只负责读取、缓存、取消和状态；查询失败直接显示错误，禁止统一重试、猜测值和静默 fallback。
- 查询参数只保留当前页面实际需要的字段；路径变化通过 History API 更新，刷新后可复现同一视图。
- 服务状态只读取 Gatus 的只读代理接口；前端不执行探测、不保存 token、不显示服务器地址或内部诊断字段。
- 前端不读取 `.local/`、Cookie、登录状态或原始抓取响应。

## 文件边界

- `frontend/main.tsx`：唯一入口、路由和页面组合。
- `frontend/data.ts`、`data-contract.ts`：查询和数据契约。
- `frontend/records.ts`、`members.ts`、`video.ts`、`status.ts`、`archive-search.ts`、`song-statistics.ts`：无界面纯函数或静态映射。
- `frontend/index.html`、`spectrum.css`：应用入口和 S2 基础样式。不得再建立页面级 SCSS 目录。
- 生成资料在 `frontend/public/data/`，只由 `scripts/build-frontend.mjs` 写入。

## AI 工具接入

官方 React Spectrum 提供 Agent Skills 和 MCP：

- Skill：`react-spectrum-s2`，用于组件选择、S2 API、样式宏和测试。
- 审查：`spectrum-audit`，只读检查配置、组件、样式、可访问性和版本。
- Codex MCP：`react-spectrum-s2`，使用 `npx --yes @react-spectrum/mcp@latest`，配置位于用户级 `~/.codex/config.toml`。
- 官方入口：[Working with AI](https://react-spectrum.adobe.com/ai)、[Getting started](https://react-spectrum.adobe.com/s2/getting-started)。

旧 Carbon MCP 和 Carbon skill 已移除。以后任何前端改动先读本文件和 `react-spectrum-s2` skill；涉及审查时再运行 `spectrum-audit`，不把审查报告当成实现规范。

## 检查

```sh
bun run lint
bun run typecheck
bun run frontend:build
bun test
```

检查重点是：无旧设计系统依赖、无自定义 CSS、无 S2 禁止 API、构建产物能加载、API 请求失败可见、所有可交互元素有可访问名称。
