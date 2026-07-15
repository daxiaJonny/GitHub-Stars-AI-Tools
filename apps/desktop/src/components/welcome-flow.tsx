import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Database,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WelcomeShell, type WelcomeStepId } from '@/components/welcome/welcome-shell';
import type { GitHubUser, TaskProgressEvent } from '@/types';

type WelcomeFlowProps = {
  onComplete: () => void | Promise<void>;
  onConnectGitHub: (token: string) => Promise<GitHubUser>;
  onSyncStars: () => Promise<void>;
  onFetchReadmes: () => Promise<void>;
  taskProgress: TaskProgressEvent | null;
};

type Step = WelcomeStepId;
type GitHubConnectNextStep = 'workspace' | 'sync';

export function WelcomeFlow(props: WelcomeFlowProps) {
  const isMountedRef = useRef(true);
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [isConnectionTakingLonger, setIsConnectionTakingLonger] = useState(false);
  const [connectedUser, setConnectedUser] = useState<GitHubUser | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function completeWelcome(statusMessage?: string) {
    if (isCompleting) {
      return false;
    }

    setIsCompleting(true);
    setErrorMessage(null);
    if (statusMessage) {
      setConnectStatus(statusMessage);
    }

    try {
      await props.onComplete();
      return true;
    } catch (error) {
      setErrorMessage(`进入工作台失败：${toErrorMessage(error)}`);
      setIsCompleting(false);
      return false;
    }
  }

  async function handleGitHubConnect(nextStep: GitHubConnectNextStep = 'workspace') {
    if (isLoading || isCompleting) {
      return;
    }
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setErrorMessage('请输入 GitHub Personal Access Token');
      setSuccessMessage(null);
      setWarningMessage(null);
      setConnectStatus(null);
      setIsConnectionTakingLonger(false);
      return;
    }
    const statusTimers: number[] = [];
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    setConnectStatus('正在验证 GitHub Token...');
    setIsConnectionTakingLonger(false);
    let didLeaveWelcome = false;
    try {
      statusTimers.push(window.setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        setConnectStatus('正在保存本地凭据，如果系统弹出凭据管理授权，请选择允许。');
      }, 1200));
      statusTimers.push(window.setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        setIsConnectionTakingLonger(true);
        setConnectStatus('连接仍在进行中，可能是 GitHub 网络较慢。你可以先进入工作台，连接会在后台继续。');
      }, 8000));
      const user = await props.onConnectGitHub(trimmedToken);
      if (!isMountedRef.current) {
        return;
      }
      setConnectedUser(user);
      setToken('');
      setSuccessMessage(`GitHub 账号 @${user.login} 已连接。`);
      setConnectStatus(null);
      setIsConnectionTakingLonger(false);
      if (nextStep === 'workspace') {
        didLeaveWelcome = await completeWelcome('连接成功，正在进入工作台...');
        return;
      }
      setCurrentStep('sync');
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }
      setConnectStatus(null);
      setIsConnectionTakingLonger(false);
      setErrorMessage(toErrorMessage(error));
    } finally {
      statusTimers.forEach(window.clearTimeout);
      if (!didLeaveWelcome && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }

  async function handleSync() {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setWarningMessage(null);
    try {
      await props.onSyncStars();
      setSuccessMessage('Stars 已同步，正在缓存 README，随后可生成中文定位和标签网络...');
      try {
        await props.onFetchReadmes();
      } catch (error) {
        setWarningMessage(`Stars 已同步，后续处理暂未全部完成：${toErrorMessage(error)}。进入工作台后可在仓库页重新抓取 README、生成 AI 解析，或在标签网络页生成项目标签。`);
      }
      setCurrentStep('complete');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const visibleTaskProgress = getVisibleWelcomeProgress(currentStep, props.taskProgress)
    ?? getFallbackWelcomeProgress(currentStep, isLoading, connectStatus);

  return (
    <WelcomeShell
      currentStep={currentStep}
      onSkip={() => void completeWelcome()}
      isCompleting={isCompleting}
    >
      {currentStep === 'welcome' && (
        <section className="welcome-step-panel welcome-hero grid items-center gap-8 min-[960px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.9fr)]">
          <div className="welcome-hero-copy min-w-0">
            <StepBadge index={0} />
            <h1 className="welcome-hero-title mt-5 text-on-surface">
              让每一颗 Star，
              <br className="hidden min-[520px]:block" />
              都变成可检索的知识
            </h1>
            <p className="welcome-hero-subtitle mt-5 max-w-[520px] text-on-surface-variant">
              GSAT 将你的 GitHub Stars 安全同步到本地，并用 AI 自动生成中文摘要、标签与关联。
            </p>
            <div className="mt-8 grid gap-4 min-[640px]:grid-cols-3">
              <FeatureCard icon={Database} title="本地优先" description="数据只保存在你的设备" />
              <FeatureCard icon={Search} title="智能检索" description="关键词、语义与组合筛选" />
              <FeatureCard icon={Sparkles} title="AI 增强" description="中文摘要与标签网络" />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="welcome-cta h-[52px] rounded-[10px] px-6 text-base"
                type="button"
                onClick={() => setCurrentStep('github')}
              >
                开始设置
                <ChevronRight className="ml-1 size-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-[52px] rounded-[10px] px-6 text-base"
                type="button"
                disabled={isCompleting}
                onClick={() => void completeWelcome()}
              >
                {isCompleting ? '正在进入工作台…' : '先逛逛工作台'}
              </Button>
            </div>
          </div>
          <div className="welcome-hero-art mt-4 flex justify-center min-[960px]:mt-0 min-[960px]:justify-end">
            <img
              src="/onboarding/welcome-knowledge-network.svg"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="w-[82%] max-w-[300px] select-none min-[720px]:max-w-[340px] min-[960px]:w-full min-[960px]:max-w-[600px]"
            />
          </div>
        </section>
      )}

      {currentStep === 'github' && (
        <section className="welcome-step-panel mx-auto w-full max-w-2xl">
          <StepBadge index={1} />
          <h2 className="welcome-step-title mt-4 text-on-surface">连接 GitHub</h2>
          <p className="mt-3 text-on-surface-variant">
            需要 Personal Access Token 才能同步你的 Stars
          </p>
          <form
            className="mt-7 grid gap-4 text-left"
            onSubmit={(event) => {
              event.preventDefault();
              if (isLoading) {
                return;
              }
              void handleGitHubConnect('workspace');
            }}
          >
            <div className="rounded-xl border border-card-border bg-surface-container-low/60 p-4">
              <p className="text-sm font-semibold text-on-surface">如何获取 Token？</p>
              <ol className="mt-3 space-y-2 text-sm text-on-surface-variant">
                <li>1. 访问 <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-primary hover:underline">GitHub Token 设置</a></li>
                <li>2. 同步公开 Stars 可使用只读 Token；如需读取私有仓库 Stars，再授予仓库读取权限</li>
                <li>3. 如需使用 Gist 备份，再勾选 <code className="rounded bg-surface-container px-1 py-0.5">gist</code> 权限</li>
                <li>4. 生成并复制 Token</li>
              </ol>
            </div>
            <Input
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              placeholder="粘贴 GitHub Token"
              value={token}
              className="h-12 rounded-lg border-card-border bg-surface-container-lowest shadow-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30"
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-on-surface-variant">
              Token 仅保存在本机系统凭据管理器，不会上传到任何服务器
            </p>
            {errorMessage && (
              <p role="alert" className="welcome-message rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            {connectStatus && (
              <p id="welcome-connect-status" role="status" aria-live="polite" className="welcome-message rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                {connectStatus}
              </p>
            )}
            {isConnectionTakingLonger && (
              <p role="status" aria-live="polite" className="welcome-message rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                连接没有卡住。你可以点击下方“先进入工作台，后台继续连接”，稍后在设置页查看连接结果。
              </p>
            )}
            {successMessage && (
              <p role="status" aria-live="polite" className="welcome-message rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                {successMessage}
              </p>
            )}
            {visibleTaskProgress && (
              <WelcomeTaskProgress progress={visibleTaskProgress} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                size="lg"
                className="rounded-lg"
                type="button"
                disabled={isLoading}
                onClick={() => setCurrentStep('welcome')}
              >
                返回
              </Button>
              <Button
                size="lg"
                className="welcome-cta rounded-lg"
                type="submit"
                aria-busy={isLoading}
                aria-describedby={connectStatus ? 'welcome-connect-status' : undefined}
                disabled={!token.trim() || isLoading || isCompleting}
              >
                {isCompleting ? '正在进入工作台…' : isLoading ? '正在验证 Token…' : '验证并进入工作台'}
                <ChevronRight className="ml-1 size-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-lg sm:col-span-2"
                type="button"
                aria-busy={isLoading}
                aria-describedby={connectStatus ? 'welcome-connect-status' : undefined}
                disabled={!token.trim() || isLoading || isCompleting}
                onClick={() => void handleGitHubConnect('sync')}
              >
                验证并同步 Stars
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="rounded-lg text-on-surface-variant hover:text-on-surface sm:col-span-2"
                type="button"
                disabled={isCompleting}
                onClick={() => void completeWelcome(isLoading ? '正在进入工作台，GitHub 连接会继续在后台完成。' : undefined)}
              >
                {isCompleting ? '正在进入工作台…' : isLoading ? '先进入工作台，后台继续连接' : '暂不连接，进入工作台'}
              </Button>
            </div>
          </form>
        </section>
      )}

      {currentStep === 'sync' && (
        <section className="welcome-step-panel mx-auto w-full max-w-2xl">
          <StepBadge index={2} />
          <h2 className="welcome-step-title mt-4 text-on-surface">同步 Stars</h2>
          <p className="mt-3 text-on-surface-variant">
            首次同步可能需要几分钟，请耐心等待
          </p>
          <div className="mt-7 rounded-xl border border-card-border bg-surface-container-low/60 p-5">
            <p className="text-sm leading-6 text-on-surface-variant">
              {connectedUser ? `已连接 @${connectedUser.login}。` : ''}
              连接已完成，即将同步你的 GitHub Stars 到本地数据库，并缓存仓库 README。
              README 是中文定位和标签网络的上下文；配置 AI 后可以继续生成中文解析和项目标签。
            </p>
          </div>
          {errorMessage && (
            <p role="alert" className="welcome-message mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p role="status" aria-live="polite" className="welcome-message mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              {successMessage}
            </p>
          )}
          {warningMessage && (
            <p role="status" aria-live="polite" className="welcome-message mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              {warningMessage}
            </p>
          )}
          {visibleTaskProgress && (
            <WelcomeTaskProgress progress={visibleTaskProgress} />
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 rounded-lg"
              type="button"
              disabled={isLoading || isCompleting}
              onClick={() => void completeWelcome()}
            >
              {isCompleting ? '正在进入工作台…' : '进入工作台'}
            </Button>
            <Button
              size="lg"
              className="welcome-cta flex-1 rounded-lg"
              type="button"
              disabled={isLoading}
              onClick={handleSync}
            >
              {isLoading ? '同步中…' : '开始同步'}
              <ChevronRight className="ml-1 size-5" />
            </Button>
          </div>
        </section>
      )}

      {currentStep === 'complete' && (
        <section className="welcome-step-panel mx-auto w-full max-w-2xl">
          <StepBadge index={3} />
          <h2 className="welcome-step-title mt-4 text-on-surface">一切就绪</h2>
          <p className="mt-3 text-on-surface-variant">
            你的 Stars 已经同步完成，现在可以开始探索了
          </p>
          <div className="mt-7 grid gap-3 text-left">
            <TipItem number="1" text="使用搜索框查找项目，支持名称、描述、Topics 和笔记" />
            <TipItem number="2" text="为项目生成 AI 解析后，列表会显示更准确的中文定位" />
            <TipItem number="3" text="在标签网络页生成项目标签，再按用途聚类和筛选" />
          </div>
          {warningMessage && (
            <p role="status" aria-live="polite" className="mt-6 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              {warningMessage}
            </p>
          )}
          <Button
            size="lg"
            className="welcome-cta mt-9 h-[52px] rounded-[10px] px-8 text-base"
            type="button"
            disabled={isCompleting}
            onClick={() => void completeWelcome()}
          >
            {isCompleting ? '正在进入工作台…' : '进入工作台'}
          </Button>
        </section>
      )}
    </WelcomeShell>
  );
}

function getVisibleWelcomeProgress(step: Step, progress: TaskProgressEvent | null) {
  if (!progress) {
    return null;
  }

  if (step === 'github') {
    return progress.taskId === 'connect-github' ? progress : null;
  }

  if (step === 'sync') {
    return ['sync-stars', 'fetch-readmes', 'batch-generate-ai-documents'].includes(progress.taskId)
      ? progress
      : null;
  }

  return null;
}

function getFallbackWelcomeProgress(step: Step, isLoading: boolean, connectStatus: string | null): TaskProgressEvent | null {
  if (step !== 'github' || !isLoading) {
    return null;
  }

  return {
    taskId: 'connect-github',
    taskType: 'auth',
    status: 'running',
    stage: 'auth',
    current: 0,
    total: 2,
    message: connectStatus ?? '正在验证 GitHub Token...',
    repositoryName: null,
  };
}

function toErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}

function WelcomeTaskProgress(props: { progress: TaskProgressEvent }) {
  const progress = props.progress;
  const hasKnownProgress = progress.total > 0;
  const safeCurrent = hasKnownProgress ? Math.min(progress.current, progress.total) : progress.current;
  const percentage = hasKnownProgress
    ? Math.min(100, Math.round((safeCurrent / progress.total) * 100))
    : 0;
  const isFailed = progress.status === 'failed';
  const isPartial = progress.status === 'partial';
  const isRunning = progress.status === 'running';
  const stageLabel = getWelcomeTaskStageLabel(progress.stage);

  return (
    <div
      className={`mt-4 rounded-lg border px-4 py-3 text-left text-sm ${
        isFailed
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : isPartial
            ? 'border-warning/30 bg-warning/10 text-warning'
            : 'border-primary/20 bg-primary/10 text-primary'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {isRunning ? '正在处理' : isFailed ? '任务失败' : isPartial ? '任务部分完成' : '任务完成'}
          </p>
          <p className="mt-1 min-h-[2.6em] break-words line-clamp-2 text-current/85">{progress.message}</p>
          {(stageLabel || progress.repositoryName) && (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5 text-xs text-current/80">
              {stageLabel && (
                <span className="rounded-lg bg-background/60 px-2 py-1">
                  阶段：{stageLabel}
                </span>
              )}
              {progress.repositoryName && (
                <span className="max-w-full truncate rounded-lg bg-background/60 px-2 py-1" title={progress.repositoryName}>
                  当前：{progress.repositoryName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {(hasKnownProgress || isRunning) && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-lg bg-background/70">
            {hasKnownProgress ? (
              <div className="h-full rounded-lg bg-current transition-all" style={{ width: `${percentage}%` }} />
            ) : (
              <div className="task-progress-indeterminate h-full w-1/3 rounded-lg bg-current" />
            )}
          </div>
          <p className="mt-1 text-right text-xs text-current/75">
            {hasKnownProgress ? `${safeCurrent}/${progress.total} · ${percentage}%` : '正在处理...'}
          </p>
        </div>
      )}
    </div>
  );
}

function getWelcomeTaskStageLabel(stage: string) {
  switch (stage) {
    case 'auth':
      return '验证账号';
    case 'queue':
      return '等待调度';
    case 'prepare':
      return '准备数据';
    case 'batch':
      return '批量处理';
    case 'check':
      return '检查仓库';
    case 'plan':
      return '生成计划';
    case 'fetch':
    case 'fetch-readme':
    case 'github-search':
      return '请求数据';
    case 'parse':
      return '解析数据';
    case 'save':
      return '写入本地';
    case 'summarize':
    case 'analyze':
      return 'AI 分析';
    case 'partial-failure':
      return '部分失败';
    case 'done':
      return '已完成';
    case 'error':
      return '失败';
    case 'request':
      return '准备中';
    default:
      return stage ? stage : '';
  }
}

function StepBadge(props: { index: number }) {
  return (
    <span className="welcome-step-badge inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold">
      步骤 {props.index + 1} / {4}
    </span>
  );
}

function FeatureCard(props: { icon: LucideIcon; title: string; description: string }) {
  const Icon = props.icon;
  return (
    <div className="welcome-feature-card group flex flex-col gap-3 rounded-xl border border-card-border bg-surface-container-lowest p-4 text-left transition-colors duration-200">
      <span className="welcome-feature-icon grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-on-surface">{props.title}</p>
        <p className="mt-1 text-sm leading-snug text-on-surface-variant">{props.description}</p>
      </div>
    </div>
  );
}

function TipItem(props: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-card-border bg-surface-container-low/50 p-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-white">
        {props.number}
      </span>
      <p className="text-sm text-on-surface-variant">{props.text}</p>
    </div>
  );
}
