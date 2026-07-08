import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
import { useAppSettings } from '@/providers/settings-provider';
import { Icon } from '@/components/ui/icon';
import { compactNumber } from '@/lib/format';
import type { ProfileStats, RepositoryListItem } from '@/types';

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

const DEFAULT_CHART_THEME = {
  primary: '#2563eb',
  primarySoft: 'rgb(37 99 235 / 0.18)',
  primaryMuted: 'rgb(37 99 235 / 0.4)',
  primaryTransparent: 'rgb(37 99 235 / 0)',
  onSurfaceVariant: '#434655',
  onSurface: '#191b23',
  surface: '#ffffff',
  surfaceHigh: '#f3f3fe',
  gridColor: 'rgb(195 198 215 / 0.36)',
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#DEA584',
  Go: '#00ADD8',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Ruby: '#701516',
  Swift: '#F05138',
  PHP: '#4F5D95',
  Vue: '#41B883',
};

type ProfilePageProps = {
  onOpenRepository: (repository: RepositoryListItem) => void;
  onOpenSettings: () => void;
};

const EMPTY_PROFILE_STATS: ProfileStats = {
  totalStars: 0,
  totalNotes: 0,
  totalAiWords: 0,
  totalAiInputTokens: 0,
  totalAiOutputTokens: 0,
  languageBreakdown: [],
  monthlyTrend: [],
  recentRepos: [],
};

export function ProfilePage(props: ProfilePageProps) {
  const workspace = useWorkspace();
  const settingsHook = useAppSettings();
  const user = workspace.authState.user;
  const [stats, setStats] = useState<ProfileStats>(EMPTY_PROFILE_STATS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chartTheme, setChartTheme] = useState<ChartTheme>(DEFAULT_CHART_THEME);

  useEffect(() => {
    const refreshChartTheme = () => {
      const nextTheme = readChartTheme();
      setChartTheme((currentTheme) => (
        areChartThemesEqual(currentTheme, nextTheme) ? currentTheme : nextTheme
      ));
    };
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(refreshChartTheme);

    refreshChartTheme();
    mediaQuery.addEventListener('change', refreshChartTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => {
      mediaQuery.removeEventListener('change', refreshChartTheme);
      observer.disconnect();
    };
  }, [settingsHook.settings.theme]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStats(EMPTY_PROFILE_STATS);
      setErrorMessage(null);
      return;
    }
    const request = { accountId: String(user.id) };
    invoke<ProfileStats>('get_profile_stats', { request })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((reason) => {
        if (!cancelled) setErrorMessage(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, workspace.repositoryPage, workspace.repositoryDetail, workspace.annotation, workspace.syncSummary]);

  // 雷达图数据
  const radarData = useMemo(() => {
    const topLangs = stats.languageBreakdown;
    const maxCount = Math.max(...topLangs.map((item) => item.count), 1);
    return {
      labels: topLangs.map((l) => l.language),
      datasets: [
        {
          label: '相对偏好',
          data: topLangs.map((l) => Math.max(8, Math.round((l.count / maxCount) * 100))),
          backgroundColor: chartTheme.primarySoft,
          borderColor: chartTheme.primary,
          pointBackgroundColor: chartTheme.primary,
          pointBorderColor: chartTheme.surface,
          pointHoverBackgroundColor: chartTheme.surface,
          pointHoverBorderColor: chartTheme.primary,
          borderWidth: 2,
        },
      ],
    };
  }, [chartTheme, stats.languageBreakdown]);
  const languageRepositoryTotal = useMemo(
    () => stats.languageBreakdown.reduce((total, item) => total + item.count, 0),
    [stats.languageBreakdown],
  );

  const radarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 8,
        right: 18,
        bottom: 8,
        left: 18,
      },
    },
    scales: {
      r: {
        angleLines: { color: chartTheme.gridColor },
        grid: { color: chartTheme.gridColor },
        pointLabels: {
          font: { family: 'Inter', size: 13 },
          color: chartTheme.onSurfaceVariant,
          padding: 6,
        },
        ticks: { display: false },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: { display: false },
    },
  }), [chartTheme]);

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
          borderColor: chartTheme.primary,
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            if (!chartArea) return chartTheme.primarySoft;
            const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, chartTheme.primaryMuted);
            gradient.addColorStop(1, chartTheme.primaryTransparent);
            return gradient;
          },
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: chartTheme.surface,
          pointBorderColor: chartTheme.primary,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [chartTheme, stats.monthlyTrend]);
  const hasLanguageBreakdown = stats.languageBreakdown.length > 0;
  const hasMonthlyTrend = stats.monthlyTrend.length > 0;

  const lineOptions = useMemo(() => ({
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
          color: chartTheme.onSurfaceVariant,
        },
      },
      y: {
        grid: { color: chartTheme.gridColor },
        ticks: {
          font: { family: 'Inter', size: 12 },
          color: chartTheme.onSurfaceVariant,
        },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartTheme.surfaceHigh,
        titleColor: chartTheme.onSurface,
        bodyColor: chartTheme.onSurface,
        titleFont: { family: 'Inter', size: 13 },
        bodyFont: { family: 'Inter', size: 13 },
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
      },
    },
  }), [chartTheme]);

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4 pb-20 sm:p-5 lg:p-6">
        {/* 个人资料标题区 */}
        <div className="glass-card rounded-xl p-6 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          {/* 头像 */}
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-surface shadow-sm shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.login} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary-container/20 flex items-center justify-center">
                <Icon name="person" size={64} className="text-primary" />
              </div>
            )}
          </div>
          {/* 资料信息 */}
          <div className="flex-1 text-center md:text-left z-10">
            <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
              <h2 className="font-headline-lg text-on-surface">{user?.login ?? '未连接'}</h2>
            </div>
            <p className="font-body-lg text-on-surface-variant mb-4 max-w-2xl">
              {user ? '基于你的 GitHub Stars、笔记和 AI 摘要生成的本地知识库画像。' : '连接 GitHub 后即可查看个人知识库统计。'}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              {user?.htmlUrl && (
                <div className="flex items-center gap-1.5 text-on-surface-variant font-body-md">
                  <Icon name="link" size={18} />
                  <a href={user.htmlUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    {user.htmlUrl.replace('https://', '')}
                  </a>
                </div>
              )}
              {!user && (
                <button
                  type="button"
                  onClick={props.onOpenSettings}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <Icon name="login" size={17} />
                  连接 GitHub 账号
                </button>
              )}
            </div>
          </div>
        </div>
        {errorMessage && <div className="mb-6 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-error">{errorMessage}</div>}

        {/* Bento 网格布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* 雷达图 */}
          <div className="glass-card flex h-fit flex-col rounded-xl p-5 sm:p-6 lg:col-span-1">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="radar" size={20} className="text-primary" />
              <h3 className="font-headline-md text-on-surface text-lg">开发者技能偏好</h3>
            </div>
            <div className="flex items-center justify-center overflow-hidden px-1">
              <div className="relative h-[360px] w-full max-w-[480px] xl:h-[390px] xl:max-w-[520px]">
                {hasLanguageBreakdown ? (
                  <Radar data={radarData} options={radarOptions} />
                ) : (
                  <ChartEmptyState icon="radar" text="同步 Stars 后生成语言偏好画像" />
                )}
              </div>
            </div>
            <div>
              {hasLanguageBreakdown && (
                <div className="mx-auto mt-4 grid w-full max-w-[320px] grid-cols-2 gap-1.5">
                  {stats.languageBreakdown.slice(0, 6).map((item) => (
                    <span
                      key={item.language}
                      title={`${item.language} ${item.count}`}
                      className="min-w-0 truncate rounded-full border border-outline-variant/25 bg-surface-container-low px-2 py-1 text-center text-xs text-on-surface-variant"
                    >
                      {item.language} {item.count}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-center font-body-md text-xs text-on-surface-variant">
                基于 {languageRepositoryTotal} 个有主要语言的 Stars 仓库
              </p>
            </div>
          </div>

          {/* 统计与最近动态 */}
          <div className="grid grid-cols-1 gap-6 lg:col-span-2 sm:grid-cols-2">
            {/* 统计卡片：笔记 */}
            <div className="glass-card rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
              <div className="flex items-center gap-3 mb-4 text-on-surface-variant z-10">
                <Icon name="description" size={20} className="p-2 bg-surface-container rounded-lg" />
                <span className="font-body-md font-medium">笔记数</span>
              </div>
              <div className="flex items-baseline gap-2 z-10">
                <span className="font-headline-lg text-4xl">{compactNumber(stats.totalNotes)}</span>
                <span className="font-body-md text-on-surface-variant">条</span>
              </div>
            </div>
            {/* 统计卡片：AI 字数 */}
            <div className="glass-card rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-tertiary-container/5 rounded-full blur-2xl group-hover:bg-tertiary-container/10 transition-colors duration-500" />
              <div className="z-10 mb-4 flex items-center gap-3 text-on-surface-variant">
                <Icon name="psychology" size={20} className="rounded-lg bg-surface-container p-2" />
                <span className="font-body-md font-medium">AI 摘要与用量</span>
              </div>
              <div className="z-10 flex items-baseline gap-2">
                <span className="font-headline-lg text-4xl">{compactNumber(stats.totalAiWords)}</span>
                <span className="font-body-md text-on-surface-variant">字</span>
              </div>
              <div className="z-10 mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-success/20 bg-success/10 px-3 py-2">
                  <p className="font-body-md text-[11px] text-success">输入</p>
                  <p className="mt-0.5 font-body-md text-sm font-semibold text-on-surface">
                    {compactNumber(stats.totalAiInputTokens)}
                    <span className="ml-1 text-[11px] font-normal text-on-surface-variant">tokens</span>
                  </p>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
                  <p className="font-body-md text-[11px] text-primary">输出</p>
                  <p className="mt-0.5 font-body-md text-sm font-semibold text-on-surface">
                    {compactNumber(stats.totalAiOutputTokens)}
                    <span className="ml-1 text-[11px] font-normal text-on-surface-variant">tokens</span>
                  </p>
                </div>
              </div>
            </div>
            {/* 最近收藏列表 */}
            <div className="glass-card flex h-full max-w-[calc(100%-1.5rem)] flex-col rounded-xl p-5 sm:col-span-2 xl:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="bookmark" size={20} className="text-primary" />
                  <h3 className="font-headline-md text-on-surface text-lg">最近收藏仓库</h3>
                </div>
              </div>
              <div className="flex max-h-[260px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {stats.recentRepos.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-on-surface-variant">
                    <Icon name="inbox" size={48} className="opacity-30" />
                    <p className="font-body-md text-sm">暂无收藏，同步后即可查看</p>
                  </div>
                ) : (
                  stats.recentRepos.map((repo) => (
                    <button
                      type="button"
                      key={repo.id}
                      onClick={() => props.onOpenRepository(repo)}
                      className="flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-card-border hover:bg-surface-container-low"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-bold text-sm"
                          style={{
                            backgroundColor: colorWithAlpha(LANGUAGE_COLORS[repo.language ?? ''] ?? chartTheme.onSurfaceVariant, 0.14),
                            color: LANGUAGE_COLORS[repo.language ?? ''] ?? chartTheme.onSurfaceVariant,
                          }}
                        >
                          {repo.language?.slice(0, 2).toUpperCase() ?? '??'}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-body-md font-medium text-on-surface">{repo.fullName}</div>
                          <div className="truncate font-body-md text-sm text-on-surface-variant">
                            {repo.description ?? '暂无描述'}
                          </div>
                          <div className="mt-1 font-body-md text-xs text-on-surface-variant/80">
                            {formatRelativeTime(repo.starredAt)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 年度趋势图 */}
        <div className="glass-card flex min-h-[300px] w-full flex-col rounded-xl p-5 sm:p-6 xl:min-h-[350px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="monitoring" size={20} className="text-primary" />
              <h3 className="font-headline-md text-on-surface text-lg">年度收藏趋势</h3>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            {hasMonthlyTrend ? (
              <Line data={lineData} options={lineOptions} />
            ) : (
              <ChartEmptyState icon="monitoring" text="同步 Stars 后生成年度收藏趋势" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type ChartTheme = typeof DEFAULT_CHART_THEME;

function readChartTheme(): ChartTheme {
  const styles = window.getComputedStyle(document.documentElement);
  const primary = readCssColor(styles, '--color-primary', DEFAULT_CHART_THEME.primary);
  const onSurfaceVariant = readCssColor(styles, '--color-on-surface-variant', DEFAULT_CHART_THEME.onSurfaceVariant);
  const onSurface = readCssColor(styles, '--color-on-surface', DEFAULT_CHART_THEME.onSurface);
  const surface = readCssColor(styles, '--color-surface-container-lowest', DEFAULT_CHART_THEME.surface);
  const surfaceHigh = readCssColor(styles, '--color-surface-container-highest', DEFAULT_CHART_THEME.surfaceHigh);
  const outlineVariant = readCssColor(styles, '--color-outline-variant', DEFAULT_CHART_THEME.gridColor);

  return {
    primary,
    primarySoft: colorWithAlpha(primary, 0.18),
    primaryMuted: colorWithAlpha(primary, 0.42),
    primaryTransparent: colorWithAlpha(primary, 0),
    onSurfaceVariant,
    onSurface,
    surface,
    surfaceHigh,
    gridColor: colorWithAlpha(outlineVariant, 0.38),
  };
}

function readCssColor(styles: CSSStyleDeclaration, token: string, fallback: string) {
  const value = styles.getPropertyValue(token).trim();
  return value || fallback;
}

function colorWithAlpha(color: string, alpha: number) {
  const normalizedAlpha = Math.max(0, Math.min(alpha, 1));
  const normalizedColor = color.trim();
  const hexMatch = normalizedColor.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const red = parseInt(hexMatch[1].slice(0, 2), 16);
    const green = parseInt(hexMatch[1].slice(2, 4), 16);
    const blue = parseInt(hexMatch[1].slice(4, 6), 16);
    return `rgb(${red} ${green} ${blue} / ${normalizedAlpha})`;
  }

  const rgbMatch = normalizedColor.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .replace(/\//g, ' ')
      .replace(/,/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 3);
    if (channels.length === 3) {
      return `rgb(${channels.join(' ')} / ${normalizedAlpha})`;
    }
  }

  return normalizedAlpha === 1 ? normalizedColor : DEFAULT_CHART_THEME.primarySoft;
}

function areChartThemesEqual(firstTheme: ChartTheme, secondTheme: ChartTheme) {
  return Object.keys(firstTheme).every((key) => (
    firstTheme[key as keyof ChartTheme] === secondTheme[key as keyof ChartTheme]
  ));
}

function ChartEmptyState(props: { icon: string; text: string }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 text-center text-on-surface-variant">
      <Icon name={props.icon} size={42} className="opacity-30" />
      <p className="font-body-md text-sm">{props.text}</p>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return '刚刚';
  if (diffH < 24) return `${diffH}小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return '昨天';
  if (diffD < 30) return `${diffD}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
