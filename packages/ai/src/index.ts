import type { AiRepositoryDocument, ReadmeDocument, RepositoryFacts } from '@stars-ai/domain';

export type SummarizeReadmeInput = {
  repository: RepositoryFacts;
  readme: ReadmeDocument;
  promptVersion: string;
};

export type TranslateReadmeInput = {
  repository: RepositoryFacts;
  readme: ReadmeDocument;
  promptVersion: string;
};

export type EmbeddingInput = {
  repoId: string;
  text: string;
  sourceHash: string;
};

export type EmbeddingResult = {
  repoId: string;
  vector: number[];
  model: string;
  sourceHash: string;
};

export type QueryUnderstanding = {
  normalizedQuery: string;
  inferredLanguages: string[];
  inferredTopics: string[];
};

export type AiProvider = {
  summarizeReadme(input: SummarizeReadmeInput): Promise<AiRepositoryDocument>;
  translateReadme(input: TranslateReadmeInput): Promise<string>;
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
  understandQuery(query: string): Promise<QueryUnderstanding>;
};