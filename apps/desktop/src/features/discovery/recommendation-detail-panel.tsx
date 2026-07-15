import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ReadmeRenderer } from '@/components/readme-renderer';
import { compactNumber, formatDate } from '@/lib/format';
import { getAiConfigMessage, shouldFlushAiApiKey, toBackendAiRequestConfig } from '@/lib/ai-config';
import { useAppSettings } from '@/providers/settings-provider';
import type {
  GithubReadmeTranslation,
  GithubRecommendationReadme,
  GithubRepositoryRecommendation,
} from '@/types';

type DetailTab = 'readme' | 'translation';

export function RecommendationDetailPanel(props: {
  accountId: string;
  repository: GithubRepositoryRecommendation;
  onClose: () => void;
}) {
  const settings = useAppSettings();
  const [activeTab, setActiveTab] = useState<DetailTab>('readme');
  const [readme, setReadme] = useState<GithubRecommendationReadme | null>(null);
  const [translation, setTranslation] = useState<GithubReadmeTranslation | null>(null);
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const forceReadmeRefreshRef = useRef(false);
  const aiConfigMessage = getAiConfigMessage(settings.settings.ai);

  useEffect(() => {
    let cancelled = false;
    const fullName = props.repository.fullName;
    const forceRefresh = forceReadmeRefreshRef.current;
    forceReadmeRefreshRef.current = false;
    setActiveTab('readme');
    setReadme(null);
    setTranslation(null);
    setReadmeError(null);
    setTranslationError(null);
    setIsLoadingReadme(true);
    void invoke<GithubRecommendationReadme>('fetch_github_recommendation_readme', {
      request: {
        accountId: props.accountId,
        fullName,
        forceRefresh,
      },
    })
      .then((response) => {
        if (cancelled) return;
        setReadme(response);
        setTranslation(response.translation);
        setActiveTab(response.translation ? 'translation' : 'readme');
      })
      .catch((reason) => {
        if (!cancelled) setReadmeError(toErrorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReadme(false);
      });

    return () => {
      cancelled = true;
    };
  }, [props.accountId, props.repository.fullName, reloadKey]);

  function handleRefreshReadme() {
    forceReadmeRefreshRef.current = true;
    setReloadKey((value) => value + 1);
  }

  async function handleTranslate() {
    if (!readme || aiConfigMessage) {
      setTranslationError(aiConfigMessage ?? '请先加载项目 README。');
      return;
    }

    setIsTranslating(true);
    setActiveTab('translation');
    setTranslationError(null);
    try {
      if (shouldFlushAiApiKey(settings.settings.ai)) {
        await settings.flushAIKey(settings.settings.ai.apiKey);
      }
      const response = await invoke<GithubReadmeTranslation>('translate_github_recommendation_readme', {
        request: {
          accountId: props.accountId,
          fullName: props.repository.fullName,
          aiConfig: toBackendAiRequestConfig(settings.settings.ai),
          forceRefresh: Boolean(translation),
        },
      });
      setTranslation(response);
      setActiveTab('translation');
    } catch (reason) {
      setTranslationError(toErrorMessage(reason));
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface xl:border-l xl:border-outline-variant/25" aria-label={`${props.repository.fullName} 项目介绍`}>
      <header className="shrink-0 border-b border-outline-variant/20 bg-surface/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={props.onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="返回候选列表"
            title="返回候选列表"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-on-surface">{props.repository.fullName}</h2>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-on-surface-variant">
              {props.repository.description ?? '该仓库暂未提供项目描述。'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] tabular-nums text-on-surface-variant">
              <span>{props.repository.language ?? '其他语言'}</span>
              <span className="inline-flex items-center gap-1"><Icon name="star" size={14} />{compactNumber(props.repository.starsCount)}</span>
              <span className="inline-flex items-center gap-1"><Icon name="fork_right" size={14} />{compactNumber(props.repository.forksCount)}</span>
            </div>
          </div>
          <a
            href={props.repository.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-low text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="在 GitHub 打开"
            title="在 GitHub 打开"
          >
            <Icon name="open_in_new" size={16} />
          </a>
        </div>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5">
        <div className="flex rounded-lg bg-surface-container p-1" aria-label="项目介绍视图">
          <button
            type="button"
            onClick={() => setActiveTab('readme')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === 'readme' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            aria-pressed={activeTab === 'readme'}
          >
            README 原文
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('translation')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === 'translation' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            aria-pressed={activeTab === 'translation'}
          >
            中文翻译
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handleRefreshReadme}
            disabled={isLoadingReadme}
            aria-label="重新获取 README"
            title="重新获取 README"
          >
            <Icon name="refresh" size={15} className={isLoadingReadme ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => void handleTranslate()} disabled={!readme || isTranslating || Boolean(aiConfigMessage)} title={aiConfigMessage ?? '使用当前 AI 模型翻译 README'}>
            <Icon name={isTranslating ? 'progress_activity' : 'translate'} size={15} className={isTranslating ? 'animate-spin' : ''} />
            {isTranslating ? '翻译中' : translation ? '重新翻译' : 'AI 翻译'}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest/45 custom-scrollbar">
        {isLoadingReadme ? (
          <DetailLoadingState message="正在读取项目 README…" />
        ) : readmeError ? (
          <DetailErrorState message={readmeError} actionLabel="重新加载" onAction={() => setReloadKey((value) => value + 1)} />
        ) : activeTab === 'readme' && readme ? (
          <div>
            <div className="border-b border-outline-variant/20 px-4 py-2 text-[11px] text-on-surface-variant">
              {readme.fromCache ? '本地缓存' : '刚刚获取'} · {readme.sourcePath} · {formatDate(readme.fetchedAt)}
            </div>
            <ReadmeRenderer
              markdown={readme.rawMarkdown}
              repositoryFullName={props.repository.fullName}
              sourcePath={readme.sourcePath}
              className="readme-rendered readme-rendered-compact min-w-0 px-4 py-4 text-on-surface"
            />
          </div>
        ) : activeTab === 'translation' && translation && readme ? (
          <div>
            <div className="border-b border-outline-variant/20 px-4 py-2 text-[11px] text-on-surface-variant">
              由 {translation.model} 翻译
              {translation.isTruncated ? ` · 已覆盖前 ${compactNumber(translation.translatedCharCount)} / ${compactNumber(translation.sourceCharCount)} 字符` : ' · 已覆盖完整 README'}
            </div>
            {translation.isTruncated ? (
              <p className="mx-4 mt-4 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-5 text-on-surface-variant">
                README 较长，当前中文翻译只覆盖开头部分；代码、命令和链接仍保留原文。
              </p>
            ) : null}
            <ReadmeRenderer
              markdown={translation.markdownZh}
              repositoryFullName={props.repository.fullName}
              sourcePath={readme.sourcePath}
              className="readme-rendered readme-rendered-compact min-w-0 px-4 py-4 text-on-surface"
            />
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon name="translate" size={23} />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-on-surface">生成中文 README</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-on-surface-variant">
              AI 会保留 Markdown、代码、命令和链接，只翻译项目说明文字。
            </p>
            {aiConfigMessage ? <p className="mt-3 max-w-sm text-xs leading-5 text-error">{aiConfigMessage}</p> : null}
            {translationError ? <p className="mt-3 max-w-sm text-xs leading-5 text-error" role="alert">{translationError}</p> : null}
            <Button className="mt-4" size="sm" onClick={() => void handleTranslate()} disabled={!readme || isTranslating || Boolean(aiConfigMessage)}>
              <Icon name={isTranslating ? 'progress_activity' : 'translate'} size={15} className={isTranslating ? 'animate-spin' : ''} />
              {isTranslating ? '翻译中' : '开始 AI 翻译'}
            </Button>
          </div>
        )}
        {translationError && translation ? (
          <p className="mx-4 my-3 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs leading-5 text-error" role="alert">{translationError}</p>
        ) : null}
      </div>
    </aside>
  );
}

function DetailLoadingState(props: { message: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-sm text-on-surface-variant">
      <Icon name="progress_activity" size={26} className="animate-spin text-primary" />
      <p>{props.message}</p>
    </div>
  );
}

function DetailErrorState(props: { message: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-error/10 text-error">
        <Icon name="error" size={23} />
      </span>
      <p className="mt-3 max-w-md text-sm leading-6 text-error">{props.message}</p>
      <Button className="mt-4" size="sm" variant="outline" onClick={props.onAction}>
        <Icon name="refresh" size={15} />
        {props.actionLabel}
      </Button>
    </div>
  );
}

function toErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
