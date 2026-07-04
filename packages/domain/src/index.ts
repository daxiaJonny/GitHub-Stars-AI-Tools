export type RepositoryId = string;
export type GitHubAccountId = string;
export type ISODateString = string;

export type RepositorySyncStatus = 'active' | 'removed' | 'gone' | 'error';
export type ReadStatus = 'unread' | 'read' | 'later';

export type RepositoryFacts = {
  id: RepositoryId;
  accountId: GitHubAccountId;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  htmlUrl: string;
  starsCount: number;
  forksCount: number;
  starredAt: ISODateString;
  pushedAt: ISODateString | null;
  syncStatus: RepositorySyncStatus;
};

export type RepositoryAnnotation = {
  repoId: RepositoryId;
  accountId: GitHubAccountId;
  noteMarkdown: string;
  tagIds: string[];
  readStatus: ReadStatus;
  updatedAt: ISODateString;
};

export type ReadmeDocument = {
  repoId: RepositoryId;
  rawMarkdown: string;
  contentHash: string;
  sourcePath: string;
  fetchedAt: ISODateString;
};

export type AiRepositoryDocument = {
  repoId: RepositoryId;
  summaryZh: string;
  readmeZh: string | null;
  keywords: string[];
  suggestedTags: string[];
  model: string;
  promptVersion: string;
  sourceHash: string;
  generatedAt: ISODateString;
};

export type RepoQuery = {
  text?: string;
  naturalLanguage?: string;
  languages?: string[];
  tags?: string[];
  topics?: string[];
  readStatus?: ReadStatus;
  sort?: 'relevance' | 'starred_at' | 'updated_at' | 'name';
  limit: number;
  offset: number;
};

export type SearchMatchReason = {
  kind: 'keyword' | 'language' | 'tag' | 'topic' | 'semantic';
  label: string;
  detail: string;
};

export type SearchResult = {
  repository: RepositoryFacts;
  score: number;
  reasons: SearchMatchReason[];
};

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type PipelineJob = {
  id: string;
  type: 'sync_stars' | 'fetch_readme' | 'summarize' | 'translate' | 'embed';
  status: JobStatus;
  idempotencyKey: string;
  retryCount: number;
  lastError: string | null;
};