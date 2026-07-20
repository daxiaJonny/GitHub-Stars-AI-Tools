import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { compactNumber, formatDate } from '@/lib/format';
import type { RankingItem } from '@/types';

export function RankingList(props: {
  items: RankingItem[];
  page: number;
  limit: number;
  selectedFullName: string | null;
  pendingStarFullNames: Set<string>;
  allowStar: boolean;
  onOpenDetails: (repository: RankingItem) => void;
  onStar: (repository: RankingItem) => void;
}) {
  return (
    <div className="overflow-hidden border-y border-outline-variant/25 bg-surface">
      {props.items.map((repository, index) => {
        const rank = (props.page - 1) * props.limit + index + 1;
        const isPending = props.pendingStarFullNames.has(repository.fullName);
        const isSelected = props.selectedFullName === repository.fullName;

        return (
          <article
            key={repository.fullName}
            className={`grid min-h-[112px] grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-outline-variant/20 px-4 py-4 transition-colors last:border-b-0 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:px-5 ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
          >
            <div className="flex items-start justify-center pt-0.5">
              <span
                className={`flex size-8 items-center justify-center rounded-md font-mono text-sm font-semibold tabular-nums ${rank <= 3 ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}
                aria-label={`第 ${rank} 名`}
              >
                {rank}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => props.onOpenDetails(repository)}
                  className="min-w-0 truncate text-left text-sm font-semibold text-on-surface underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {repository.fullName}
                </button>
                {repository.isStarred ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                    <Icon name="star" size={13} fill />
                    已收藏
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 line-clamp-2 max-w-3xl text-xs leading-5 text-on-surface-variant">
                {repository.description ?? '该仓库暂未提供项目描述。'}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-on-surface-variant">
                <span className="font-medium text-on-surface">{repository.language ?? '其他语言'}</span>
                {repository.topics.slice(0, 4).map((topic) => (
                  <span key={topic} className="rounded-md bg-surface-container px-2 py-1 leading-none">
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-3 pl-[56px] sm:col-span-1 sm:flex-col sm:items-end sm:justify-center sm:pl-0">
              <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums text-on-surface-variant sm:justify-end">
                <span className="inline-flex items-center gap-1" title="GitHub Stars">
                  <Icon name="star" size={14} />
                  {compactNumber(repository.starsCount)}
                </span>
                <span className="inline-flex items-center gap-1" title="Forks">
                  <Icon name="fork_right" size={14} />
                  {compactNumber(repository.forksCount)}
                </span>
                <span>{repository.pushedAt ? `${formatDate(repository.pushedAt)} 更新` : '暂无更新时间'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <Button size="sm" variant="outline" onClick={() => props.onOpenDetails(repository)} title="查看介绍" aria-label="查看介绍">
                  <Icon name="menu_book" size={15} />
                </Button>
                <Button asChild size="sm" variant="ghost" title="在 GitHub 打开">
                  <a href={repository.htmlUrl} target="_blank" rel="noreferrer" aria-label={`在 GitHub 打开 ${repository.fullName}`}>
                    <Icon name="open_in_new" size={15} />
                  </a>
                </Button>
                {props.allowStar ? (
                  <Button
                    size="sm"
                    variant={repository.isStarred ? 'ghost' : 'default'}
                    disabled={isPending}
                    onClick={() => props.onStar(repository)}
                    title={repository.isStarred ? '取消 Stars' : '加入 Stars'}
                    aria-label={repository.isStarred ? '取消 Stars' : '加入 Stars'}
                  >
                    <Icon
                      name={isPending ? 'progress_activity' : 'star'}
                      size={15}
                      className={isPending ? 'animate-spin' : ''}
                      fill={repository.isStarred}
                    />
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
