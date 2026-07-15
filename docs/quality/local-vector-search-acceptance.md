# 本地向量检索真实仓库验收

本文用于在已有 GitHub Stars、已下载本地模型和已完成 zvec 建库的电脑上，验证真实仓库检索链路。测试只读打开 SQLite 和 zvec，不下载模型、不重建索引、不修改用户数据。

## 验收目标

检索分为两阶段：

1. 本地 `multilingual-e5-small` 对用户问题生成查询向量，zvec 从当前账号中召回最多 30 个候选。
2. AI 只能从这批真实候选中筛选 0 到 10 个仓库；AI 回答和右侧仓库列表必须使用同一份筛选结果。

向量层优先保证正确项目进入候选池，AI 层负责去除宽召回产生的噪声。相关项目不足 10 个时不得凑数。

## 前置条件

- 设置中的向量检索已启用，Provider 为 `local`。
- 模型缓存存在 `embedding-models/<profileId>/ready.json`。
- SQLite 中 `repo_embeddings` 已覆盖当前账号的活跃仓库。
- app data 中存在 `vector-index/`。
- 测试期间不删除模型、不重建索引。

## 数据完整性检查

先查看账号 ID：

```bash
rtk sqlite3 -readonly "$HOME/Library/Application Support/com.xingranya.github-stars-ai-tools/gsat.sqlite3" \
  "SELECT id, login FROM github_accounts;"
```

再核对活跃仓库、README、AI 文档、SQLite 向量和待更新队列：

```bash
rtk sqlite3 -readonly "$HOME/Library/Application Support/com.xingranya.github-stars-ai-tools/gsat.sqlite3" \
  "SELECT 'active_repositories', COUNT(*) FROM repositories WHERE sync_status='active';
   SELECT 'readmes', COUNT(*) FROM repo_readmes;
   SELECT 'ai_documents', COUNT(*) FROM repo_ai_documents;
   SELECT 'embeddings', COUNT(*), MIN(dimensions), MAX(dimensions) FROM repo_embeddings;
   SELECT 'dirty_queue', COUNT(*) FROM embedding_dirty_queue;"
```

通过标准：

- 活跃仓库数、当前 profile 的 SQLite 向量数和 zvec 文档数一致。
- 向量维度全部为 `384`。
- 完整建库后 `embedding_dirty_queue` 为 `0`；如果不为 0，应等待后台增量任务完成后再测。

## 真实 zvec Smoke Test

项目内置的测试 `local_user_catalog_vector_search_smoke` 默认忽略，只有显式提供本机目录和账号时才执行。它会：

- 只读打开正式 SQLite。
- 校验活跃仓库数、SQLite 向量数和 zvec 文档数。
- 从现有缓存校验并加载本地模型。
- 对每条查询生成真实 E5 查询向量。
- 从现有 zvec 读取 Top 30，并回查仓库名与描述。

执行命令：

```bash
rtk env \
  GSAT_VECTOR_TEST_DATA_DIR="$HOME/Library/Application Support/com.xingranya.github-stars-ai-tools" \
  GSAT_EMBEDDING_TEST_CACHE="$HOME/Library/Caches/com.xingranya.github-stars-ai-tools" \
  GSAT_VECTOR_TEST_ACCOUNT_ID=<ACCOUNT_ID> \
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib \
  local_user_catalog_vector_search_smoke -- --ignored --nocapture
```

可使用竖线分隔自定义查询：

```bash
rtk env \
  GSAT_VECTOR_TEST_DATA_DIR="$HOME/Library/Application Support/com.xingranya.github-stars-ai-tools" \
  GSAT_EMBEDDING_TEST_CACHE="$HOME/Library/Caches/com.xingranya.github-stars-ai-tools" \
  GSAT_VECTOR_TEST_ACCOUNT_ID=<ACCOUNT_ID> \
  GSAT_VECTOR_TEST_QUERIES='Grok|轻量级进程内向量数据库|OCR document recognition|agentic video production' \
  cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib \
  local_user_catalog_vector_search_smoke -- --ignored --nocapture
```

输出分数是应用校准后的 `0..1` 相关度，用于比较同一查询下的排序。AI 两阶段模式会读取 Top 30，不会先用设置阈值删除正确候选；AI 不可用时才按设置阈值回退到严格混合检索。

## 质量判定

每条查询至少检查以下项目：

| 检查项 | 通过标准 |
| --- | --- |
| 候选召回 | 明确相关仓库进入 zvec Top 30 |
| 首位质量 | 精确产品名或明确能力查询的首位应直接相关 |
| 跨语言 | 中文问题能召回英文描述仓库，英文问题能召回中文或混合描述仓库 |
| AI 筛选 | 最终只保留候选池中的 0 到 10 个仓库，不得引用池外项目 |
| 界面一致性 | AI 回答中推荐的仓库和右侧卡片顺序、数量一致 |
| 空结果 | 没有高相关候选时返回 0 条，不得固定填满 10 条 |
| 降级 | AI 或向量失败时使用严格本地结果，不能直接展示宽召回噪声 |

## 2026-07-15 现场样本

本次使用 510 个真实 Stars 验收，SQLite 向量和 zvec 文档均为 510，待更新队列为 0。

| 查询 | 关键召回 | 校准分数 | 结论 |
| --- | --- | ---: | --- |
| `Grok` | `SunkenCost/grok-regkit` | 0.6767 | 前三名均为 Grok 项目，产品名召回正常 |
| `轻量级进程内向量数据库` | `alibaba/zvec` | 0.7931 | 中文查英文描述，首位准确 |
| `OCR document recognition` | `zai-org/GLM-OCR` | 0.6121 | 英文能力查询首位准确 |
| `agentic video production` | `calesthio/OpenMontage` | 0.6642 | 首位直接匹配视频生产场景 |
| `AI coding agent CLI` | `google-gemini/gemini-cli` 等进入前十 | 0.7036 | 召回覆盖正确，但需要 AI 去除 Office/通用 Agent 噪声 |

现场结果说明 zvec 和本地模型能够真实运行，跨语言召回有效；同时也证明不能在 AI 筛选前固定使用 `0.72` 阈值，否则 Grok、OCR 和视频查询的正确候选会被提前删除。

## 失败排查

- SQLite 向量少于活跃仓库：等待增量任务，或在设置中重试索引构建。
- zvec 文档数与 SQLite 不一致：应用会从 SQLite 自动恢复 zvec；恢复后重新执行测试。
- 模型加载失败：检查 `ready.json` 和五个模型工件，校验失败时删除本地模型后重新下载。
- Top 30 没有明确相关仓库：检查知识文本是否包含仓库名、描述、Topics、AI 摘要和 README，再补充质量集。
- AI 回答与右侧不一致：视为阻断发布的问题，检查结构化 `repository_full_names` 是否经过候选白名单校验和结果重排。
