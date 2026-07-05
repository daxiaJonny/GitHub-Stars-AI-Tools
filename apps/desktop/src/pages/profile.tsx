import { useMemo } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import { Radar, Line } from 'react-chartjs-2';
import { useWorkspace } from '@/providers/workspace-provider';
import { Icon } from '@/components/ui/icon';
import { compactNumber } from '@/lib/format';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
);

const CHART_COLORS = {
  primary: '#2563eb',
  primaryContainer: '#eeefff',
  onSurfaceVariant: '#434655',
  gridColor: 'rgba(67, 70, 85, 0.1)',
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#DEA584',
  Go: '#00ADD8',
  'C++': '#f34b7d',
};

export function ProfilePage() {
  const workspace = useWorkspace();

  // 从仓库数据派生统计
  const stats = useMemo(() => {
    if (!workspace.repositoryPage) {
      return {
        totalStars: 0,
        totalNotes: 0,
        languageBreakdown: [] as { language: string; count: number; percentage: number }[],
        monthlyTrend: [] as { month: string; count: number }[],
        recentRepos: [] as typeof workspace.repositoryPage extends null ? never : NonNullable<typeof workspace.repositoryPage>['items'],
      };
    }

    const items = workspace.repositoryPage.items;
    const totalStars = items.reduce((sum, r) => sum + r.starsCount, 0);

    // 语言分布 (雷达图)
    const langMap = new Map<string, number>();
    for (const r of items) {
      const lang = r.language ?? '其他';
      langMap.set(lang, (langMap.get(lang) ?? 0) + 1);
    }
    const total = items.length || 1;
    const languageBreakdown = Array.from(langMap.entries())
      .map(([language, count]) => ({ language, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 月度趋势 (折线图)
    const monthMap = new Map<string, number>();
    for (const r of items) {
      const month = r.starredAt.slice(0, 7); // YYYY-MM
      monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
    }
    const now = new Date();
    const months: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, count: monthMap.get(key) ?? 0 });
    }

    // 最近收藏
    const recentRepos = [...items].sort((a, b) => b.starredAt.localeCompare(a.starredAt)).slice(0, 3);

    return {
      totalStars,
      totalNotes: 0,
      languageBreakdown,
      monthlyTrend: months,
      recentRepos,
    };
  }, [workspace.repositoryPage]);

  const user = workspace.authState.user;

  // 雷达图数据
  const radarData = useMemo(() => {
    const topLangs = stats.languageBreakdown;
    return {
      labels: topLangs.length > 0 ? topLangs.map((l) => l.language) : ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go', 'C++'],
      datasets: [
        {
          label: 'Stars 占比',
          data: topLangs.length > 0 ? topLangs.map((l) => l.percentage) : [0, 0, 0, 0, 0, 0],
          backgroundColor: 'rgba(37, 99, 235, 0.2)',
          borderColor: CHART_COLORS.primary,
          pointBackgroundColor: CHART_COLORS.primary,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: CHART_COLORS.primary,
          borderWidth: 2,
        },
      ],
    };
  }, [stats.languageBreakdown]);

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: CHART_COLORS.gridColor },
        grid: { color: CHART_COLORS.gridColor },
        pointLabels: {
          font: { family: 'Inter', size: 12 },
          color: CHART_COLORS.onSurfaceVariant,
        },
        ticks: { display: false },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  // 折线图数据
  const lineData = useMemo(() => {
    const months = stats.monthlyTrend;
    return {
      labels: months.map((m) => {
        const [year, month] = m.month.split('-');
        return `${parseInt(month)}月`;
      }),
      datasets: [
        {
          label: '新增收藏仓库',
          data: months.map((m) => m.count),
          borderColor: CHART_COLORS.primary,
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return 'rgba(37, 99, 235, 0.1)';
            const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');
            return gradient;
          },
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: CHART_COLORS.primaryContainer,
          pointBorderColor: CHART_COLORS.primary,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [stats.monthlyTrend]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: 'Inter', size: 12 },
          color: CHART_COLORS.onSurfaceVariant,
        },
      },
      y: {
        grid: { color: CHART_COLORS.gridColor },
        ticks: {
          font: { family: 'Inter', size: 12 },
          color: CHART_COLORS.onSurfaceVariant,
        },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(25, 27, 35, 0.9)',
        titleFont: { family: 'Inter', size: 13 },
        bodyFont: { family: 'Inter', size: 13 },
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
      },
    },
  };

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-margin-page pb-24">
        {/* Header Profile Section */}
        <div className="glass-card rounded-xl p-8 mb-8 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          {/* Avatar */}
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-surface shadow-sm shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.login} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary-container/20 flex items-center justify-center">
                <Icon name="person" size={64} className="text-primary" />
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 text-center md:text-left z-10">
            <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
              <h2 className="font-headline-lg text-on-surface">{user?.login ?? '未连接'}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-container/10 text-tertiary-container font-label-sm text-label-sm font-semibold border border-tertiary-container/20">
                <Icon name="workspace_premium" size={14} fill />
                Pro 会员
              </span>
            </div>
            <p className="font-body-lg text-on-surface-variant mb-4 max-w-2xl">
              全栈开发者 / 开源爱好者。热衷于探索前沿技术框架，专注于构建高性能、模块化的系统架构。致力于将复杂问题转化为优雅的代码解决方案。
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <div className="flex items-center gap-1.5 text-on-surface-variant font-body-md">
                <Icon name="location_on" size={18} />
                <span>Shanghai, China</span>
              </div>
              {user?.htmlUrl && (
                <div className="flex items-center gap-1.5 text-on-surface-variant font-body-md">
                  <Icon name="link" size={18} />
                  <a href={user.htmlUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    {user.htmlUrl.replace('https://', '')}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-on-surface-variant font-body-md">
                <Icon name="calendar_today" size={18} />
                <span>加入于 2021年 8月</span>
              </div>
            </div>
          </div>
          {/* Edit Button */}
          <div className="shrink-0 flex gap-3 z-10">
            <button className="px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-body-md hover:bg-surface-container-high transition-colors active:scale-95">
              编辑资料
            </button>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Radar Chart (Skills) */}
          <div className="glass-card rounded-xl p-6 lg:col-span-1 flex flex-col h-[400px]">
            <div className="flex items-center gap-2 mb-6">
              <Icon name="radar" size={20} className="text-primary" />
              <h3 className="font-headline-md text-on-surface text-lg">开发者技能偏好</h3>
            </div>
            <div className="flex-1 relative w-full h-full">
              <Radar data={radarData} options={radarOptions} />
            </div>
            <p className="font-label-sm text-on-surface-variant text-center mt-4">基于 Stars 仓库主要语言分析</p>
          </div>

          {/* Stats & Recent Activity (2 cols) */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Stat Card 1: Notes */}
            <div className="glass-card rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
              <div className="flex items-center gap-3 mb-4 text-on-surface-variant z-10">
                <Icon name="description" size={20} className="p-2 bg-surface-container rounded-lg" />
                <span className="font-body-md font-medium">已导出笔记数</span>
              </div>
              <div className="flex items-baseline gap-2 z-10">
                <span className="font-headline-lg text-4xl">{compactNumber(stats.totalStars)}</span>
                <span className="font-body-md text-success flex items-center">
                  <Icon name="trending_up" size={14} /> 12%
                </span>
              </div>
            </div>
            {/* Stat Card 2: AI Words */}
            <div className="glass-card rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-tertiary-container/5 rounded-full blur-2xl group-hover:bg-tertiary-container/10 transition-colors duration-500" />
              <div className="flex items-center gap-3 mb-4 text-on-surface-variant z-10">
                <Icon name="psychology" size={20} className="p-2 bg-surface-container rounded-lg" />
                <span className="font-body-md font-medium">AI 总结总字数</span>
              </div>
              <div className="flex items-baseline gap-2 z-10">
                <span className="font-headline-lg text-4xl">45.2w</span>
                <span className="font-body-md text-on-surface-variant">字</span>
              </div>
            </div>
            {/* Recent Collections List */}
            <div className="glass-card rounded-xl p-6 sm:col-span-2 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="bookmark" size={20} className="text-primary" />
                  <h3 className="font-headline-md text-on-surface text-lg">最近深度解析仓库</h3>
                </div>
                <button className="font-body-md text-primary hover:underline">查看全部</button>
              </div>
              <div className="flex flex-col gap-3 flex-1 justify-center">
                {stats.recentRepos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant gap-2">
                    <Icon name="inbox" size={48} className="opacity-30" />
                    <p className="font-body-md text-sm">暂无收藏，同步后即可查看</p>
                  </div>
                ) : (
                  stats.recentRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors border border-transparent hover:border-card-border cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm"
                          style={{
                            backgroundColor: `${LANGUAGE_COLORS[repo.language ?? ''] ?? '#c3c6d7'}20`,
                            color: LANGUAGE_COLORS[repo.language ?? ''] ?? '#434655',
                          }}
                        >
                          {repo.language?.slice(0, 2).toUpperCase() ?? '??'}
                        </div>
                        <div>
                          <div className="font-body-md font-medium text-on-surface">{repo.fullName}</div>
                          <div className="font-label-sm text-on-surface-variant">
                            {repo.description?.slice(0, 40) ?? '暂无描述'}
                          </div>
                        </div>
                      </div>
                      <span className="font-label-sm text-on-surface-variant">
                        {formatRelativeTime(repo.starredAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Annual Trend Chart */}
        <div className="glass-card rounded-xl p-6 w-full h-[350px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="monitoring" size={20} className="text-primary" />
              <h3 className="font-headline-md text-on-surface text-lg">年度收藏趋势</h3>
            </div>
            <div className="flex items-center gap-2">
              <select className="bg-surface-container border border-outline-variant text-on-surface text-sm rounded-md py-1 pl-2 pr-8 focus:ring-primary focus:border-primary">
                <option>{new Date().getFullYear()}</option>
                <option>{new Date().getFullYear() - 1}</option>
                <option>{new Date().getFullYear() - 2}</option>
              </select>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <Line data={lineData} options={lineOptions} />
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
  if (diffH < 24) return `${diffH} 小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return '昨天';
  if (diffD < 30) return `${diffD} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
