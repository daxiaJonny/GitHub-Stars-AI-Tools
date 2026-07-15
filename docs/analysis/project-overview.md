# 项目分析：GitHub-Stars-AI-Tools

## 目标

重写一个与 `better-github-stars-manager` 同类的 GitHub Star 管理产品，但不继承浏览器插件形态。产品主线是：

- 自动同步用户全部 GitHub Stars。
- 保留 Star 管理核心能力：列表、搜索、筛选、标签、笔记、批量整理、完整分页与权威对账同步。
- 自动抓取仓库 README，生成中文摘要、关键词与推荐标签。
- 将 Star 列表构建为个人 AI 知识库。
- 支持自然语言上下文检索，让用户用需求描述找回已 Star 项目。
- 支持 AI 标签网络和 GitHub 相似项目发现，帮助用户继续发现更合适的开源项目。

## 当前仓库状态

当前仓库已经进入可运行客户端阶段，采用 Tauri 2 + React 19 + TypeScript + Rust + SQLite 的 Monorepo 架构：

- `apps/desktop`：Tauri 桌面客户端，包含 React 工作台、设置页、初始化引导、任务进度、README 渲染和深色模式。
- `apps/desktop/src-tauri`：Rust 后端，负责 GitHub API、AI 请求、SQLite 持久化、系统凭据管理器和 Tauri 命令注册。
- `packages/ai`：AI Provider 抽象与请求封装，覆盖 OpenAI、OpenAI 兼容接口和 Anthropic。
- `packages/github`：GitHub API 数据映射与分页能力。
- `packages/search`：本地知识检索、上下文搜索和组合过滤。
- `packages/storage`：SQLite schema、初始化和持久化验证；本机测试期旧库不迁移，结构不兼容时删除重建。
- `packages/worker`：同步、README、AI 分析、Gist 与推荐任务的后台编排。

普通用户路径是安装客户端后在应用内填写 GitHub Token 与 AI Key，不需要 `.env`、Node.js、pnpm 或 Rust。

## 参考工具核心能力

来自 `better-github-stars-manager` 的 README 能力拆解：

| 能力 | 是否保留 | 新产品实现方式 |
| --- | --- | --- |
| Star 全量加载 | 保留 | 应用内通过 GitHub API 同步所有 starred repositories |
| 快速搜索和过滤 | 保留并增强 | 关键词检索 + 元数据过滤 + 本地知识检索 |
| 自定义标签 | 保留 | 本地注解层管理 tags |
| 笔记 | 保留 | 本地注解层管理 notes |
| 自动建议标签 | 保留并增强 | 基于 topics、language、README 摘要和 AI 分类推荐 |
| 完整分页和权威对账 | 保留 | 同步状态机 + GitHub API 对账 |
| Gist 注解同步 | 保留为兼容方案 | 后续作为导入/导出或跨端同步选项 |
| GitHub 页面浮动按钮 | 不保留 | 独立应用不依赖 GitHub 页面入口 |
| Repo 页面 tag chip | 不进入主线 | 未来可作为伴侣扩展，不属于 MVP |

## 推荐首发形态

首发建议采用 `Tauri 2` 桌面应用：

- 更适合本地优先、私有数据和低成本 AI 缓存。
- 可以通过系统凭据管理器安全保存 GitHub Token 和 AI API Key。
- 可以后台执行 Stars 同步、README 抓取、AI 摘要、AI 标签网络和相似项目推荐任务。
- 后续仍可复用前端与领域模块扩展 Web App。

## 成功标准

MVP 完成后，用户应能：

1. 连接 GitHub 账号。
2. 同步全部 Star 项目。
3. 在应用中搜索、筛选、打标签、写笔记。
4. 打开任意项目详情，看到中文摘要、README 原文、标签和笔记。
5. 通过中文自然语言描述找到相关 Star 项目，并看到匹配理由。
6. 选择若干已收藏项目后，让 AI 在 GitHub 上寻找相似或更合适的项目。

## 明确不做

- 不做 Chrome 插件。
- 不做 GitHub 页面 DOM 注入。
- 不做 Manifest V3 适配。
- 不把浏览器插件的 UI 形态作为兼容目标。
