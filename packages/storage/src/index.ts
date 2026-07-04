import type {
  AiRepositoryDocument,
  GitHubAccountId,
  PipelineJob,
  ReadmeDocument,
  RepositoryAnnotation,
  RepositoryFacts,
  RepositoryId,
} from '@stars-ai/domain';
import { storageMigrations, type SqlMigration } from './migrations.js';

export type StoragePort = {
  upsertRepository(repository: RepositoryFacts): Promise<void>;
  getRepository(repoId: RepositoryId): Promise<RepositoryFacts | null>;
  saveReadme(readme: ReadmeDocument): Promise<void>;
  saveAiDocument(document: AiRepositoryDocument): Promise<void>;
  saveAnnotation(annotation: RepositoryAnnotation): Promise<void>;
  listPendingJobs(accountId: GitHubAccountId): Promise<PipelineJob[]>;
};

export type MigrationPort = {
  migrate(): Promise<void>;
};

export type MigrationSource = {
  listMigrations(): readonly SqlMigration[];
};

export const sqliteMigrationSource: MigrationSource = {
  listMigrations() {
    return storageMigrations;
  },
};