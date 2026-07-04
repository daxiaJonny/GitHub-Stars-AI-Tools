import type { RepoQuery, SearchResult } from '@stars-ai/domain';

export type SearchPort = {
  search(query: RepoQuery): Promise<SearchResult[]>;
};

export type IndexPort = {
  rebuildRepositoryIndex(repoId: string): Promise<void>;
};

export type QueryInterpreter = {
  toRepoQuery(input: string, base?: Partial<RepoQuery>): Promise<RepoQuery>;
};