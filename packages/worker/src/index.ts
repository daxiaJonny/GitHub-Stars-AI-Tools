import type { AiProvider, EmbeddingResult } from '@stars-ai/ai';
import type { AiRepositoryDocument, ReadmeDocument, RepositoryFacts } from '@stars-ai/domain';
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

export type ReadmeAiPipelineInput = {
  repository: RepositoryFacts;
  readme: ReadmeDocument;
  promptVersion: string;
  includeReadmeTranslation?: boolean;
  includeEmbedding?: boolean;
};

export type ReadmeAiPipelineResult = {
  document: AiRepositoryDocument;
  embedding: EmbeddingResult | null;
};

export type WorkerRuntime = {
  syncStars(): Promise<WorkerResult>;
  fetchReadmes(): Promise<WorkerResult>;
  summarizeReadmes(): Promise<WorkerResult>;
  rebuildSearchIndex(): Promise<WorkerResult>;
  runReadmeAiPipeline(input: ReadmeAiPipelineInput): Promise<ReadmeAiPipelineResult>;
};

/**
 * 将 README 的摘要、翻译、向量化编排在 worker 层，业务侧只依赖 Provider 合同。
 */
export async function runReadmeAiPipeline(
  dependencies: Pick<WorkerDependencies, 'ai' | 'storage'>,
  input: ReadmeAiPipelineInput,
): Promise<ReadmeAiPipelineResult> {
  const summarizedDocument = await dependencies.ai.summarizeReadme({
    repository: input.repository,
    readme: input.readme,
    promptVersion: input.promptVersion,
  });
  const translatedReadme = input.includeReadmeTranslation
    ? await dependencies.ai.translateReadme({
        repository: input.repository,
        readme: input.readme,
        promptVersion: input.promptVersion,
      })
    : null;
  const document: AiRepositoryDocument = {
    ...summarizedDocument,
    readmeZh: translatedReadme?.readmeZh ?? summarizedDocument.readmeZh,
    sourceHash: input.readme.contentHash,
  };
  const embedding = input.includeEmbedding
    ? await dependencies.ai.embed({
        repoId: input.repository.id,
        text: buildEmbeddingText(input.repository, input.readme, document),
        sourceHash: input.readme.contentHash,
      })
    : null;

  await dependencies.storage.saveAiDocument(document);

  return { document, embedding };
}

export function createWorkerRuntime(dependencies: WorkerDependencies): WorkerRuntime {
  return {
    async syncStars() {
      return { succeeded: true, message: 'Star 同步 Worker 已注册，等待实现 GitHub Provider' };
    },
    async fetchReadmes() {
      return { succeeded: true, message: 'README 抓取 Worker 已注册，等待实现任务队列' };
    },
    async summarizeReadmes() {
      return { succeeded: true, message: `中文摘要 Worker 已接入 ${dependencies.ai.metadata.displayName}` };
    },
    async rebuildSearchIndex() {
      return { succeeded: true, message: '检索索引 Worker 已注册，等待接入 Search Provider' };
    },
    async runReadmeAiPipeline(input) {
      return runReadmeAiPipeline(dependencies, input);
    },
  };
}

function buildEmbeddingText(
  repository: RepositoryFacts,
  readme: ReadmeDocument,
  document: AiRepositoryDocument,
) {
  return [
    repository.fullName,
    repository.description,
    repository.language,
    repository.topics.join(' '),
    document.summaryZh,
    document.keywords.join(' '),
    readme.rawMarkdown,
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n\n');
}