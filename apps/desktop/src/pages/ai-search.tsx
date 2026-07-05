import { useState, useMemo, useEffect } from 'react';
import { useWorkspace } from '@/providers/workspace-provider';
import { Icon } from '@/components/ui/icon';
import { compactNumber } from '@/lib/format';
import type { RepositoryListItem, AiSearchResult, SearchMatchReasonView } from '@/types';

/* 建议词 */
const SUGGESTIONS = [
  '支持离线缓存的网络请求模块',
  '基于 Rust 的高性能文本处理',
  '微前端架构的主应用入口配置',
  'React 动画库',
  'Python 机器学习框架',
  'Go 语言并发任务队列',
];

/* 搜索历史 localStorage key */
const HISTORY_KEY = 'stars-ai-search-history';

export function AISearchPage() {
  const workspace = useWorkspace();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // 加载搜索历史
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  // 执行搜索
  const results = useMemo<AiSearchResult[]>(() => {
    if (!submittedQuery || !workspace.repositoryPage) return [];
    return searchRepositories(submittedQuery, workspace.repositoryPage.items);
  }, [submittedQuery, workspace.repositoryPage]);

  function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setIsSearching(true);
    setSubmittedQuery(q);
    // 保存到历史
    const newHistory = [q, ...history.filter((h) => h !== q)].slice(0, 10);
    setHistory(newHistory);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      // ignore
    }
    setTimeout(() => setIsSearching(false), 300);
  }

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion);
    setSubmittedQuery(suggestion);
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 300);
  }

  function handleHistoryClick(item: string) {
    setQuery(item);
    setSubmittedQuery(item);
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-margin-page max-w-6xl mx-auto w-full flex flex-col gap-8">
        {/* Hero Search Area */}
        <div className="flex flex-col items-center justify-center pt-12 pb-8">
          <div className="text-center mb-8">
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-3 tracking-tight flex items-center justify-center gap-3">
              <Icon name="psychology" size={36} className="text-primary" />
              自然语言语义搜索
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              描述你需要的功能、问题或概念，AI 将在全量仓库数据中挖掘最匹配的代码资产。
            </p>
          </div>

          {/* Giant Search Bar */}
          <div className="w-full max-w-3xl relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-tertiary/30 rounded-2xl blur opacity-30 group-hover:opacity-40 transition duration-500" />
            <div className="glass-panel relative rounded-2xl flex items-center p-2 pl-6 transition-all focus-within:ring-2 focus-within:ring-primary focus-within:border-primary bg-white">
              <Icon name="search" size={24} className="text-primary mr-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="帮我找几个好用的 React 动画库..."
                className="flex-1 bg-transparent border-none outline-none font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant/70 h-14 font-medium"
              />
              <div className="flex items-center gap-2 pr-2">
                <kbd className="hidden sm:flex items-center justify-center bg-surface-container px-2 py-1 rounded font-label-sm text-label-sm text-on-surface-variant border border-outline-variant/30 shadow-sm">
                  ⌘ K
                </kbd>
                <button
                  onClick={handleSearch}
                  className="bg-primary text-on-primary h-12 px-6 rounded-xl font-body-md text-body-md font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-md"
                >
                  <span>搜索</span>
                  <Icon name="arrow_forward" size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Suggestions Chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-3 max-w-4xl">
            <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center mr-2 font-medium">
              <Icon name="lightbulb" size={16} className="mr-1 text-warning" /> 建议:
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestionClick(s)}
                className="glass-panel bg-white px-4 py-1.5 rounded-full font-body-md text-body-md text-on-surface hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-2"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        {submittedQuery && (
          <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2 font-bold">
                <Icon name="temp_preferences_custom" size={24} className="text-primary" />
                AI 语义召回结果
              </h3>
              <span className="font-body-md text-body-md text-on-surface-variant font-medium">
                {isSearching ? '搜索中...' : `找到 ${results.length} 个高度匹配的仓库`}
              </span>
            </div>

            {results.length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-2">
                <Icon name="search_off" size={64} className="opacity-30" />
                <p className="font-body-md">未找到匹配的仓库，试试换个关键词</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {results.map((result, idx) => (
                  <SearchResultCard key={idx} result={result} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search History */}
        {history.length > 0 && (
          <div className="mt-8 pt-8 border-t border-outline-variant/30">
            <h4 className="font-headline-md text-[18px] text-on-surface mb-4 flex items-center gap-2 font-bold">
              <Icon name="history" size={20} className="text-on-surface-variant" />
              最近搜索历史
            </h4>
            <div className="flex flex-wrap gap-3">
              {history.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleHistoryClick(item)}
                  className="glass-panel bg-white px-4 py-2 rounded-lg font-body-md text-body-md text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-2 font-medium"
                >
                  <Icon name="manage_search" size={18} />
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* === 搜索结果卡片 === */
function SearchResultCard({ result }: { result: AiSearchResult }) {
  const { repository: repo, score, explanationZh, reasons, keywords } = result;

  return (
    <div className="glass-panel bg-white rounded-xl p-6 hover:-translate-y-1 transition-transform duration-300 group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm shrink-0">
              <Icon name="book" size={24} />
            </div>
            <h4 className="font-headline-md text-[22px] font-bold text-primary group-hover:underline cursor-pointer truncate">
              {repo.fullName}
            </h4>
            <span className="bg-success/10 px-2.5 py-1 rounded-md text-xs font-label-sm text-success border border-success/20 flex items-center gap-1 font-bold shadow-sm shrink-0">
              <Icon name="check_circle" size={14} />
              匹配度 {score}%
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-4 leading-relaxed">
            {repo.description ?? '暂无描述'}
          </p>

          {/* AI Reasoning Box */}
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 mb-4 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary rounded-l-lg" />
            <p className="font-body-md text-body-md text-on-surface flex items-start gap-2">
              <Icon name="psychology_alt" size={20} className="text-primary mt-0.5" />
              <span className="leading-relaxed">
                <strong className="text-primary">AI 分析理由：</strong> {explanationZh}
              </span>
            </p>
            {/* Match reasons */}
            {reasons.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 ml-7">
                {reasons.map((reason, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[11px] font-label-sm"
                  >
                    {reason.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Keywords */}
          {keywords.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {keywords.map((kw, i) => (
                <span
                  key={i}
                  className="bg-surface-container px-3 py-1 rounded-full font-label-sm text-label-sm text-on-surface-variant border border-outline-variant/30 font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side stats */}
        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1 text-on-surface-variant font-label-sm font-medium">
            <Icon name="star" size={18} className="text-warning" /> {compactNumber(repo.starsCount)}
          </div>
          {repo.language && (
            <div className="flex items-center gap-1 text-on-surface-variant font-label-sm font-medium">
              <Icon name="code_blocks" size={18} /> {repo.language}
            </div>
          )}
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 p-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors border border-outline-variant/30 shadow-sm"
          >
            <Icon name="open_in_new" size={20} />
          </a>
        </div>
      </div>
    </div>
  );
}

/* === 搜索引擎 (前端侧) === */

function searchRepositories(query: string, repos: RepositoryListItem[]): AiSearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results: AiSearchResult[] = [];

  for (const repo of repos) {
    const haystack = [
      repo.fullName,
      repo.description ?? '',
      repo.language ?? '',
      repo.topics.join(' '),
    ].join(' ').toLowerCase();

    let matchCount = 0;
    const reasons: SearchMatchReasonView[] = [];
    const matchedKeywords: string[] = [];

    for (const token of tokens) {
      const lowerToken = token.toLowerCase();
      if (haystack.includes(lowerToken)) {
        matchCount++;

        // 判断匹配类型
        if (repo.fullName.toLowerCase().includes(lowerToken)) {
          reasons.push({
            label: '仓库名称命中',
            detail: `仓库名 "${repo.fullName}" 包含关键词 "${token}"`,
          });
        } else if (repo.description?.toLowerCase().includes(lowerToken)) {
          reasons.push({
            label: '描述命中',
            detail: `仓库描述中包含关键词 "${token}"`,
          });
        } else if (repo.language?.toLowerCase().includes(lowerToken)) {
          reasons.push({
            label: '语言匹配',
            detail: `项目主要语言是 ${repo.language}`,
          });
        } else if (repo.topics.some((t) => t.toLowerCase().includes(lowerToken))) {
          reasons.push({
            label: 'Topic 命中',
            detail: `仓库 Topics 中包含 "${token}"`,
          });
          matchedKeywords.push(...repo.topics.filter((t) => t.toLowerCase().includes(lowerToken)));
        }
        matchedKeywords.push(token);
      }
    }

    if (matchCount === 0) continue;

    // 计算分数
    const tokenRatio = matchCount / tokens.length;
    const starBoost = Math.min(repo.starsCount / 10000, 0.15); // 高星仓库加分
    const score = Math.min(Math.round((tokenRatio * 85 + starBoost * 100) * 10) / 10, 99);

    // 生成 AI 分析理由
    const reasonLabels = reasons.map((r) => r.label).join('、');
    const explanationZh = reasons.length > 0
      ? `该仓库通过${reasonLabels}与您的查询"${query}"高度匹配。${repo.description ? '仓库描述：' + repo.description.slice(0, 100) : ''}适合作为候选方案。`
      : `该仓库包含您查询的关键词，与"${query}"有一定相关性。`;

    results.push({
      repository: repo,
      score,
      explanationZh,
      reasons: reasons.slice(0, 5),
      keywords: [...new Set(matchedKeywords)].slice(0, 8),
      aiSummary: null,
    });
  }

  // 按分数排序
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 20);
}

function tokenize(query: string): string[] {
  // 中文分词：按空格、标点分割，保留 2 字以上的词
  const tokens = query
    .toLowerCase()
    .split(/[\s,，。、;；!！?？()（）\[\]【】]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  // 如果是英文，也按单词分割
  const englishWords = query
    .split(/[^a-zA-Z0-9+#.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  return [...new Set([...tokens, ...englishWords])];
}
