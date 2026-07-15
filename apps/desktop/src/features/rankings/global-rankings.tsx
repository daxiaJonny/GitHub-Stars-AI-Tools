import type { ReactNode } from 'react';
import { RankingsWorkspace, type RankingKindOption } from '@/features/rankings/rankings-workspace';

const GLOBAL_RANKING_KINDS: RankingKindOption[] = [
  { value: 'trending', label: '趋势榜', description: '过去 30 天仍在更新且 Stars 大于 50 的项目' },
  { value: 'rising', label: '新锐榜', description: '过去 90 天创建且 Stars 大于 10 的项目' },
  { value: 'popular', label: '热门榜', description: 'Stars 大于 1000 且过去一年仍在更新的项目' },
];

const GLOBAL_LANGUAGES = [
  'TypeScript',
  'Python',
  'JavaScript',
  'Rust',
  'Go',
  'Java',
  'C++',
  'C#',
  'Kotlin',
  'Swift',
];

export function GlobalRankings(props: { accountId: string; pageHeader?: ReactNode }) {
  return (
    <RankingsWorkspace
      accountId={props.accountId}
      command="list_github_rankings"
      title="开源榜单"
      description="基于 GitHub 公开搜索结果，按近期活跃度与总 Stars 生成近似榜单；不代表一段时间内的 Stars 增长量。"
      pageHeader={props.pageHeader}
      kindOptions={GLOBAL_RANKING_KINDS}
      languageOptions={GLOBAL_LANGUAGES}
      allowRefresh
      allowStar
    />
  );
}
