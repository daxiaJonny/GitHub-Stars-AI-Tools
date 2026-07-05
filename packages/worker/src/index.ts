import type { AiProvider, EmbeddingResult } from '@stars-ai/ai';
import type { AiRepositoryDocument, GitHubAccountId, ISODateString, ReadmeDocument, RepositoryEmbeddingRecord, RepositoryFacts } from '@stars-ai/domain';
import type { GitHubProvider } from '@stars-ai/github';
import type { SearchPort, VectorIndexPort } from '@stars-ai/search';
import type { StoragePort } from '@stars-ai/storage';

export type WorkerDependencies = {
  github: GitHubProvider;
  storage: StoragePort;
  ai: AiProvider;
  search: SearchPort;
  vectorIndex?: VectorIndexPort;
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
  embeddingModelVersion?: string;
};

export type ReadmeAiPipelineResult = {
  document: AiRepositoryDocument;
  embedding: EmbeddingResult | null;
};

export type SummarizeReadmesInput = {
  accountId: GitHubAccountId;
  promptVersion: string;
  limit?: number;
  includeEmbedding?: boolean;
  embeddingModelVersion?: string;
};

export type SummarizeReadmesResult = {
  totalCount: number;
  generatedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: Array<{
    repoId: string;
    message: string;
  }>;
};

export type BuildRepositoryEmbeddingIndexInput = {
  accountId: GitHubAccountId;
  modelVersion: string;
  limit?: number;
};

export type BuildRepositoryEmbeddingIndexResult = {
  totalCount: number;
  indexedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: Array<{
    repoId: string;
    message: string;
  }>;
};

export type WorkerRuntime = {
  syncStars(): Promise<WorkerResult>;
  fetchReadmes(): Promise<WorkerResult>;
  summarizeReadmes(): Promise<WorkerResult>;
  summarizeReadmeBatch(input: SummarizeReadmesInput): Promise<SummarizeReadmesResult>;
  buildRepositoryEmbeddingIndex(input: BuildRepositoryEmbeddingIndexInput): Promise<BuildRepositoryEmbeddingIndexResult>;
  rebuildSearchIndex(): Promise<WorkerResult>;
  runReadmeAiPipeline(input: ReadmeAiPipelineInput): Promise<ReadmeAiPipelineResult>;
};

/**
 * 将 README 的摘要、翻译、向量化编排在 worker 层，业务侧只依赖 Provider 合同。
 */
export async function runReadmeAiPipeline(
  dependencies: Pick<WorkerDependencies, 'ai' | 'storage' | 'vectorIndex'>,
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
        text: buildReadmeEmbeddingText(input.repository, input.readme, document),
        sourceHash: input.readme.contentHash,
      })
    : null;

  await dependencies.storage.saveAiDocument(document);

  if (embedding) {
    const embeddingRecord = createRepositoryEmbeddingRecord({
      embedding,
      modelVersion: input.embeddingModelVersion ?? dependencies.ai.metadata.model,
      generatedAt: currentIsoTimestamp(),
    });
    await dependencies.storage.saveRepositoryEmbedding(embeddingRecord);
    await dependencies.vectorIndex?.upsertRepositoryEmbedding(embeddingRecord);
  }

  return { document, embedding };
}

/**
 * 批量生成 README 中文摘要；README hash 未变化时直接跳过，避免重复消耗模型调用。
 */
export async function summarizeReadmeBatch(
  dependencies: Pick<WorkerDependencies, 'ai' | 'storage' | 'vectorIndex'>,
  input: SummarizeReadmesInput,
): Promise<SummarizeReadmesResult> {
  const candidates = await dependencies.storage.listReadmeAiCandidates(input.accountId, input.limit ?? 50);
  const result: SummarizeReadmesResult = {
    totalCount: candidates.length,
    generatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    if (candidate.aiDocument?.sourceHash === candidate.readme.contentHash) {
      result.skippedCount += 1;
      continue;
    }

    try {
      await runReadmeAiPipeline(dependencies, {
        repository: candidate.repository,
        readme: candidate.readme,
        promptVersion: input.promptVersion,
        includeEmbedding: input.includeEmbedding,
        embeddingModelVersion: input.embeddingModelVersion,
      });
      result.generatedCount += 1;
    } catch (error) {
      result.failedCount += 1;
      result.failures.push({
        repoId: candidate.repository.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function buildRepositoryEmbeddingIndex(
  dependencies: Pick<WorkerDependencies, 'ai' | 'storage' | 'vectorIndex'>,
  input: BuildRepositoryEmbeddingIndexInput,
): Promise<BuildRepositoryEmbeddingIndexResult> {
  const candidates = await dependencies.storage.listRepositoryEmbeddingCandidates(
    input.accountId,
    dependencies.ai.metadata.model,
    input.modelVersion,
    input.limit ?? 50,
  );
  const result: BuildRepositoryEmbeddingIndexResult = {
    totalCount: candidates.length,
    indexedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    failures: [],
  };

  for (const candidate of candidates) {
    const unchangedEmbedding = candidate.embedding?.sourceHash === candidate.aiDocument.sourceHash;

    if (unchangedEmbedding) {
      result.skippedCount += 1;
      continue;
    }

    try {
      const embedding = await dependencies.ai.embed({
        repoId: candidate.repository.id,
        text: buildRepositoryKnowledgeText(candidate.repository, candidate.aiDocument),
        sourceHash: candidate.aiDocument.sourceHash,
      });
      const embeddingRecord = createRepositoryEmbeddingRecord({
        embedding,
        modelVersion: input.modelVersion,
        generatedAt: currentIsoTimestamp(),
      });

      await dependencies.storage.saveRepositoryEmbedding(embeddingRecord);
      await dependencies.vectorIndex?.upsertRepositoryEmbedding(embeddingRecord);
      result.indexedCount += 1;
    } catch (error) {
      result.failedCount += 1;
      result.failures.push({
        repoId: candidate.repository.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
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
    async summarizeReadmeBatch(input) {
      return summarizeReadmeBatch(dependencies, input);
    },
    async buildRepositoryEmbeddingIndex(input) {
      return buildRepositoryEmbeddingIndex(dependencies, input);
    },
    async rebuildSearchIndex() {
      return { succeeded: true, message: '检索索引 Worker 已注册，等待接入 Search Provider' };
    },
    async runReadmeAiPipeline(input) {
      return runReadmeAiPipeline(dependencies, input);
    },
  };
}

function createRepositoryEmbeddingRecord(input: {
  embedding: EmbeddingResult;
  modelVersion: string;
  generatedAt: ISODateString;
}): RepositoryEmbeddingRecord {
  return {
    repoId: input.embedding.repoId,
    sourceKind: 'repository_knowledge',
    sourceHash: input.embedding.sourceHash,
    model: input.embedding.model,
    modelVersion: input.modelVersion,
    dimensions: input.embedding.vector.length,
    vector: input.embedding.vector,
    generatedAt: input.generatedAt,
  };
}

function buildReadmeEmbeddingText(
  repository: RepositoryFacts,
  readme: ReadmeDocument,
  document: AiRepositoryDocument,
) {
  return [
    ...repositoryKnowledgeParts(repository, document),
    readme.rawMarkdown,
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n\n');
}

function buildRepositoryKnowledgeText(repository: RepositoryFacts, document: AiRepositoryDocument) {
  return repositoryKnowledgeParts(repository, document)
    .filter((item): item is string => Boolean(item))
    .join('\n\n');
}

function repositoryKnowledgeParts(repository: RepositoryFacts, document: AiRepositoryDocument) {
  return [
    repository.fullName,
    repository.description,
    repository.language,
    repository.topics.join(' '),
    document.summaryZh,
    document.readmeZh,
    document.keywords.join(' '),
    document.suggestedTags.join(' '),
  ];
}

function currentIsoTimestamp(): ISODateString {
  return new Date().toISOString();
}