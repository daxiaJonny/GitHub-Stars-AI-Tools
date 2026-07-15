import type { ReactNode } from 'react';
import { RankingsWorkspace, type RankingKindOption } from '@/features/rankings/rankings-workspace';

const PERSONAL_RANKING_KINDS: RankingKindOption[] = [
  { value: 'stars', label: 'Stars 最多', description: '按仓库当前 GitHub Stars 数量排序' },
  { value: 'updated', label: '最近更新', description: '按仓库最近一次推送时间排序' },
  { value: 'starred', label: '最近收藏', description: '按加入个人 GitHub Stars 的时间排序' },
];

export function PersonalRankings(props: { accountId: string; languages: string[]; pageHeader?: ReactNode }) {
  return (
    <RankingsWorkspace
      accountId={props.accountId}
      command="list_personal_rankings"
      title="我的 Stars"
      description="根据已同步的个人收藏统一排名，切换页码也能保持准确名次。"
      pageHeader={props.pageHeader}
      kindOptions={PERSONAL_RANKING_KINDS}
      languageOptions={props.languages}
      allowRefresh={false}
      allowStar={false}
    />
  );
}
