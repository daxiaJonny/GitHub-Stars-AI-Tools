import { Icon } from '@/components/ui/icon';

export function DiscoverySelectionBar(props: {
  selectedCount: number;
  maxSelection: number;
  isLoading: boolean;
  isDisabled: boolean;
  actionTitle: string;
  onClear: () => void;
  onFind: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col gap-3 rounded-lg border border-outline-variant/35 bg-surface px-4 py-3 shadow-lg shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-on-surface">已选择 {props.selectedCount} / {props.maxSelection} 个参考仓库</p>
        <p className="mt-0.5 truncate text-xs text-on-surface-variant">
          {props.selectedCount === 0 ? '在左侧列表勾选要作为参考的项目。' : '生成完成后会自动打开独立发现页。'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {props.selectedCount > 0 ? (
          <button type="button" onClick={props.onClear} className="h-9 rounded-md px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
            清空
          </button>
        ) : null}
        <button
          type="button"
          onClick={props.onFind}
          disabled={props.isDisabled}
          title={props.actionTitle}
          className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Icon name={props.isLoading ? 'progress_activity' : 'travel_explore'} size={16} className={props.isLoading ? 'animate-spin' : ''} />
          {props.isLoading ? '正在发现' : '查找同类项目'}
        </button>
      </div>
    </div>
  );
}
