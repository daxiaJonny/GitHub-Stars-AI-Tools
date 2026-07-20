import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Icon } from '@/components/ui/icon';
import type { UpstreamCommit, UpstreamUpdateReport } from '@/types';

/** 检查上游 fork（xingranya）仓库的最新提交，供参考是否跟进开发。 */
export function UpstreamUpdatePanel() {
  const [report, setReport] = useState<UpstreamUpdateReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReport();
  }, []);

  async function loadReport() {
    setIsChecking(true);
    setError(null);
    try {
      const result = await invoke<UpstreamUpdateReport>('check_upstream_updates');
      setReport(result);
      if (result.error) {
        setError(result.error);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleMarkSeen() {
    if (!report?.latestSha) {
      return;
    }
    setIsMarking(true);
    setError(null);
    try {
      await invoke('mark_upstream_updates_seen', { sha: report.latestSha });
      await loadReport();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsMarking(false);
    }
  }

  const busy = isChecking || isMarking;

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="sync_alt" size={18} className="shrink-0 text-primary" />
            <h4 className="font-body-lg font-semibold text-on-surface">上游 fork 更新</h4>
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            检查上游 xingranya 仓库的最新提交，供参考是否跟进开发。不会自动更新本应用。
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            <Icon name="refresh" size={15} />
            {isChecking ? '检查中...' : '检查上游更新'}
          </button>
          {report && report.newCount > 0 && report.latestSha && (
            <button
              type="button"
              onClick={() => void handleMarkSeen()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/35 bg-surface px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              {isMarking ? '标记中...' : '标记已读'}
            </button>
          )}
        </div>
      </div>

      {report?.lastCheckedAt && (
        <p className="mt-3 text-xs text-on-surface-variant">上次检查：{formatTime(report.lastCheckedAt)}</p>
      )}

      {report && report.newCount > 0 && (
        <p className="mt-2 text-sm font-medium text-primary">有 {report.newCount} 个新提交</p>
      )}
      {report && report.newCount === 0 && !error && (
        <p className="mt-2 text-sm text-on-surface-variant">已是最新，无新提交。</p>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {report && report.commits.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {report.commits.map((commit) => (
            <UpstreamCommitRow
              key={commit.sha}
              commit={commit}
              isNew={isCommitNew(commit.sha, report)}
            />
          ))}
        </ul>
      )}

      {report && report.commits.length > 0 && (
        <a
          href={report.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Icon name="open_in_new" size={13} />
          查看上游仓库
        </a>
      )}
    </div>
  );
}

function UpstreamCommitRow({ commit, isNew }: { commit: UpstreamCommit; isNew: boolean }) {
  return (
    <li
      className={`rounded-lg border px-3 py-2 text-sm ${
        isNew ? 'border-primary/30 bg-primary/5' : 'border-outline-variant/20 bg-surface'
      }`}
    >
      <a
        href={commit.htmlUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-2 hover:text-primary"
      >
        <Icon name="history" size={14} className="mt-0.5 shrink-0 text-on-surface-variant" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-on-surface">
            {commit.message || '(无提交信息)'}
          </span>
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            {commit.shortSha} · {commit.author || '未知'} · {formatTime(commit.date)}
          </span>
        </span>
        {isNew && (
          <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            新
          </span>
        )}
      </a>
    </li>
  );
}

function isCommitNew(sha: string, report: UpstreamUpdateReport) {
  if (!report.lastSeenSha) {
    return true;
  }
  const seenIndex = report.commits.findIndex((commit) => commit.sha === report.lastSeenSha);
  if (seenIndex < 0) {
    return true;
  }
  return report.commits.findIndex((commit) => commit.sha === sha) < seenIndex;
}

function formatTime(value: string) {
  if (!value) {
    return '未知';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}
