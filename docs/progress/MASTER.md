# MASTER：GitHub Stars AI Tools

## 当前状态

- 模式：LOCAL_ONLY
- 阶段：Phase 3 进行中
- 当前任务：Task 3.2 标签与笔记已完成，下一步进入 Task 3.3 关键词搜索与筛选
- 日期：2026-07-04

## 产品边界

本项目是独立应用，不是浏览器插件迁移。

保留能力：

- GitHub Stars 同步
- Star 列表管理
- 搜索与筛选
- 标签与笔记
- 批量整理
- 增量同步与全量重扫
- 注解层导入导出
- README 中文摘要与翻译
- AI 知识库
- 自然语言检索

不做能力：

- Chrome Extension
- Manifest V3
- content script
- GitHub 页面注入
- GitHub 页面浮动按钮
- Repo 页面 tag chip 主线能力

## 文档索引

### 分析文档

- [项目分析](../analysis/project-overview.md)
- [模块清单](../analysis/module-inventory.md)
- [风险评估](../analysis/risk-assessment.md)

### 计划文档

- [产品规格](../plan/product-spec.md)
- [架构规格](../plan/architecture-spec.md)
- [任务拆解](../plan/task-breakdown.md)
- [依赖图](../plan/dependency-graph.md)
- [里程碑](../plan/milestones.md)

### 执行入口

- [实现计划](../../tasks/plan.md)
- [任务清单](../../tasks/todo.md)

## 阶段进度

- [x] Phase 0：规格冻结（1/1）
- [x] Phase 1：项目骨架与基础设施（3/3）
- [x] Phase 2：GitHub 同步闭环（3/3）
- [ ] Phase 3：Star 管理核心能力（2/3）
- [ ] Phase 4：AI 知识库 MVP（0/3）
- [ ] Phase 5：自然语言检索（0/3）
- [ ] Phase 6：同步与发布增强（0/3）

## 下一步

进入 `tasks/todo.md` 的 Task 3.3：关键词搜索与筛选。下一步应在搜索层接入关键词、language、tag 的组合筛选，并保持查询只读取事实层与注解层投影，不改变 GitHub 同步写入边界。

## 关键约束

- 业务逻辑不能写死在 Tauri 壳中。
- UI 不能直接调用 GitHub SDK 或模型 SDK。
- GitHub 事实数据、用户注解、AI 派生数据必须分层。
- AI Provider 必须支持后续接入 MiniMax。
- README 中文处理必须基于 hash 缓存，避免重复扣费。
- 用户 notes 默认不发送给 AI。