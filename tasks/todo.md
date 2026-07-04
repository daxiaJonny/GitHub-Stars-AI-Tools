# TODO：GitHub Stars AI Tools

## Phase 1: Foundation

- [x] Task 1.1: 初始化 Tauri + React 项目
  - Status: 已完成。骨架、基础布局、前端构建验证均通过。
  - Acceptance: 应用可启动，基础布局存在，构建通过。
  - Verify: `pnpm build` 已通过；`pnpm dev` 可用于本地预览。
  - Files: `apps/desktop/**`、`package.json`、`pnpm-workspace.yaml`、`.gitignore`

- [x] Task 1.2: 建立共享包结构
  - Status: 已完成。共享包目录、TypeScript 配置、领域类型、端口接口和构建验证均通过。
  - Acceptance: `domain/storage/github/ai/search/worker` 包存在，依赖方向清晰。
  - Verify: `pnpm build:packages` 与 `pnpm build` 已通过。
  - Files: `packages/**`、`tsconfig.base.json`、`tsconfig.packages.json`、`package.json`、`pnpm-lock.yaml`

- [x] Task 1.3: 建立本地 SQLite 与迁移机制
  - Status: 已完成。核心表、迁移记录表、FTS 表、迁移清单和幂等验证脚本均已建立。
  - Acceptance: 核心表可创建，migration 可重复执行。
  - Verify: `pnpm --filter @stars-ai/storage verify:migrations` 与 `pnpm build` 已通过。
  - Files: `packages/storage/**`

## Phase 2: GitHub Sync

- [x] Task 2.1: GitHub 认证
  - Status: 已完成。PAT 由 Tauri 本地后端写入 macOS Keychain，保存前通过 GitHub `/user` 接口验证，前端只展示用户资料和连接状态。
  - Acceptance: Token 安全保存，可验证用户身份，日志不泄露 Token。
  - Verify: `pnpm build`、`cargo fmt --check` 与 `cargo check` 已通过。
  - Files: `apps/desktop/src/App.tsx`、`apps/desktop/src/styles.css`、`apps/desktop/src-tauri/**`

- [x] Task 2.2: 全量 Star 同步
  - Status: 已完成。Tauri 后端复用 Keychain Token，分页拉取 GitHub Stars，初始化本地 SQLite，并将仓库事实层幂等写入 `repositories` 和默认 `annotations`。
  - Acceptance: 支持分页同步，重复同步不重复写入。
  - Verify: `pnpm build`、`cargo fmt --check` 与 `cargo check` 已通过；真实数量校验需在已连接 GitHub 后点击“同步 Stars”完成。
  - Files: `apps/desktop/src-tauri/src/auth.rs`、`apps/desktop/src-tauri/src/github.rs`、`apps/desktop/src-tauri/src/storage.rs`、`apps/desktop/src-tauri/src/lib.rs`、`apps/desktop/src/App.tsx`、`apps/desktop/src/styles.css`

- [x] Task 2.3: README 抓取与缓存
  - Status: 已完成。基于本地 active 仓库抓取 GitHub README，解析 base64 内容，计算 SHA-256 content hash，保存 `repo_readmes`；hash 未变化时跳过写入，无 README 的仓库计入 missing，不阻断整体任务。
  - Acceptance: README 原文和 hash 入库，hash 未变跳过处理。
  - Verify: `pnpm build`、`cargo fmt` 与 `cargo check` 已通过；真实缓存命中需在已同步 Stars 后点击“抓取 README”重复执行验证。
  - Files: `apps/desktop/src-tauri/src/auth.rs`、`apps/desktop/src-tauri/src/github.rs`、`apps/desktop/src-tauri/src/storage.rs`、`apps/desktop/src-tauri/src/lib.rs`、`apps/desktop/src/App.tsx`、`apps/desktop/src/styles.css`、`apps/desktop/src-tauri/Cargo.toml`

## Phase 3: Core Management

- [x] Task 3.1: Star 工作台列表
  - Status: 已完成。Tauri 后端提供本地仓库列表分页查询，前端工作台展示 name、description、language、topics、starred_at、stars_count、forks_count 和 README 缓存状态，并提供刷新入口。
  - Acceptance: 展示核心字段，支持外链跳转，最多加载 1000 条数据并在列表容器内滚动。
  - Verify: `pnpm build`、`cargo fmt --check` 与 `cargo check` 已通过。
  - Files: `apps/desktop/src-tauri/src/storage.rs`、`apps/desktop/src-tauri/src/lib.rs`、`apps/desktop/src/App.tsx`、`apps/desktop/src/styles.css`

- [x] Task 3.2: 标签与笔记
  - Status: 已完成。注解层已接入本地 SQLite，支持标签 CRUD、仓库打标、阅读状态和 Markdown 笔记；GitHub 同步仍只写事实层，不覆盖用户整理内容。
  - Acceptance: 标签 CRUD、仓库打标、Markdown 笔记可用，同步不覆盖注解。
  - Verify: `pnpm build`、`cargo fmt --check` 与 `cargo check` 已通过；真实同步前后注解一致性需在已连接 GitHub 后执行同步回归。
  - Files: `apps/desktop/src-tauri/src/storage.rs`、`apps/desktop/src-tauri/src/lib.rs`、`apps/desktop/src/App.tsx`、`apps/desktop/src/styles.css`

- [ ] Task 3.3: 关键词搜索与筛选
  - Acceptance: 支持关键词、language、tag 组合筛选。
  - Verify: 1000 条数据搜索响应小于 300ms。
  - Files: `packages/search/**`、`apps/desktop/src/**`

## Phase 4: AI Knowledge MVP

- [ ] Task 4.1: AI Provider 抽象
  - Acceptance: 业务层只依赖标准接口，mock provider 可测试。
  - Verify: 摘要流程 mock 测试通过。
  - Files: `packages/ai/**`、`packages/domain/**`

- [ ] Task 4.2: README 中文摘要
  - Acceptance: 摘要、关键词、推荐标签可生成，hash 未变不重复生成。
  - Verify: 抽样 10 个仓库检查摘要质量。
  - Files: `packages/ai/**`、`packages/worker/**`、`packages/storage/**`

- [ ] Task 4.3: 项目详情页中文展示
  - Acceptance: 详情页展示中文摘要、README 原文、标签、笔记。
  - Verify: 人工检查多个项目详情。
  - Files: `apps/desktop/src/**`

## Phase 5: Natural Language Search

- [ ] Task 5.1: 查询 DSL
  - Acceptance: 普通筛选和自然语言查询使用统一 `RepoQuery`。
  - Verify: DSL 单元测试通过。
  - Files: `packages/domain/**`、`packages/search/**`

- [ ] Task 5.2: 向量索引
  - Acceptance: 向量记录带 model_version/source_hash，内容未变不重复生成。
  - Verify: 固定测试查询召回预期仓库。
  - Files: `packages/search/**`、`packages/ai/**`、`packages/worker/**`

- [ ] Task 5.3: 检索结果解释
  - Acceptance: 每个结果都有中文匹配理由和引用片段。
  - Verify: 人工检查 Top 10 解释质量。
  - Files: `packages/search/**`、`apps/desktop/src/**`

## Phase 6: Long-term Usage

- [ ] Task 6.1: 增量同步与全量重扫
  - Acceptance: 新 Star 加入，unstar 标记 removed，不删除注解。
  - Verify: 模拟新增与取消 Star。
  - Files: `packages/github/**`、`packages/worker/**`

- [ ] Task 6.2: Gist 注解导入导出
  - Acceptance: 只同步 tags、notes、tag metadata。
  - Verify: 导出导入后注解一致。
  - Files: `packages/github/**`、`packages/storage/**`、`apps/desktop/src/**`

- [ ] Task 6.3: 成本与任务监控
  - Acceptance: 展示 AI 用量、失败任务、重试入口。
  - Verify: 构造失败任务并重试。
  - Files: `packages/worker/**`、`apps/desktop/src/**`