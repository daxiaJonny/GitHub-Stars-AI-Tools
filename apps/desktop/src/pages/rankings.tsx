import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { GlobalRankings } from '@/features/rankings/global-rankings';
import { PersonalRankings } from '@/features/rankings/personal-rankings';
import { useWorkspace } from '@/providers/workspace-provider';
import type { RankingSection } from '@/types';

const RANKING_SECTIONS: { value: RankingSection; label: string; description: string; icon: string }[] = [
  { value: 'global', label: '开源榜单', description: 'GitHub 活跃项目', icon: 'public' },
  { value: 'personal', label: '我的 Stars', description: '个人收藏排名', icon: 'kid_star' },
];

type RankingsPageProps = {
  onOpenSettings: () => void;
};

export function RankingsPage(props: RankingsPageProps) {
  const workspace = useWorkspace();
  const [section, setSection] = useState<RankingSection>('global');
  const accountId = workspace.authState.user ? String(workspace.authState.user.id) : null;

  const pageHeader = (
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-on-surface">排行榜</h1>
      <p className="mt-1 text-sm text-on-surface-variant">发现活跃开源项目，也可以查看个人 GitHub Stars 排名</p>
      <div className="mt-4 inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 bg-surface-container-low p-1">
        {RANKING_SECTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setSection(item.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              section === item.value ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-pressed={section === item.value}
          >
            <Icon name={item.icon} size={16} fill={section === item.value} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="rankings-page flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background" aria-label="排行榜">
      {!accountId ? (
        <RankingConnectionRequired onOpenSettings={props.onOpenSettings} />
      ) : section === 'global' ? (
        <GlobalRankings accountId={accountId} pageHeader={pageHeader} />
      ) : (
        <PersonalRankings accountId={accountId} languages={workspace.repositoryLanguages} pageHeader={pageHeader} />
      )}
    </section>
  );
}

function RankingConnectionRequired(props: { onOpenSettings: () => void }) {
  return (
    <div className="rankings-page flex h-full min-h-[420px] items-center justify-center bg-background px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon name="leaderboard" size={24} />
        </span>
        <h2 className="mt-4 text-base font-semibold text-on-surface">连接 GitHub 后查看排行榜</h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          开源榜单需要 GitHub Token 获取公开搜索结果；个人榜单读取同步到本地的 Stars。
        </p>
        <Button className="mt-5" onClick={props.onOpenSettings}>
          <Icon name="link" size={16} />
          连接 GitHub
        </Button>
      </div>
    </div>
  );
}
