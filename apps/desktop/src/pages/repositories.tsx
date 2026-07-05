import { useState, useMemo } from 'react';
import { useWorkspace } from '@/providers/workspace-provider';
import { Icon } from '@/components/ui/icon';
import { compactNumber } from '@/lib/format';
import type { RepositoryListItem, RepositoryDetailView, RepositoryAnnotationView, TagItem } from '@/types';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  Vue: '#41b883',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
};

function getLanguageColor(language: string | null): string {
  if (!language) return '#c3c6d7';
  return LANGUAGE_COLORS[language] ?? '#c3c6d7';
}

type SortBy = 'recent' | 'stars' | 'name';

export function RepositoriesPage() {
  const workspace = useWorkspace();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');

  // 应用筛选和排序
  const filteredRepos = useMemo(() => {
    if (!workspace.repositoryPage) return [];

    let repos = [...workspace.repositoryPage.items];

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      repos = repos.filter(
        (repo) =>
          repo.fullName.toLowerCase().includes(keyword) ||
          repo.description?.toLowerCase().includes(keyword) ||
          repo.topics.some((t) => t.toLowerCase().includes(keyword)),
      );
    }

    if (selectedLanguage) {
      repos = repos.filter((repo) => repo.language === selectedLanguage);
    }

    repos.sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return b.starsCount - a.starsCount;
        case 'name':
          return a.fullName.localeCompare(b.fullName);
        case 'recent':
        default:
          return b.starredAt.localeCompare(a.starredAt);
      }
    });

    return repos;
  }, [workspace.repositoryPage, searchKeyword, selectedLanguage, sortBy]);

  const selectedRepo = workspace.selectedRepository;

  return (
    <div className="flex-1 overflow-hidden p-6 flex gap-6 h-full">
      {/* Left Pane: Repo List */}
      <div className="w-1/3 min-w-[320px] max-w-[450px] flex flex-col h-full bg-surface-container-low rounded-xl border border-white/10 shadow-sm overflow-hidden">
        {/* List Header & Controls */}
        <div className="p-4 border-b border-outline-variant/20 bg-surface/50 backdrop-blur-md shrink-0">
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface mb-3 tracking-tight">
            知识库列表
          </h1>
          <div className="flex flex-col gap-2">
            {/* Sort + Search */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Icon name="filter_list" size={18} className="absolute left-2.5 top-2 text-on-surface-variant" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full pl-9 pr-8 py-1.5 text-sm bg-surface rounded-lg border border-outline-variant/40 focus:ring-1 focus:ring-primary focus:border-primary appearance-none text-on-surface shadow-sm cursor-pointer hover:border-outline-variant transition-colors"
                >
                  <option value="recent">最近加星</option>
                  <option value="stars">最活跃</option>
                  <option value="name">按名称</option>
                </select>
                <Icon name="expand_more" size={18} className="absolute right-2.5 top-2 text-on-surface-variant pointer-events-none" />
              </div>
              <button className="p-1.5 bg-surface border border-outline-variant/40 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 transition-all shadow-sm group">
                <Icon name="sort" size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Icon name="search" size={18} className="absolute left-2.5 top-2 text-on-surface-variant" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索仓库..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-surface rounded-lg border border-outline-variant/40 focus:ring-1 focus:ring-primary focus:border-primary text-on-surface placeholder:text-on-surface-variant shadow-sm"
              />
            </div>

            {/* Language + Status filters */}
            <div className="flex gap-2 text-xs">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="flex-1 py-1 px-2 bg-surface rounded border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant cursor-pointer"
              >
                <option value="">全部语言</option>
                {workspace.repositoryLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <select className="flex-1 py-1 px-2 bg-surface rounded border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant cursor-pointer">
                <option>星数不限</option>
                <option>&gt; 10k</option>
                <option>&gt; 50k</option>
                <option>&gt; 100k</option>
              </select>
              <select className="flex-1 py-1 px-2 bg-surface rounded border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant cursor-pointer">
                <option>全部状态</option>
                <option>已同步</option>
                <option>同步中</option>
              </select>
            </div>
          </div>

          {/* Quick Tags */}
          <div className="flex gap-2 mt-3 overflow-x-auto custom-scrollbar pb-1">
            <button className="px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container text-[11px] font-label-sm font-medium whitespace-nowrap cursor-pointer hover:brightness-110 transition-all">
              全部 ({workspace.repositoryStats.total})
            </button>
            {workspace.tags.slice(0, 5).map((tag) => (
              <button
                key={tag.id}
                className="px-2.5 py-1 rounded-full glass-panel text-on-surface text-[11px] font-label-sm font-medium whitespace-nowrap cursor-pointer hover:bg-surface-variant/50 transition-all border border-outline-variant/30"
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1.5">
          {workspace.isLoadingRepositories ? (
            <div className="flex items-center justify-center h-full">
              <Icon name="progress_activity" size={32} className="text-primary animate-spin" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-2">
              <Icon name="book" size={48} className="text-on-surface-variant/30" />
              <p className="text-on-surface-variant font-body-md">暂无匹配的仓库</p>
            </div>
          ) : (
            filteredRepos.map((repo) => (
              <RepoListItem
                key={repo.id}
                repo={repo}
                isSelected={selectedRepo?.id === repo.id}
                onClick={() => workspace.setSelectedRepositoryId(repo.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Detail View */}
      {selectedRepo ? (
        <RepoDetailPanel
          repo={selectedRepo}
          detail={workspace.repositoryDetail}
          annotation={workspace.annotation}
          tags={workspace.tags}
          isLoadingDetail={workspace.isLoadingRepositoryDetail}
          noteDraft={workspace.noteDraft}
          onNoteChange={workspace.setNoteDraft}
          onSaveAnnotation={workspace.handleSaveAnnotation}
          isSavingAnnotation={workspace.isSavingAnnotation}
        />
      ) : (
        <div className="flex-1 glass-card rounded-xl flex items-center justify-center">
          <div className="text-center">
            <Icon name="star" size={64} className="text-on-surface-variant/30 mx-auto mb-4" />
            <p className="text-on-surface-variant font-body-md">选择一个仓库查看详情</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* === 仓库列表项 === */
function RepoListItem(props: { repo: RepositoryListItem; isSelected: boolean; onClick: () => void }) {
  const { repo, isSelected, onClick } = props;

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg cursor-pointer transition-all relative overflow-hidden group ${
        isSelected
          ? 'bg-primary-fixed/30 border border-primary/30 shadow-sm'
          : 'bg-surface hover:bg-surface-variant/40 border border-transparent hover:border-outline-variant/20'
      }`}
    >
      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />}
      <div className={`flex justify-between items-start mb-1 ${isSelected ? 'pl-2' : ''}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="book" size={16} className={isSelected ? 'text-primary' : 'text-on-surface-variant'} />
          <h3 className="font-medium text-sm text-on-surface truncate font-headline-lg" style={{ fontSize: '14px', lineHeight: '20px' }}>
            {repo.fullName}
          </h3>
        </div>
        <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5 bg-surface-variant/30 px-1.5 py-0.5 rounded shrink-0">
          <Icon name="star" size={12} /> {compactNumber(repo.starsCount)}
        </span>
      </div>
      <p className={`text-xs text-on-surface-variant line-clamp-1 mb-1 ${isSelected ? 'pl-2' : ''} leading-relaxed`}>
        {repo.description ?? '暂无描述'}
      </p>
      {isSelected && (
        <p className="text-[11px] text-primary/80 line-clamp-1 mb-2 pl-2 bg-primary/5 rounded px-1 py-0.5 inline-block">
          AI: 暂无摘要
        </p>
      )}
      <div className={`flex items-center justify-between ${isSelected ? 'pl-2' : ''}`}>
        <div className="flex items-center gap-3">
          {repo.language && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getLanguageColor(repo.language) }} />
              <span className="text-[10px] text-on-surface font-label-sm">{repo.language}</span>
            </div>
          )}
        </div>
        <span className="text-[10px] text-on-surface-variant">{formatRelativeTime(repo.starredAt)}</span>
      </div>
    </div>
  );
}

/* === 仓库详情面板 === */
function RepoDetailPanel(props: {
  repo: RepositoryListItem;
  detail: RepositoryDetailView | null;
  annotation: RepositoryAnnotationView | null;
  tags: TagItem[];
  isLoadingDetail: boolean;
  noteDraft: string;
  onNoteChange: (value: string) => void;
  onSaveAnnotation: () => Promise<void>;
  isSavingAnnotation: boolean;
}) {
  const { repo, detail, annotation, tags, isLoadingDetail, noteDraft, onNoteChange, onSaveAnnotation, isSavingAnnotation } = props;
  const aiDoc = detail?.aiDocument;

  return (
    <div className="flex-1 flex flex-col h-full rounded-xl overflow-hidden glass-panel shadow-sm border border-white/10">
      {/* Detail Header */}
      <div className="p-6 border-b border-white/20 bg-surface/40 backdrop-blur-md shrink-0 flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-md bg-white p-1 border border-outline-variant/30 flex items-center justify-center shrink-0">
              <Icon name="book" size={18} className="text-on-surface-variant" />
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight truncate">
              {repo.fullName}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-outline-variant/20 text-on-surface text-[10px] font-label-sm border border-outline-variant/30 shrink-0">
              公开
            </span>
          </div>
          <p className="text-on-surface-variant text-sm max-w-2xl">{repo.description ?? '暂无描述'}</p>
          {/* Stats */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary cursor-pointer transition-colors group">
              <Icon name="star" size={18} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium">{compactNumber(repo.starsCount)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary cursor-pointer transition-colors group">
              <Icon name="fork_right" size={18} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium">{compactNumber(repo.forksCount)}</span>
            </div>
            <div className="h-4 w-px bg-outline-variant/40 mx-2" />
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Icon name="link" size={16} />
              {repo.htmlUrl.replace('https://', '')}
            </a>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex gap-2 shrink-0">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:brightness-110 transition-all flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <Icon name="open_in_new" size={18} /> 在浏览器打开
          </a>
        </div>
      </div>

      {/* Scrollable Detail Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex gap-6 bg-surface-container-lowest/30">
        {/* Main Content (README + Notes) */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* README */}
          <div className="bg-surface/50 p-6 rounded-xl border border-white/20 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="description" size={20} className="text-primary" />
              <h3 className="font-headline-md text-lg font-semibold text-on-surface">README</h3>
            </div>
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Icon name="progress_activity" size={24} className="text-primary animate-spin" />
              </div>
            ) : detail?.readme ? (
              <div className="prose prose-sm max-w-none text-on-surface font-body-lg whitespace-pre-wrap">
                {detail.readme.rawMarkdown.slice(0, 3000)}
                {detail.readme.rawMarkdown.length > 3000 && '\n\n... (已截断，完整内容请在浏览器中查看)'}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant gap-2">
                <Icon name="book" size={48} className="opacity-30" />
                <p className="font-body-md text-sm">该仓库暂无 README 缓存，请先抓取 README</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-surface/50 p-6 rounded-xl border border-white/20 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="edit_note" size={20} className="text-primary" />
                <h3 className="font-headline-md text-lg font-semibold text-on-surface">个人笔记</h3>
              </div>
              <button
                onClick={() => void onSaveAnnotation()}
                disabled={isSavingAnnotation}
                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-sm font-medium hover:brightness-110 transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
              >
                <Icon name="save" size={16} /> 保存
              </button>
            </div>
            {/* Tags */}
            {annotation && annotation.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {annotation.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-2.5 py-1 rounded-full text-xs font-label-sm flex items-center gap-1"
                    style={{ backgroundColor: `${tag.color ?? '#c3c6d7'}20`, color: tag.color ?? '#434655' }}
                  >
                    <Icon name="label" size={12} /> {tag.name}
                  </span>
                ))}
              </div>
            )}
            <textarea
              value={noteDraft}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="为这个仓库写下你的笔记..."
              className="w-full min-h-[120px] bg-surface-container-low rounded-lg border border-outline-variant/30 p-3 text-sm text-on-surface font-body-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y"
            />
          </div>
        </div>

        {/* Right Sidebar: AI Insights */}
        <div className="w-80 shrink-0 space-y-6 flex flex-col">
          <div className="rounded-xl bg-gradient-to-br from-primary-container/10 to-transparent border border-primary/20 p-5 shadow-sm relative overflow-hidden group flex-1 flex flex-col">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-700" />
            <div className="flex items-center gap-2 mb-4">
              <Icon name="auto_awesome" size={20} className="text-primary" />
              <h3 className="font-headline-md text-base font-semibold text-primary">AI 洞察</h3>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {/* AI Summary */}
              {aiDoc ? (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-2 font-label-sm flex items-center gap-1">
                    <Icon name="summarize" size={14} /> 中文摘要
                  </h4>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">{aiDoc.summaryZh}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-on-surface-variant gap-2">
                  <Icon name="psychology" size={32} className="opacity-30" />
                  <p className="text-[11px]">暂无 AI 摘要</p>
                </div>
              )}

              {/* Keywords */}
              {aiDoc && aiDoc.keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-2 font-label-sm flex items-center gap-1">
                    <Icon name="key" size={14} /> 关键词
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {aiDoc.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-surface-variant/30 text-on-surface-variant text-[10px] font-label-sm"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Tags */}
              {aiDoc && aiDoc.suggestedTags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-2 font-label-sm flex items-center gap-1">
                    <Icon name="recommend" size={14} /> 建议标签
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {aiDoc.suggestedTags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-label-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics from repo */}
              {repo.topics.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-2 font-label-sm flex items-center gap-1">
                    <Icon name="topic" size={14} /> 仓库 Topics
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {repo.topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded bg-surface-variant/20 text-on-surface-variant text-[10px] font-label-sm"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return '刚刚';
  if (diffH < 24) return `${diffH}小时前活跃`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return '1天前活跃';
  return `${diffD}天前活跃`;
}
