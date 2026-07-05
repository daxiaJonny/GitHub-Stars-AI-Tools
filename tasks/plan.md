# Implementation Plan: GitHub-Stars-AI-Tools

## Overview

构建一个独立桌面应用，用于管理 GitHub Stars，并把 Star 列表自动转化为个人 AI 知识库。产品不保留浏览器插件形态，只保留原工具的核心管理能力，并新增 README 中文化与自然语言检索。

## Architecture Decisions

- 使用 `Tauri 2 + React 19 + TypeScript` 作为首发形态。
- 使用 `SQLite` 做本地优先数据存储。
- 使用 `SQLite FTS5` 作为 MVP 搜索能力，后续加入向量检索。
- 建立 `AI Provider Layer`，保证 MiniMax、OpenAI、DeepSeek、Ollama 可替换。
- GitHub 事实数据、用户注解、AI 派生结果分层存储。
- 插件专属能力不进入主线。

## Task List

### Phase 1: Foundation

- [ ] Task 1.1: 初始化 Tauri + React 项目
- [ ] Task 1.2: 建立共享包结构
- [ ] Task 1.3: 建立本地 SQLite 与迁移机制

### Checkpoint: Foundation

- [ ] 应用可启动
- [ ] 数据库 migration 可执行
- [ ] 包依赖方向清晰

### Phase 2: GitHub Sync

- [ ] Task 2.1: GitHub 认证
- [ ] Task 2.2: 全量 Star 同步
- [ ] Task 2.3: README 抓取与缓存

### Checkpoint: GitHub Sync

- [ ] 能同步真实 GitHub Stars
- [ ] 能持久化仓库事实数据
- [ ] 能抓取 README

### Phase 3: Core Management

- [ ] Task 3.1: Star 工作台列表
- [ ] Task 3.2: 标签与笔记
- [ ] Task 3.3: 关键词搜索与筛选

### Checkpoint: Core Management

- [ ] 用户能整理 Star
- [ ] 用户注解不会被同步覆盖
- [ ] 1000 条数据下搜索可用

### Phase 4: AI Knowledge MVP

- [ ] Task 4.1: AI Provider 抽象
- [ ] Task 4.2: README 中文摘要
- [ ] Task 4.3: 项目详情页中文展示

### Checkpoint: AI Knowledge MVP

- [ ] 用户能看到项目中文用途说明
- [ ] AI 结果可缓存
- [ ] 失败任务可重试

### Phase 5: Natural Language Search

- [ ] Task 5.1: 查询 DSL
- [ ] Task 5.2: 向量索引
- [ ] Task 5.3: 检索结果解释

### Checkpoint: Search

- [ ] 用户能用中文需求找到项目
- [ ] 结果包含匹配理由
- [ ] 不编造 README 中不存在的信息

### Phase 6: Long-term Usage

- [ ] Task 6.1: 增量同步与全量重扫
- [ ] Task 6.2: Gist 注解导入导出
- [ ] Task 6.3: 成本与任务监控

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI 功能过早复杂化 | MVP 延期 | MVP 只做中文摘要，全文翻译与向量检索后置 |
| GitHub API 限流 | 同步失败 | 分页、ETag、退避、增量同步 |
| Provider 绑定单一厂商 | 后续接 MiniMax 成本高 | 从第一阶段建立 AI Provider 抽象 |
| 用户注解被同步覆盖 | 数据丢失 | 注解层与事实层分离 |

## Open Questions

- 首发是否最终确认 `Tauri 桌面应用`，还是改为 Web-first。
- MiniMax 是否作为首个 AI Provider，还是作为 V1.0 Provider。