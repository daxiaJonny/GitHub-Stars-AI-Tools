import type { AiProvider } from '@stars-ai/ai';
import type { GitHubProvider } from '@stars-ai/github';
import type { SearchPort } from '@stars-ai/search';
import type { StoragePort } from '@stars-ai/storage';

export type WorkerDependencies = {
  github: GitHubProvider;
  storage: StoragePort;
  ai: AiProvider;
  search: SearchPort;
};

export type WorkerResult = {
  succeeded: boolean;
  message: string;
};

export type WorkerRuntime = {
  syncStars(): Promise<WorkerResult>;
  fetchReadmes(): Promise<WorkerResult>;
  summarizeReadmes(): Promise<WorkerResult>;
  rebuildSearchIndex(): Promise<WorkerResult>;
};

export function createWorkerRuntime(dependencies: WorkerDependencies): WorkerRuntime {
  void dependencies;

  return {
    async syncStars() {
      return { succeeded: true, message: 'Star 同步 Worker 已注册，等待实现 GitHub Provider' };
    },
    async fetchReadmes() {
      return { succeeded: true, message: 'README 抓取 Worker 已注册，等待实现任务队列' };
    },
    async summarizeReadmes() {
      return { succeeded: true, message: '中文摘要 Worker 已注册，等待接入 AI Provider' };
    },
    async rebuildSearchIndex() {
      return { succeeded: true, message: '检索索引 Worker 已注册，等待接入 Search Provider' };
    },
  };
}