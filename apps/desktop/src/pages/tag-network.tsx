import { useMemo } from 'react';
import { useWorkspace } from '@/providers/workspace-provider';
import { Icon } from '@/components/ui/icon';

const TAG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function TagNetworkPage() {
  const workspace = useWorkspace();

  // 从仓库数据派生标签统计
  const tagStats = useMemo(() => {
    const stats = new Map<string, { name: string; count: number; color: string | null }>();
    // 用 workspace.tags 作为标签源
    for (const tag of workspace.tags) {
      stats.set(tag.id, { name: tag.name, count: 0, color: tag.color });
    }
    // 如果没有标签，用 topics 模拟
    if (workspace.tags.length === 0 && workspace.repositoryPage) {
      const topicMap = new Map<string, number>();
      for (const repo of workspace.repositoryPage.items) {
        for (const topic of repo.topics) {
          topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
        }
      }
      let i = 0;
      for (const [name, count] of topicMap) {
        const id = `topic_${name}`;
        stats.set(id, { name, count, color: TAG_COLORS[i % TAG_COLORS.length] });
        i++;
      }
    }
    return Array.from(stats.entries()).map(([id, s]) => ({ id, ...s }));
  }, [workspace.tags, workspace.repositoryPage]);

  // 按热度排序
  const trendingTags = useMemo(() => [...tagStats].sort((a, b) => b.count - a.count).slice(0, 10), [tagStats]);

  // 标签云 (全部标签)
  const cloudTags = useMemo(() => {
    return [...tagStats].sort((a, b) => b.count - a.count);
  }, [tagStats]);

  // 模拟标签组 (按语言/主题分组)
  const tagGroups = useMemo(() => {
    if (!workspace.repositoryPage) return [];
    const langGroups = new Map<string, { count: number; repos: number }>();
    for (const repo of workspace.repositoryPage.items) {
      const lang = repo.language ?? '其他';
      const existing = langGroups.get(lang);
      if (existing) {
        existing.count += 1;
      } else {
        langGroups.set(lang, { count: 1, repos: repo.starsCount });
      }
    }
    return Array.from(langGroups.entries())
      .map(([lang, { count, repos }], i) => ({
        id: `group_${lang}`,
        name: lang,
        color: TAG_COLORS[i % TAG_COLORS.length],
        tagCount: count,
        repoCount: count,
        tags: workspace.repositoryPage!.items
          .filter((r) => r.language === lang)
          .slice(0, 3)
          .map((r) => ({ name: r.name, count: r.starsCount })),
      }))
      .sort((a, b) => b.repoCount - a.repoCount)
      .slice(0, 4);
  }, [workspace.repositoryPage]);

  // 网络图节点和边 (简化版)
  const networkNodes = useMemo(() => {
    return trendingTags.slice(0, 8).map((tag, i) => ({
      id: tag.id,
      name: tag.name,
      x: 20 + (i % 4) * 20 + Math.random() * 10,
      y: 20 + Math.floor(i / 4) * 40 + Math.random() * 10,
      size: 8 + Math.min(tag.count * 2, 24),
      color: tag.color ?? TAG_COLORS[i % TAG_COLORS.length],
    }));
  }, [trendingTags]);

  const networkEdges = useMemo(() => {
    const edges: { source: number; target: number }[] = [];
    for (let i = 0; i < networkNodes.length; i++) {
      for (let j = i + 1; j < networkNodes.length; j++) {
        if (Math.random() > 0.6) {
          edges.push({ source: i, target: j });
        }
      }
    }
    return edges;
  }, [networkNodes]);

  const totalRepos = workspace.repositoryPage?.totalCount ?? 0;
  const totalLinks = networkEdges.length;

  return (
    <div className="p-margin-page overflow-y-auto h-full">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-on-surface">标签网络</h2>
            <p className="font-body-md text-on-surface-variant mt-1">管理和可视化您的代码库知识图谱</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg border border-outline-variant/50 bg-white/50 hover:bg-white text-on-surface font-body-md flex items-center gap-2 transition-all shadow-sm">
              <Icon name="edit" size={18} />
              批量编辑
            </button>
            <button className="px-4 py-2 rounded-lg bg-primary text-on-primary font-body-md font-medium flex items-center gap-2 hover:brightness-110 transition-all shadow-sm">
              <Icon name="add" size={18} />
              新建标签组
            </button>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Network Visualization Hero Card */}
            <div className="glass-card rounded-xl p-1 relative overflow-hidden h-80 group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-tertiary-container/5" />
              {/* Network Graph SVG */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Edges */}
                {networkEdges.map((edge, i) => {
                  const s = networkNodes[edge.source];
                  const t = networkNodes[edge.target];
                  if (!s || !t) return null;
                  return (
                    <line
                      key={i}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="rgba(37, 99, 235, 0.15)"
                      strokeWidth="0.3"
                    />
                  );
                })}
                {/* Nodes */}
                {networkNodes.map((node) => (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r={node.size / 5} fill={node.color} opacity="0.7" />
                    <text
                      x={node.x}
                      y={node.y + node.size / 5 + 3}
                      textAnchor="middle"
                      fontSize="2.5"
                      fill="#434655"
                      className="font-label-sm"
                    >
                      {node.name}
                    </text>
                  </g>
                ))}
              </svg>
              {/* Overlay */}
              <div className="absolute top-4 left-5 right-5 flex justify-between items-center z-10">
                <h3 className="font-headline-md text-[16px] text-on-surface font-semibold flex items-center gap-2">
                  <Icon name="hub" size={18} className="text-primary" />
                  知识图谱全貌
                </h3>
                <button className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center border border-outline-variant/20 hover:scale-105 transition-transform">
                  <Icon name="fullscreen" size={18} />
                </button>
              </div>
              <div className="absolute bottom-4 left-5 right-5 z-10 flex gap-2">
                <span className="px-3 py-1 rounded-full bg-white/80 border border-white backdrop-blur-md font-label-sm text-on-surface shadow-sm">
                  节点: {networkNodes.length}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/80 border border-white backdrop-blur-md font-label-sm text-on-surface shadow-sm">
                  关联: {totalLinks}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/80 border border-white backdrop-blur-md font-label-sm text-on-surface shadow-sm">
                  仓库: {totalRepos}
                </span>
              </div>
            </div>

            {/* Custom Tag Groups */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-headline-md text-[16px] text-on-surface font-semibold">自定义标签组</h3>
                <button className="text-primary font-body-md text-sm hover:underline">查看全部</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tagGroups.length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center justify-center py-8 text-on-surface-variant gap-2">
                    <Icon name="label_off" size={48} className="opacity-30" />
                    <p className="font-body-md text-sm">暂无标签组，同步仓库后自动生成</p>
                  </div>
                ) : (
                  tagGroups.map((group) => (
                    <div
                      key={group.id}
                      className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                          <h4 className="font-body-md font-medium text-on-surface">{group.name}</h4>
                        </div>
                        <button className="text-on-surface-variant hover:text-primary">
                          <Icon name="more_horiz" size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {group.tags.map((tag, i) => (
                          <span key={i} className="tag-pill px-2.5 py-1 rounded-md font-label-sm text-on-surface-variant text-xs">
                            {tag.name} ({tag.count > 1000 ? `${(tag.count / 1000).toFixed(0)}k` : tag.count})
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-on-surface-variant font-label-sm">
                        包含 {group.tagCount} 个标签 · {group.repoCount} 个仓库
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">
            {/* Trending Tags */}
            <div className="glass-card rounded-xl p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline-md text-[16px] text-on-surface font-semibold flex items-center gap-2">
                  <Icon name="trending_up" size={18} className="text-tertiary-container" />
                  热门标签
                </h3>
                <button className="p-1 rounded hover:bg-surface-container text-on-surface-variant">
                  <Icon name="filter_list" size={18} />
                </button>
              </div>
              <div className="space-y-3">
                {trendingTags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant gap-2">
                    <Icon name="label_off" size={48} className="opacity-30" />
                    <p className="font-body-md text-sm">暂无标签</p>
                  </div>
                ) : (
                  trendingTags.map((tag, index) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer border border-transparent hover:border-outline-variant/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 text-center font-label-sm text-on-surface-variant text-xs">{index + 1}</div>
                        <div className="font-body-md font-medium text-on-surface">#{tag.name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                          {tag.count} 库
                        </span>
                        <button className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary transition-opacity">
                          <Icon name="edit" size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tag Cloud */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-[16px] text-on-surface font-semibold">标签云</h3>
            <div className="flex gap-2">
              <select className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-body-md focus:outline-none focus:ring-1 focus:ring-primary">
                <option>按热度排序</option>
                <option>按字母排序</option>
                <option>最近添加</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {cloudTags.length === 0 ? (
              <p className="text-on-surface-variant font-body-md">暂无标签，同步仓库后自动生成标签云</p>
            ) : (
              cloudTags.map((tag, index) => {
                // 根据热度变化大小
                const maxCount = cloudTags[0]?.count ?? 1;
                const ratio = maxCount > 0 ? tag.count / maxCount : 0;
                const sizeClass = ratio > 0.7 ? 'px-4 py-2 text-base' : ratio > 0.4 ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
                const isHot = ratio > 0.7;
                return (
                  <span
                    key={tag.id}
                    className={`tag-pill ${sizeClass} rounded-${ratio > 0.7 ? 'xl' : ratio > 0.4 ? 'lg' : 'md'} font-body-md cursor-pointer flex items-center gap-1 ${
                      isHot ? 'border-primary/30 bg-primary/5' : 'opacity-80'
                    }`}
                  >
                    <span className="text-primary font-bold">#</span> {tag.name}
                    <span className="text-xs text-on-surface-variant ml-1">{tag.count}</span>
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
