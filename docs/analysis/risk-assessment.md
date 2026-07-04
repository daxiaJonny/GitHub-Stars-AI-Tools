# 风险评估

## 产品风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 用户误以为要做浏览器插件 | 需求偏移 | 明确主线是独立应用，插件能力不进入 MVP |
| AI 功能过重导致 MVP 迟迟不可用 | 交付延期 | MVP 先做中文摘要，全文翻译和向量检索进入 V0.5 |
| 检索只返回列表，不能解释用途 | 不能解决核心痛点 | 每个 AI 检索结果必须包含中文匹配理由 |
| README 过长导致翻译成本高 | 成本不可控 | 内容 hash 缓存、分块处理、预算上限、按需翻译 |

## 技术风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| GitHub API 限流 | 同步失败或很慢 | 使用分页、ETag、退避、增量窗口、失败重试 |
| README 格式复杂 | 翻译/展示错乱 | 保留代码块、命令、链接；Markdown AST 分块 |
| 向量库过早复杂化 | MVP 成本升高 | MVP 使用 SQLite FTS5，V0.5 再加入向量检索 |
| AI Provider 绑定单一厂商 | 切换 MiniMax/DeepSeek 成本高 | 从第一版建立 Provider 接口 |
| 本地数据库迁移不可控 | 数据丢失 | 所有 schema migration 必须可回滚，导入导出优先实现 |

## 隐私与安全风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| GitHub Token 泄漏 | 用户账号风险 | Token 只进系统 Keychain，不写日志、不进前端持久化明文 |
| AI 请求泄露私有注解 | 用户隐私风险 | 默认只处理公开仓库 README；用户 notes 不默认发送给 AI |
| Gist 同步误上传 AI 全文 | 数据体积与隐私风险 | Gist 默认只同步 tags/notes/tag metadata |
| 多账号数据串库 | 隐私事故 | 所有表必须带 `account_id` 或独立数据库隔离 |

## 架构热点

1. `Knowledge Pipeline` 是复杂度核心，需要状态机而不是临时脚本。
2. `AI Provider Layer` 必须先抽象，否则后续 MiniMax/OpenAI/DeepSeek 切换会扩散到业务层。
3. `Search Engine` 不应直接依赖 UI 参数，应使用统一查询 DSL。
4. `Annotation Layer` 必须与 GitHub 事实层分离，避免全量重扫覆盖用户整理内容。

## 验收风险

MVP 不应以“功能都写完”为验收，而应以完整闭环为验收：

```mermaid
flowchart LR
  A[连接 GitHub] --> B[同步 Stars]
  B --> C[管理标签和笔记]
  C --> D[抓取 README]
  D --> E[生成中文摘要]
  E --> F[用中文需求找到项目]
```

只有这个闭环跑通，产品才成立。