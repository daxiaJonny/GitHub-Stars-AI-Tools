import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Icon } from '@/components/ui/icon';
import { useWorkspace } from '@/providers/workspace-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { getAiConfigMessage, shouldFlushAiApiKey } from '@/lib/ai-config';
import type { TagNetworkData } from '@/types';

const TAG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const NETWORK_VIEWBOX_SIZE = 100;
const MIN_NETWORK_SCALE = 0.72;
const MAX_NETWORK_SCALE = 2.4;
const EMPTY_TAG_NETWORK_DATA: TagNetworkData = {
  nodes: [],
  edges: [],
  totalRepos: 0,
  totalTags: 0,
  totalLinks: 0,
};

type TagNetworkPageProps = {
  onSelectTag: (tagId: string) => void;
};

type NetworkNodeLimit = 10 | 20 | 40;
type NetworkTransform = {
  x: number;
  y: number;
  scale: number;
};

export function TagNetworkPage(props: TagNetworkPageProps) {
  const workspace = useWorkspace();
  const settingsHook = useAppSettings();
  const [networkData, setNetworkData] = useState<TagNetworkData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [cloudSort, setCloudSort] = useState<'hot' | 'name' | 'recent'>('hot');
  const [networkNodeLimit, setNetworkNodeLimit] = useState<NetworkNodeLimit>(20);
  const [networkTransform, setNetworkTransform] = useState<NetworkTransform>({ x: 0, y: 0, scale: 1 });
  const [isDraggingNetwork, setIsDraggingNetwork] = useState(false);
  const networkSvgRef = useRef<SVGSVGElement | null>(null);
  const networkDragRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number; moved: boolean } | null>(null);
  const networkDragMovedRef = useRef(false);
  const aiConfigMessage = getAiConfigMessage(settingsHook.settings.ai);

  useEffect(() => {
    let cancelled = false;
    const accountId = workspace.authState.user ? String(workspace.authState.user.id) : undefined;
    if (!accountId) {
      setNetworkData(EMPTY_TAG_NETWORK_DATA);
      setErrorMessage(null);
      return;
    }
    invoke<TagNetworkData>('get_tag_network_data', { request: { accountId } })
      .then((data) => {
        if (!cancelled) setNetworkData(data);
      })
      .catch((reason) => {
        if (!cancelled) setErrorMessage(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.authState.user?.id, workspace.repositoryPage, workspace.tags, workspace.syncSummary, reloadKey]);

  async function handleGenerateTagNetwork() {
    const accountId = workspace.authState.user ? String(workspace.authState.user.id) : null;
    if (!accountId) {
      setErrorMessage('请先在设置中连接 GitHub 账号。');
      return;
    }

    if (networkData && networkData.totalRepos === 0) {
      setErrorMessage('请先同步 GitHub Stars，再生成 AI 标签网络。');
      return;
    }

    if (aiConfigMessage) {
      setErrorMessage(aiConfigMessage);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (shouldFlushAiApiKey(settingsHook.settings.ai)) {
        await settingsHook.flushAIKey(settingsHook.settings.ai.apiKey);
      }
      const summary = await workspace.handleGenerateAiTagNetwork(settingsHook.settings.ai);
      setReloadKey((current) => current + 1);
      const partialFailureMessage = summary.failedBatchCount > 0
        ? `其中 ${summary.failedBatchCount} 个批次失败，已保留成功生成的标签关联，可稍后重试补全。`
        : '';
      setSuccessMessage(`AI 标签网络已生成：${summary.tagCount} 个标签，${summary.linkedCount} 条仓库关联。${partialFailureMessage}`);
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function handleSyncStars() {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await workspace.handleSyncStars();
      setReloadKey((current) => current + 1);
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function updateNetworkScale(nextScale: number) {
    setNetworkTransform((current) => ({
      ...current,
      scale: clampNumber(nextScale, MIN_NETWORK_SCALE, MAX_NETWORK_SCALE),
    }));
  }

  function resetNetworkView() {
    setNetworkTransform({ x: 0, y: 0, scale: 1 });
  }

  function handleNetworkPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || tagStats.length === 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    networkDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: networkTransform.x,
      y: networkTransform.y,
      moved: false,
    };
    networkDragMovedRef.current = false;
    setIsDraggingNetwork(true);
  }

  function handleNetworkPointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = networkDragRef.current;
    const svg = networkSvgRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !svg) {
      return;
    }

    const bounds = svg.getBoundingClientRect();
    const deltaX = ((event.clientX - drag.clientX) / Math.max(bounds.width, 1)) * NETWORK_VIEWBOX_SIZE;
    const deltaY = ((event.clientY - drag.clientY) / Math.max(bounds.height, 1)) * NETWORK_VIEWBOX_SIZE;
    if (Math.abs(event.clientX - drag.clientX) + Math.abs(event.clientY - drag.clientY) > 4) {
      drag.moved = true;
      networkDragMovedRef.current = true;
    }
    setNetworkTransform((current) => ({
      ...current,
      x: clampNumber(drag.x + deltaX, -42, 42),
      y: clampNumber(drag.y + deltaY, -42, 42),
    }));
  }

  function handleNetworkPointerEnd(event: PointerEvent<SVGSVGElement>) {
    if (networkDragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      networkDragRef.current = null;
      setIsDraggingNetwork(false);
      window.setTimeout(() => {
        networkDragMovedRef.current = false;
      }, 0);
    }
  }

  const tagStats = networkData?.nodes ?? [];

  const trendingTags = useMemo(() => [...tagStats].sort((a, b) => b.repoCount - a.repoCount).slice(0, 10), [tagStats]);

  const cloudTags = useMemo(() => {
    const tags = [...tagStats];
    switch (cloudSort) {
      case 'name':
        return tags.sort((a, b) => a.name.localeCompare(b.name));
      case 'recent':
        return tags.reverse();
      case 'hot':
      default:
        return tags.sort((a, b) => b.repoCount - a.repoCount);
    }
  }, [cloudSort, tagStats]);
  const maxCloudRepoCount = useMemo(
    () => Math.max(...cloudTags.map((tag) => tag.repoCount), 1),
    [cloudTags],
  );

  const tagGroups = useMemo(() => {
    const groups = [
      { id: 'high', name: '高频标签', tags: tagStats.filter((tag) => tag.repoCount >= 5) },
      { id: 'mid', name: '常用标签', tags: tagStats.filter((tag) => tag.repoCount >= 2 && tag.repoCount < 5) },
      { id: 'new', name: '轻量标签', tags: tagStats.filter((tag) => tag.repoCount < 2) },
    ];
    return groups
      .filter((group) => group.tags.length > 0)
      .map((group, i) => ({
        id: group.id,
        name: group.name,
        color: TAG_COLORS[i % TAG_COLORS.length],
        tagCount: group.tags.length,
        repoCount: group.tags.reduce((sum, tag) => sum + tag.repoCount, 0),
        tags: group.tags.slice(0, 6).map((tag) => ({ id: tag.id, name: tag.name, count: tag.repoCount })),
      }))
      .slice(0, 4);
  }, [tagStats]);

  const visibleNetworkTags = useMemo(() => {
    const edgeWeightByTagId = new Map<string, number>();
    for (const edge of networkData?.edges ?? []) {
      edgeWeightByTagId.set(edge.source, (edgeWeightByTagId.get(edge.source) ?? 0) + edge.weight);
      edgeWeightByTagId.set(edge.target, (edgeWeightByTagId.get(edge.target) ?? 0) + edge.weight);
    }

    return [...tagStats]
      .sort((a, b) => {
        const edgeWeightDiff = (edgeWeightByTagId.get(b.id) ?? 0) - (edgeWeightByTagId.get(a.id) ?? 0);
        if (edgeWeightDiff !== 0) return edgeWeightDiff;
        if (b.repoCount !== a.repoCount) return b.repoCount - a.repoCount;
        return a.name.localeCompare(b.name);
      })
      .slice(0, networkNodeLimit);
  }, [networkData?.edges, networkNodeLimit, tagStats]);

  const networkNodes = useMemo(() => {
    const maxRepoCount = Math.max(...visibleNetworkTags.map((tag) => tag.repoCount), 1);
    return visibleNetworkTags.map((tag, i) => ({
      id: tag.id,
      name: tag.name,
      repoCount: tag.repoCount,
      x: 50 + Math.cos((i / Math.max(visibleNetworkTags.length, 1)) * Math.PI * 2) * (i === 0 ? 0 : 36),
      y: 50 + Math.sin((i / Math.max(visibleNetworkTags.length, 1)) * Math.PI * 2) * (i === 0 ? 0 : 34),
      size: 7 + Math.min((tag.repoCount / maxRepoCount) * 24, 24),
      color: tag.color ?? TAG_COLORS[i % TAG_COLORS.length],
      showLabel: i < 18 || tag.repoCount === maxRepoCount,
    }));
  }, [visibleNetworkTags]);

  const networkEdges = useMemo(() => {
    const nodeIds = new Set(networkNodes.map((node) => node.id));
    const indexById = new Map(networkNodes.map((node, index) => [node.id, index]));
    return (networkData?.edges ?? [])
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .slice(0, 80)
      .map((edge) => ({ source: indexById.get(edge.source), target: indexById.get(edge.target), weight: edge.weight }))
      .filter((edge): edge is { source: number; target: number; weight: number } => edge.source !== undefined && edge.target !== undefined);
  }, [networkData?.edges, networkNodes]);
  const maxVisibleEdgeWeight = Math.max(...networkEdges.map((edge) => edge.weight), 1);

  const totalRepos = networkData?.totalRepos ?? 0;
  const totalLinks = networkData?.totalLinks ?? 0;
  const totalTags = networkData?.totalTags ?? 0;
  const hasNoSyncedRepositories = Boolean(workspace.authState.user && networkData && totalRepos === 0);
  const hasNoTags = Boolean(workspace.authState.user && networkData && totalRepos > 0 && totalTags === 0);
  const shouldShowHeaderGenerateAction = Boolean(workspace.authState.user && networkData && !hasNoTags);
  const canGenerateTagNetwork = Boolean(workspace.authState.user && !hasNoSyncedRepositories && !aiConfigMessage);
  const tagNetworkActionNotice = !workspace.authState.user
    ? '请先连接 GitHub 账号并同步 Stars，随后可让 AI 根据全部仓库简略信息生成标签网络。'
    : hasNoSyncedRepositories
      ? '当前账号还没有本地 Stars 数据，请先同步 GitHub Stars。'
      : aiConfigMessage
        ? aiConfigMessage
        : 'AI 标签网络会读取全部已同步 Stars 的名称、描述、语言、Topics 和摘要，并自动创建标签与仓库关联。';
  const tagNetworkActionNoticeTone = !workspace.authState.user || hasNoSyncedRepositories || aiConfigMessage ? 'error' : 'muted';

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-[min(1400px,100%)] space-y-5">
        {/* 顶部操作区 */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h2 className="font-headline-lg text-on-surface">标签网络</h2>
            <p className="font-body-md text-on-surface-variant mt-1">
              根据全部已同步 Stars 生成标签、关联和覆盖关系
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSyncStars()}
              disabled={workspace.isSyncingStars || !workspace.authState.user}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface shadow-sm transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              title={workspace.authState.user ? '同步 GitHub Stars 后刷新标签网络数据' : '请先连接 GitHub 账号'}
            >
              <Icon name={workspace.isSyncingStars ? 'progress_activity' : 'sync'} size={17} className={workspace.isSyncingStars ? 'animate-spin' : ''} />
              {workspace.isSyncingStars ? '同步中' : '同步数据'}
            </button>
            {shouldShowHeaderGenerateAction && (
              <button
                type="button"
                onClick={() => void handleGenerateTagNetwork()}
                disabled={workspace.isGeneratingTagNetwork || !canGenerateTagNetwork}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                title={tagNetworkActionNotice}
              >
                <Icon name={workspace.isGeneratingTagNetwork ? 'progress_activity' : 'auto_awesome'} size={18} className={workspace.isGeneratingTagNetwork ? 'animate-spin' : ''} />
                {workspace.isGeneratingTagNetwork ? '生成中' : totalTags > 0 ? '重新生成标签网络' : 'AI 生成标签网络'}
              </button>
            )}
          </div>
        </div>
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            tagNetworkActionNoticeTone === 'error'
              ? 'border-error/20 bg-error/10 text-error'
              : 'border-outline-variant/30 bg-surface-container text-on-surface-variant'
          }`}
        >
          {tagNetworkActionNotice}
        </div>
        {errorMessage && <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-error">{errorMessage}</div>}
        {successMessage && <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-success">{successMessage}</div>}

        {/* Bento 网格布局 */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.9fr)]">
          {/* 左侧主列 */}
          <div className="space-y-5">
            {/* 标签网络可视化主卡片 */}
            <div className="glass-card relative h-[min(58vh,520px)] min-h-[360px] overflow-hidden rounded-xl p-1 group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-tertiary-container/5" />
              {/* 标签网络 SVG 图 */}
              <svg
                ref={networkSvgRef}
                className={`absolute inset-0 h-full w-full select-none touch-none ${isDraggingNetwork ? 'cursor-grabbing' : 'cursor-grab'}`}
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                onPointerDown={handleNetworkPointerDown}
                onPointerMove={handleNetworkPointerMove}
                onPointerUp={handleNetworkPointerEnd}
                onPointerCancel={handleNetworkPointerEnd}
              >
                <g transform={`translate(50 50) translate(${networkTransform.x} ${networkTransform.y}) scale(${networkTransform.scale}) translate(-50 -50)`}>
                  {/* 关系边 */}
                  {networkEdges.map((edge, i) => {
                    const s = networkNodes[edge.source];
                    const t = networkNodes[edge.target];
                    const weightRatio = Math.max(0.08, edge.weight / maxVisibleEdgeWeight);
                    if (!s || !t) return null;
                    return (
                      <line
                        key={i}
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke="var(--color-primary)"
                        opacity={0.08 + weightRatio * 0.2}
                        strokeWidth={Math.min(0.9, 0.18 + weightRatio * 0.82)}
                      />
                    );
                  })}
                  {/* 节点 */}
                  {networkNodes.map((node) => (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (networkDragMovedRef.current) {
                          return;
                        }
                        props.onSelectTag(node.id);
                      }}
                    >
                      <title>{`${node.name}：${node.repoCount} 个仓库`}</title>
                      <circle cx={node.x} cy={node.y} r={node.size / 6.6} fill={node.color} opacity="0.72" />
                      <circle cx={node.x} cy={node.y} r={node.size / 6.6 + 0.65} fill="none" stroke={node.color} strokeOpacity="0.18" />
                      {node.showLabel && (
                        <text
                          x={node.x}
                          y={node.y + node.size / 6.6 + 2.4}
                          textAnchor="middle"
                          fill="var(--color-on-surface)"
                          paintOrder="stroke"
                          stroke="var(--color-surface-container-lowest)"
                          strokeWidth="0.7"
                          strokeLinejoin="round"
                          style={{
                            fontFamily: 'var(--font-body-md)',
                            fontSize: `${Math.max(1.15, 1.9 - Math.min(node.name.length, 18) * 0.03)}px`,
                            fontWeight: 600,
                          }}
                        >
                          {truncateTagLabel(node.name)}
                        </text>
                      )}
                  </g>
                ))}
                </g>
              </svg>
              {/* 覆盖信息层 */}
              <div className="absolute left-5 right-5 top-4 z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="font-headline-md text-[16px] text-on-surface font-semibold flex items-center gap-2">
                  <Icon name="hub" size={18} className="text-primary" />
                  Stars 标签图谱
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-outline-variant/25 bg-surface-container-lowest/85 px-2.5 py-1.5 text-xs text-on-surface-variant backdrop-blur-md">
                    显示节点
                    <select
                      value={networkNodeLimit}
                      onChange={(event) => setNetworkNodeLimit(Number(event.target.value) as NetworkNodeLimit)}
                      className="rounded border border-outline-variant/30 bg-surface px-1.5 py-0.5 text-xs text-on-surface"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={40}>40</option>
                    </select>
                  </label>
                  <div className="flex items-center overflow-hidden rounded-lg border border-outline-variant/25 bg-surface-container-lowest/85 text-xs text-on-surface-variant shadow-sm backdrop-blur-md">
                    <button type="button" className="px-2.5 py-1.5 hover:bg-surface-container" onClick={() => updateNetworkScale(networkTransform.scale - 0.18)} title="缩小图谱">
                      <Icon name="remove" size={14} />
                    </button>
                    <span className="border-x border-outline-variant/20 px-2 py-1.5 font-label-sm">{Math.round(networkTransform.scale * 100)}%</span>
                    <button type="button" className="px-2.5 py-1.5 hover:bg-surface-container" onClick={() => updateNetworkScale(networkTransform.scale + 0.18)} title="放大图谱">
                      <Icon name="add" size={14} />
                    </button>
                    <button type="button" className="border-l border-outline-variant/20 px-2.5 py-1.5 hover:bg-surface-container" onClick={resetNetworkView} title="重置图谱视图">
                      <Icon name="center_focus_strong" size={14} />
                    </button>
                  </div>
                </div>
              </div>
              {tagStats.length === 0 && (
                <div className="absolute inset-x-5 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-outline-variant/25 bg-surface-container-lowest/90 px-4 py-5 text-center shadow-sm backdrop-blur-md">
                  <Icon name={hasNoSyncedRepositories ? 'sync_disabled' : 'hub'} size={42} className="mx-auto mb-2 text-on-surface-variant/45" />
                  <p className="font-body-md text-sm font-semibold text-on-surface">
                    {hasNoSyncedRepositories ? '还没有可视化的 Stars 数据' : '还没有可视化标签'}
                  </p>
                  <p className="mx-auto mt-1 max-w-[420px] text-xs leading-relaxed text-on-surface-variant">
                    {hasNoSyncedRepositories
                      ? '同步 GitHub Stars 后，这里会展示标签节点、共现关系和仓库覆盖情况。'
                      : '可以先手动创建标签，也可以点击 AI 生成标签网络，让模型根据全部 Stars 简略信息自动写入标签关联。'}
                  </p>
                  {hasNoTags && !aiConfigMessage && (
                    <button
                      type="button"
                      onClick={() => void handleGenerateTagNetwork()}
                      disabled={workspace.isGeneratingTagNetwork}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
                    >
                      <Icon name={workspace.isGeneratingTagNetwork ? 'progress_activity' : 'auto_awesome'} size={16} className={workspace.isGeneratingTagNetwork ? 'animate-spin' : ''} />
                      {workspace.isGeneratingTagNetwork ? '生成中...' : 'AI 生成标签网络'}
                    </button>
                  )}
                </div>
              )}
              <div className="absolute bottom-4 left-5 right-5 z-10 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-surface-container-lowest/80 border border-outline-variant/20 backdrop-blur-md font-label-sm text-on-surface shadow-sm">
                  节点: {totalTags}
                </span>
                <span className="px-3 py-1 rounded-full bg-surface-container-lowest/80 border border-outline-variant/20 backdrop-blur-md font-label-sm text-on-surface shadow-sm">
                  关联: {totalLinks}
                </span>
                <span className="px-3 py-1 rounded-full bg-surface-container-lowest/80 border border-outline-variant/20 backdrop-blur-md font-label-sm text-on-surface shadow-sm">
                  仓库: {totalRepos}
                </span>
                {networkNodes.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-surface-container-lowest/80 border border-outline-variant/20 backdrop-blur-md font-label-sm text-on-surface shadow-sm">
                    当前显示: {networkNodes.length} 节点 / {networkEdges.length} 关系
                  </span>
                )}
              </div>
            </div>

            {/* 标签分组 */}
            <div className="glass-card rounded-xl p-4 sm:p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-headline-md text-[16px] text-on-surface font-semibold">标签分组</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {tagGroups.length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center justify-center py-8 text-on-surface-variant gap-2">
                    <Icon name="label_off" size={48} className="opacity-30" />
                    <p className="font-body-md text-sm">创建并绑定标签后即可查看分组</p>
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
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {group.tags.map((tag, i) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => props.onSelectTag(tag.id)}
                            className="tag-pill px-2.5 py-1 rounded-md font-label-sm text-on-surface-variant text-xs hover:text-primary"
                          >
                            {tag.name} ({tag.count > 1000 ? `${(tag.count / 1000).toFixed(0)}k` : tag.count})
                          </button>
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

          {/* 右侧辅助列 */}
          <div className="space-y-5">
            {/* 热门标签 */}
            <div className="glass-card rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline-md text-[16px] text-on-surface font-semibold flex items-center gap-2">
                  <Icon name="trending_up" size={18} className="text-tertiary-container" />
                  热门标签
                </h3>
              </div>
              <div className="space-y-3">
                {trendingTags.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant gap-2">
                    <Icon name="label_off" size={48} className="opacity-30" />
                    <p className="font-body-md text-sm">暂无标签</p>
                  </div>
                ) : (
                  trendingTags.map((tag, index) => (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() => props.onSelectTag(tag.id)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer border border-transparent hover:border-outline-variant/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 text-center font-label-sm text-on-surface-variant text-xs">{index + 1}</div>
                        <div className="font-body-md font-medium text-on-surface">#{tag.name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                          {tag.repoCount} 库
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 标签云 */}
        <div className="glass-card rounded-xl p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-headline-md text-[16px] text-on-surface font-semibold">标签云</h3>
            <div className="flex gap-2">
              <select
                value={cloudSort}
                onChange={(event) => setCloudSort(event.target.value as 'hot' | 'name' | 'recent')}
                className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-body-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="hot">按热度排序</option>
                <option value="name">按字母排序</option>
                <option value="recent">最近添加</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {cloudTags.length === 0 ? (
              <p className="text-on-surface-variant font-body-md">暂无标签。同步 Stars 后，可以手动创建标签，或使用 AI 生成标签网络。</p>
            ) : (
              cloudTags.map((tag, index) => {
                const ratio = tag.repoCount / maxCloudRepoCount;
                const sizeClass = ratio > 0.7 ? 'px-4 py-2 text-base' : ratio > 0.4 ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
                const radiusClass = ratio > 0.7 ? 'rounded-xl' : ratio > 0.4 ? 'rounded-lg' : 'rounded-md';
                const isHot = ratio > 0.7;
                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => props.onSelectTag(tag.id)}
                    className={`tag-pill ${sizeClass} ${radiusClass} font-body-md cursor-pointer flex items-center gap-1 ${
                      isHot ? 'border-primary/30 bg-primary/5' : 'opacity-80'
                    }`}
                  >
                    <span className="text-primary font-bold">#</span> {tag.name}
                    <span className="text-xs text-on-surface-variant ml-1">{tag.repoCount}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function truncateTagLabel(value: string) {
  const normalizedValue = value.trim();
  if (normalizedValue.length <= 12) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 11)}...`;
}
