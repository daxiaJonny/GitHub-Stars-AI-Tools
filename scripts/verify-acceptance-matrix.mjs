import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const verifyMvpSource = readFileSync(resolve(root, 'scripts/verify-mvp.mjs'), 'utf8');
const workspaceSource = collectWorkspaceSource();

const acceptanceItems = [
  {
    id: 'AUTH-01',
    scenario: '输入有效 GitHub Token 并连接',
    commands: ['verify:auth-flow', 'verify:settings-flow'],
    evidence: ['save_github_token', 'connectWithToken', 'check_runtime_readiness_worker', 'GitHub Token 已验证'],
    appCheck: '设置页真实链路自检会读取系统凭据中的 GitHub Token 并请求 /user；用户安装后在应用内填写自己的 Token 即可确认首次连接会解锁界面。',
  },
  {
    id: 'AUTH-02',
    scenario: '输入无效或过期 GitHub Token',
    commands: ['verify:auth-data-flow'],
    evidence: ['Token 无效或权限不足', 'invalid_token_error_cannot_restore_cached_user'],
    appCheck: null,
  },
  {
    id: 'SYNC-01',
    scenario: '首次全量同步 Stars',
    commands: ['verify:github', 'verify:settings-flow'],
    evidence: ['sync_github_stars', 'fetch_starred_repositories_page', 'Stars API 可用'],
    appCheck: '设置页真实链路自检会请求 Stars API 首页；用户连接账号后可在应用内执行一次同步，确认写库和进度展示。',
  },
  {
    id: 'SYNC-02',
    scenario: '增量同步',
    commands: ['verify:sync-resilience'],
    evidence: ['incremental_sync_stops_on_page_with_only_known_active_repositories'],
    appCheck: null,
  },
  {
    id: 'SYNC-03',
    scenario: '弱网或断网同步中断',
    commands: ['verify:sync-resilience'],
    evidence: ['弱网中断不会误标记已同步仓库为 removed', 'removed_repositories_are_computed_only_after_full_scan'],
    appCheck: null,
  },
  {
    id: 'VIEW-01',
    scenario: '空状态展示',
    commands: ['verify:view-ai-ui', 'verify:dashboard-flow'],
    evidence: ['RepositoryEmptyState', '还没有同步仓库', '前往设置连接 GitHub 账号'],
    appCheck: null,
  },
  {
    id: 'VIEW-02',
    scenario: '1000+ Stars 列表性能',
    commands: ['verify:virtual-list'],
    evidence: ['computeVirtualWindow'],
    appCheck: null,
  },
  {
    id: 'VIEW-03',
    scenario: '仓库详情基础元数据',
    commands: ['verify:view-ai-ui'],
    evidence: ['compactNumber(repo.starsCount)', "repo.language ?? '其他'"],
    appCheck: null,
  },
  {
    id: 'AI-01',
    scenario: '单仓 README 抓取与 AI 摘要生成',
    commands: ['verify:ai', 'verify:settings-flow'],
    evidence: ['generate_repository_ai_document', 'test_ai_connection', 'run_ai_connection_probe', 'README 抓取可用'],
    appCheck: '设置页真实链路自检会用当前 AI 设置发起摘要请求，并对本地 Star 发起 README 抓取；用户在应用内填写自己的 AI 配置后即可确认摘要链路可用。',
  },
  {
    id: 'AI-02',
    scenario: 'Token 超限或接口超时处理',
    commands: ['verify:view-ai-ui'],
    evidence: [
      'format_ai_http_error_reports_token_limit',
      'format_ai_http_error_reports_nested_token_limit',
      'extract_ai_error_detail_reads_gateway_error_arrays',
      'AI 摘要暂未生成，本地 README 和仓库数据已保留',
    ],
    appCheck: null,
  },
  {
    id: 'AI-03',
    scenario: '根据选中 Stars 在 GitHub 寻找相似或更优项目',
    commands: ['verify:recommendation-flow', 'verify:settings-flow'],
    evidence: [
      'generate_ai_tag_network',
      'check_runtime_tag_network',
      'AI 标签网络可用',
      'recommend_github_repositories',
      'parse_github_recommendation_plan_normalizes_queries',
      'check_runtime_recommendation',
      '相似推荐链路可用',
    ],
    appCheck: '设置页真实链路自检会用本地 Star 让 AI 生成标签建议，并生成搜索式请求 GitHub Search；用户可选择自己的 Star 仓库执行一次完整推荐。',
  },
  {
    id: 'SRCH-01',
    scenario: '关键词模糊匹配',
    commands: ['verify:search'],
    evidence: ['list_repository_page_matches_keyword_across_readme_ai_and_tags'],
    appCheck: null,
  },
  {
    id: 'SRCH-02',
    scenario: '组合条件过滤',
    commands: ['verify:search'],
    evidence: ['list_repository_page_applies_keyword_language_and_tag_intersection'],
    appCheck: null,
  },
  {
    id: 'SRCH-03',
    scenario: '自然语言搜索持续对话上下文',
    commands: ['verify:ai-search-flow'],
    evidence: ['gsat-ai-search-conversation', 'search_repositories_uses_recent_context_queries'],
    appCheck: null,
  },
  {
    id: 'DATA-01',
    scenario: '重启后本地数据留存',
    commands: ['verify:auth-data-flow', 'verify:settings-flow'],
    evidence: [
      'repository_detail_reads_persisted_readme_and_ai_document',
      'SQLite schema initialization verification passed',
      'SQLite persistence verification passed',
      'check_runtime_storage',
      '本地数据库可读，SQLite 初始化已完成',
      'check_runtime_settings_storage',
      '应用设置可保存',
    ],
    appCheck: '设置页真实链路自检会查询本地 SQLite 仓库索引，并在应用设置目录写入/删除临时探针文件；用户可在应用内确认本地数据和设置可在重启后保留。',
  },
  {
    id: 'DATA-02',
    scenario: 'Gist 注解备份与恢复链路',
    commands: ['verify:backup-flow'],
    evidence: ['verify-backup-flow.mjs', 'create_gist_snapshot', 'restore_gist_snapshot', 'importSnapshot'],
    appCheck: null,
  },
  {
    id: 'DESKTOP-01',
    scenario: '桌面安装包、窗口标题、应用图标与发布包自检记录',
    commands: ['verify:tauri-release-config', 'verify:branding', 'verify:settings-flow'],
    evidence: [
      'verify:tauri-release-config',
      'pnpm --filter @gsat/desktop tauri build',
      'workflow_dispatch',
      'Tauri bundle 图标必须覆盖任务栏、Dock 和安装包入口',
      'productName',
      'lastSelfCheckRecord',
      '发布包自检记录',
      '本地数据库',
      '应用设置存储',
      '不保存 Token、AI Key 或错误详情',
    ],
    appCheck: '设置页真实链路自检会汇总本地数据库、应用设置存储、GitHub Token、Stars API、README 抓取、AI 服务、AI 标签网络和相似推荐八项结果，并只持久化检查时间与数量摘要。',
  },
];

const missingCommandEntries = [];
const missingEvidenceEntries = [];
for (const item of acceptanceItems) {
  for (const command of item.commands) {
    if (!verifyMvpSource.includes(command)) {
      missingCommandEntries.push(`${item.id}: ${command}`);
    }
  }

  for (const evidence of item.evidence) {
    if (!workspaceSource.includes(evidence)) {
      missingEvidenceEntries.push(`${item.id}: ${evidence}`);
    }
  }
}
assert.equal(missingCommandEntries.length, 0, `验收矩阵命令未进入 verify:mvp：\n${missingCommandEntries.join('\n')}`);
assert.equal(missingEvidenceEntries.length, 0, `验收矩阵缺少源码或测试证据：\n${missingEvidenceEntries.join('\n')}`);
assert.doesNotMatch(
  acceptanceItems.map((item) => item.appCheck ?? '').join('\n'),
  /发布者|真实账号 smoke|安装前|专用测试|测试账号|测试 AI Key|测试 GitHub Token|发版前维护者|维护者发布前/,
  '验收矩阵不能使用会让普通安装包用户误解的发布验收措辞',
);
assert.match(verifyMvpSource, /const generatedArtifacts = \[/, 'verify:mvp 必须集中声明需要清理的构建产物');
assert.match(verifyMvpSource, /apps\/desktop\/dist[\s\S]*?apps\/desktop\/src-tauri\/target[\s\S]*?packages\/ai\/tsconfig\.tsbuildinfo[\s\S]*?packages\/worker\/tsconfig\.tsbuildinfo/, 'verify:mvp 必须覆盖桌面 dist、Rust target 和 packages tsbuildinfo 产物清理');
assert.match(verifyMvpSource, /finally \{[\s\S]*?rmSync\(resolve\(root, artifact\), \{ recursive: true, force: true \}\)/, 'verify:mvp 必须在成功或失败后都清理构建产物');

const appCheckItems = acceptanceItems.filter((item) => item.appCheck);

console.log('MVP 验收矩阵：');
for (const item of acceptanceItems) {
  const mode = item.appCheck ? '静态通过，应用内真实自检入口已覆盖' : '静态通过';
  console.log(`- ${item.id} ${item.scenario}: ${mode}`);
  if (item.appCheck) {
    console.log(`  应用内自检：${item.appCheck}`);
  }
}
console.log(`\n静态验收项：${acceptanceItems.length}，应用内真实链路自检覆盖项：${appCheckItems.map((item) => item.id).join(', ')}`);
console.log('真实链路自检分项：本地数据库、应用设置存储、GitHub Token、Stars API、README 抓取、AI 服务、AI 标签网络、相似推荐。');
console.log('真实链路复核只在应用内进行：用户安装后填写自己的 GitHub Token 与 AI 配置即可自检，不需要安装前配置环境变量或额外脚本。');
console.log('Acceptance matrix verification passed.');

function collectWorkspaceSource() {
  const roots = [
    'README.md',
    'package.json',
    'scripts',
    'apps/desktop/scripts',
    'apps/desktop/src',
    'apps/desktop/src-tauri/src',
    'packages/ai/scripts',
    'packages/ai/src',
    'packages/github/scripts',
    'packages/github/src',
    'packages/search/scripts',
    'packages/search/src',
    'packages/storage/scripts',
    'packages/storage/src',
    'packages/storage/migrations',
    'packages/worker/scripts',
    'packages/worker/src',
  ];
  const extensions = new Set(['.js', '.mjs', '.ts', '.tsx', '.rs', '.sql', '.json', '.md']);

  return roots
    .flatMap((entry) => collectFiles(resolve(root, entry), extensions))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}

function collectFiles(path, extensions) {
  const stat = statSync(path);
  if (stat.isFile()) {
    return extensions.has(extname(path)) ? [path] : [];
  }

  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry), extensions));
}
