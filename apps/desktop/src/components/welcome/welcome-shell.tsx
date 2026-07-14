import type { ReactNode } from 'react';
import {
  Check,
  ChevronRight,
  CircleCheck,
  House,
  Link2,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { BrandIcon } from '@/components/ui/brand-icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WelcomeStepId = 'welcome' | 'github' | 'sync' | 'complete';

type WelcomeStepMeta = {
  id: WelcomeStepId;
  label: string;
  icon: LucideIcon;
};

export const WELCOME_STEPS: readonly WelcomeStepMeta[] = [
  { id: 'welcome', label: '欢迎', icon: House },
  { id: 'github', label: '连接 GitHub', icon: Link2 },
  { id: 'sync', label: '同步数据', icon: RefreshCw },
  { id: 'complete', label: '完成', icon: CircleCheck },
];

export function getWelcomeStepIndex(step: WelcomeStepId): number {
  const index = WELCOME_STEPS.findIndex((item) => item.id === step);
  return index === -1 ? 0 : index;
}

type StepState = 'done' | 'active' | 'todo';

function getStepState(index: number, activeIndex: number): StepState {
  if (index < activeIndex) {
    return 'done';
  }
  if (index === activeIndex) {
    return 'active';
  }
  return 'todo';
}

type WelcomeShellProps = {
  currentStep: WelcomeStepId;
  onSkip: () => void;
  isCompleting: boolean;
  children: ReactNode;
};

/**
 * 欢迎流程共享外壳：顶栏 + 左侧纵向步骤栏 + 右侧主面板框。
 * 四个步骤都渲染在同一外壳内，只替换右侧 children。
 */
export function WelcomeShell({ currentStep, onSkip, isCompleting, children }: WelcomeShellProps) {
  const activeIndex = getWelcomeStepIndex(currentStep);

  return (
    <div className="welcome-surface fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1520px] flex-col px-5 py-5">
        <header className="welcome-topbar flex items-center justify-between gap-4 border-b border-card-border/70 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandIcon
              title="GitHub-Stars-AI-Tools 应用图标"
              className="size-12 rounded-2xl shadow-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight text-on-surface">
                GitHub-Stars-AI-Tools
              </p>
              <p className="truncate text-sm text-on-surface-variant">GSAT 本地 Stars 知识库</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="lg"
            className="shrink-0 rounded-lg px-2 text-on-surface-variant hover:bg-card hover:text-on-surface sm:px-3"
            type="button"
            disabled={isCompleting}
            onClick={onSkip}
          >
            {isCompleting ? '正在进入工作台…' : '跳过，进入工作台'}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </header>

        <div className="welcome-body grid flex-1 gap-5 pt-5 min-[960px]:grid-cols-[var(--welcome-sidebar-width)_minmax(0,1fr)]">
          <WelcomeStepNav activeIndex={activeIndex} />
          <main className="welcome-panel min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

function WelcomeStepNav({ activeIndex }: { activeIndex: number }) {
  return (
    <aside className="welcome-sidebar">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-on-surface">初始化设置</p>
        <span className="welcome-step-count rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
          {activeIndex + 1} / {WELCOME_STEPS.length}
        </span>
      </div>

      {/* 宽屏：纵向步骤 */}
      <ol className="mt-6 hidden min-[960px]:block">
        {WELCOME_STEPS.map((step, index) => {
          const state = getStepState(index, activeIndex);
          const isLast = index === WELCOME_STEPS.length - 1;
          return (
            <li key={step.id} className="relative" data-state={state}>
              {state === 'active' && (
                <span className="welcome-step-highlight absolute inset-0 rounded-xl" aria-hidden="true" />
              )}
              <div className="relative z-10 grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 px-3 py-2.5">
                <span className="relative flex justify-center">
                  {index > 0 && <span className="welcome-step-line welcome-step-line--top" aria-hidden="true" />}
                  {!isLast && <span className="welcome-step-line welcome-step-line--bottom" aria-hidden="true" />}
                  <StepDot state={state} index={index} />
                </span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <step.icon className="welcome-step-icon size-4 shrink-0" strokeWidth={1.75} />
                  <span className="welcome-step-label truncate text-sm font-semibold">{step.label}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* 窄屏：横向步骤条 */}
      <ol className="mt-4 flex items-start gap-1 min-[960px]:hidden">
        {WELCOME_STEPS.map((step, index) => {
          const state = getStepState(index, activeIndex);
          const isLast = index === WELCOME_STEPS.length - 1;
          return (
            <li key={step.id} className="flex flex-1 flex-col items-center gap-2" data-state={state}>
              <div className="flex w-full items-center">
                <StepDot state={state} index={index} />
                {!isLast && <span className="welcome-step-hline mx-1 h-px flex-1" aria-hidden="true" />}
              </div>
              <span className="welcome-step-label max-w-full truncate text-xs font-semibold">
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function StepDot({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      className={cn(
        'welcome-step-dot relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors',
      )}
      data-state={state}
    >
      {state === 'done' ? <Check className="size-4" strokeWidth={2.5} /> : index + 1}
    </span>
  );
}
