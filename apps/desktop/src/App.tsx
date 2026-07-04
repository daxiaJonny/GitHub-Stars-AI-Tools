import { invoke } from '@tauri-apps/api/core';
import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';

type BackendStatus = {
  backend: string;
  storage: string;
  worker: string;
  provider: string;
};

type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
};

type GitHubAuthState = {
  hasToken: boolean;
  user: GitHubUser | null;
};

type StarSyncSummary = {
  accountLogin: string;
  syncedCount: number;
};

type ReadmeFetchSummary = {
  totalCount: number;
  fetchedCount: number;
  skippedCount: number;
  missingCount: number;
};

type RepositoryListItem = {
  id: string;
  accountId: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  htmlUrl: string;
  starsCount: number;
  forksCount: number;
  starredAt: string;
  pushedAt: string | null;
  hasReadme: boolean;
};

type RepositoryListPage = {
  items: RepositoryListItem[];
  totalCount: number;
  limit: number;
  offset: number;
};

type RepositoryFilters = {
  keyword: string;
  language: string;
  tagId: string;
};

type TagItem = {
  id: string;
  accountId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

type RepositoryAnnotationView = {
  repositoryId: string;
  accountId: string;
  noteMarkdown: string;
  readingStatus: ReadingStatus;
  tags: TagItem[];
  updatedAt: string;
};

type ReadingStatus = 'unread' | 'read' | 'later';

const capabilities = [
  '同步 GitHub Stars',
  '管理标签与笔记',
  '抓取 README 并生成中文摘要',
  '用自然语言找回已 Star 项目',
];

const readingStatusLabels: Record<ReadingStatus, string> = {
  unread: '未读',
  later: '稍后阅读',
  read: '已读',
};

const initialAuthState: GitHubAuthState = {
  hasToken: false,
  user: null,
};

const emptyRepositoryFilters: RepositoryFilters = {
  keyword: '',
  language: '',
  tagId: '',
};

export function App() {
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [authState, setAuthState] = useState<GitHubAuthState>(initialAuthState);
  const [token, setToken] = useState('');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isClearingToken, setIsClearingToken] = useState(false);
  const [isSyncingStars, setIsSyncingStars] = useState(false);
  const [isFetchingReadmes, setIsFetchingReadmes] = useState(false);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [isLoadingAnnotation, setIsLoadingAnnotation] = useState(false);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [syncSummary, setSyncSummary] = useState<StarSyncSummary | null>(null);
  const [readmeSummary, setReadmeSummary] = useState<ReadmeFetchSummary | null>(null);
  const [repositoryPage, setRepositoryPage] = useState<RepositoryListPage | null>(null);
  const [repositoryLanguages, setRepositoryLanguages] = useState<string[]>([]);
  const [repositoryFilters, setRepositoryFilters] = useState<RepositoryFilters>(emptyRepositoryFilters);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [annotation, setAnnotation] = useState<RepositoryAnnotationView | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [readingStatusDraft, setReadingStatusDraft] = useState<ReadingStatus>('unread');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#fef0c7');
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [annotationMessage, setAnnotationMessage] = useState<string | null>(null);

  const selectedRepository = useMemo(
    () => repositoryPage?.items.find((repository) => repository.id === selectedRepositoryId) ?? null,
    [repositoryPage, selectedRepositoryId],
  );

  useEffect(() => {
    invoke<BackendStatus>('get_backend_status')
      .then(setStatus)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });

    invoke<GitHubAuthState>('get_github_auth_state')
      .then(setAuthState)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });

    loadRepositories(emptyRepositoryFilters);
    loadRepositoryLanguages();
  }, []);

  useEffect(() => {
    if (!repositoryPage || repositoryPage.items.length === 0) {
      setSelectedRepositoryId(null);
      return;
    }

    const selectedStillExists = repositoryPage.items.some((repository) => repository.id === selectedRepositoryId);

    if (!selectedStillExists) {
      setSelectedRepositoryId(repositoryPage.items[0].id);
    }
  }, [repositoryPage, selectedRepositoryId]);

  useEffect(() => {
    if (!selectedRepository) {
      setAnnotation(null);
      setNoteDraft('');
      setReadingStatusDraft('unread');
      return;
    }

    loadAnnotationWorkspace(selectedRepository);
  }, [selectedRepository?.id, selectedRepository?.accountId]);

  async function loadRepositories(nextFilters = repositoryFilters) {
    setIsLoadingRepositories(true);

    try {
      const page = await invoke<RepositoryListPage>('list_repositories', {
        request: {
          limit: 1000,
          offset: 0,
          keyword: optionalRequestText(nextFilters.keyword),
          language: optionalRequestText(nextFilters.language),
          tagId: optionalRequestText(nextFilters.tagId),
        },
      });
      setRepositoryPage(page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoadingRepositories(false);
    }
  }

  async function loadRepositoryLanguages() {
    try {
      const languages = await invoke<string[]>('list_repository_languages');
      setRepositoryLanguages(languages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function applyRepositoryFilters(nextFilters: RepositoryFilters) {
    setRepositoryFilters(nextFilters);
    await loadRepositories(nextFilters);
  }

  async function resetRepositoryFilters() {
    setRepositoryFilters(emptyRepositoryFilters);
    await loadRepositories(emptyRepositoryFilters);
  }

  async function refreshRepositoryWorkspace() {
    await Promise.all([loadRepositories(repositoryFilters), loadRepositoryLanguages()]);
  }

  async function loadAnnotationWorkspace(repository: RepositoryListItem) {
    setIsLoadingAnnotation(true);
    setAnnotationMessage(null);

    try {
      const [nextTags, nextAnnotation] = await Promise.all([
        invoke<TagItem[]>('list_tags', { request: { accountId: repository.accountId } }),
        invoke<RepositoryAnnotationView>('get_repository_annotation', {
          request: { repositoryId: repository.id, accountId: repository.accountId },
        }),
      ]);
      setTags(nextTags);
      setAnnotation(nextAnnotation);
      setNoteDraft(nextAnnotation.noteMarkdown);
      setReadingStatusDraft(nextAnnotation.readingStatus);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoadingAnnotation(false);
    }
  }

  async function handleSaveToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingToken(true);
    setError(null);
    setAuthMessage(null);

    try {
      const user = await invoke<GitHubUser>('save_github_token', { token });
      setAuthState({ hasToken: true, user });
      setToken('');
      setAuthMessage('GitHub 账号已连接，下一步可以同步 Stars。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSavingToken(false);
    }
  }

  async function handleClearToken() {
    setIsClearingToken(true);
    setError(null);
    setAuthMessage(null);

    try {
      await invoke('clear_github_token');
      setAuthState(initialAuthState);
      setSyncSummary(null);
      setReadmeSummary(null);
      setAuthMessage('GitHub 连接已移除，本地 Star 数据不会被删除。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsClearingToken(false);
    }
  }

  async function handleSyncStars() {
    setIsSyncingStars(true);
    setError(null);
    setAuthMessage(null);

    try {
      const summary = await invoke<StarSyncSummary>('sync_github_stars');
      setSyncSummary(summary);
      setReadmeSummary(null);
      await refreshRepositoryWorkspace();
      setAuthMessage(`已同步 ${summary.syncedCount} 个 Star 项目。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSyncingStars(false);
    }
  }

  async function handleFetchReadmes() {
    setIsFetchingReadmes(true);
    setError(null);
    setAuthMessage(null);

    try {
      const summary = await invoke<ReadmeFetchSummary>('fetch_repository_readmes');
      setReadmeSummary(summary);
      await refreshRepositoryWorkspace();
      setAuthMessage(`README 已处理 ${summary.totalCount} 个仓库。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsFetchingReadmes(false);
    }
  }

  async function handleCreateTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRepository || newTagName.trim().length === 0) {
      return;
    }

    setIsSavingTag(true);
    setError(null);
    setAnnotationMessage(null);

    try {
      const createdTag = await invoke<TagItem>('create_tag', {
        request: {
          accountId: selectedRepository.accountId,
          name: newTagName,
          color: newTagColor,
        },
      });
      setTags((currentTags) => [...currentTags, createdTag].sort((left, right) => left.name.localeCompare(right.name)));
      setNewTagName('');
      setAnnotationMessage('标签已创建。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleRenameTag(tag: TagItem) {
    if (!selectedRepository) {
      return;
    }

    const nextName = window.prompt('输入新的标签名称', tag.name)?.trim();

    if (!nextName || nextName === tag.name) {
      return;
    }

    setIsSavingTag(true);
    setError(null);
    setAnnotationMessage(null);

    try {
      const nextTag = await invoke<TagItem>('update_tag', {
        request: {
          accountId: selectedRepository.accountId,
          tagId: tag.id,
          name: nextName,
          color: tag.color,
        },
      });
      setTags((currentTags) => currentTags.map((item) => (item.id === nextTag.id ? nextTag : item)));
      setAnnotation((currentAnnotation) =>
        currentAnnotation
          ? {
              ...currentAnnotation,
              tags: currentAnnotation.tags.map((item) => (item.id === nextTag.id ? nextTag : item)),
            }
          : currentAnnotation,
      );
      setAnnotationMessage('标签已重命名。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleDeleteTag(tag: TagItem) {
    if (!selectedRepository || !window.confirm(`删除标签“${tag.name}”？已打标的项目会自动移除此标签。`)) {
      return;
    }

    setIsSavingTag(true);
    setError(null);
    setAnnotationMessage(null);

    try {
      await invoke('delete_tag', {
        request: {
          accountId: selectedRepository.accountId,
          tagId: tag.id,
        },
      });
      setTags((currentTags) => currentTags.filter((item) => item.id !== tag.id));
      if (repositoryFilters.tagId === tag.id) {
        await resetRepositoryFilters();
      } else {
        await loadRepositories(repositoryFilters);
      }
      setAnnotation((currentAnnotation) =>
        currentAnnotation
          ? { ...currentAnnotation, tags: currentAnnotation.tags.filter((item) => item.id !== tag.id) }
          : currentAnnotation,
      );
      setAnnotationMessage('标签已删除。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleToggleRepositoryTag(tag: TagItem) {
    if (!selectedRepository || !annotation) {
      return;
    }

    setIsSavingTag(true);
    setError(null);
    setAnnotationMessage(null);

    const currentTagIds = new Set(annotation.tags.map((item) => item.id));

    if (currentTagIds.has(tag.id)) {
      currentTagIds.delete(tag.id);
    } else {
      currentTagIds.add(tag.id);
    }

    try {
      const nextAnnotation = await invoke<RepositoryAnnotationView>('set_repository_tags', {
        request: {
          repositoryId: selectedRepository.id,
          accountId: selectedRepository.accountId,
          tagIds: Array.from(currentTagIds),
        },
      });
      setAnnotation(nextAnnotation);
      if (repositoryFilters.tagId === tag.id) {
        await loadRepositories(repositoryFilters);
      }
      setAnnotationMessage('仓库标签已更新。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleSaveAnnotation() {
    if (!selectedRepository) {
      return;
    }

    setIsSavingAnnotation(true);
    setError(null);
    setAnnotationMessage(null);

    try {
      const nextAnnotation = await invoke<RepositoryAnnotationView>('save_repository_annotation', {
        request: {
          repositoryId: selectedRepository.id,
          accountId: selectedRepository.accountId,
          noteMarkdown: noteDraft,
          readingStatus: readingStatusDraft,
        },
      });
      setAnnotation(nextAnnotation);
      setNoteDraft(nextAnnotation.noteMarkdown);
      setReadingStatusDraft(nextAnnotation.readingStatus);
      setAnnotationMessage('笔记和阅读状态已保存。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsSavingAnnotation(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">★</span>
          <div>
            <strong>Stars AI</strong>
            <small>本地优先的 GitHub Star 知识库</small>
          </div>
        </div>
        <nav className="nav-list" aria-label="主导航">
          <a className="nav-item active" href="#workspace">工作台</a>
          <a className="nav-item" href="#search">AI 检索</a>
          <a className="nav-item" href="#sync">同步中心</a>
          <a className="nav-item" href="#settings">设置</a>
        </nav>
      </aside>

      <section className="content-panel" id="workspace">
        <header className="hero">
          <p className="eyebrow">Tauri 本地后端 + SQLite + 本地 Worker + Provider 抽象</p>
          <h1>把 GitHub Stars 变成可检索、可理解的个人 AI 知识库</h1>
          <p className="hero-copy">
            当前正在建立 GitHub 连接能力。Token 只保存到系统安全存储，前端不会持久化密钥。
          </p>
        </header>

        <section className="status-grid" aria-label="本地后端状态">
          <StatusCard label="Rust 后端" value={status?.backend ?? '等待连接'} />
          <StatusCard label="本地数据库" value={status?.storage ?? '待初始化'} />
          <StatusCard label="后台任务" value={status?.worker ?? '待启动'} />
          <StatusCard label="AI Provider" value={status?.provider ?? '待配置'} />
        </section>

        {error ? <p className="error-message">{error}</p> : null}
        {authMessage ? <p className="success-message">{authMessage}</p> : null}

        <section className="capability-card" id="repositories">
          <div className="section-heading">
            <div>
              <p className="eyebrow compact">Star 工作台</p>
              <h2>已同步项目</h2>
            </div>
            <button className="secondary-button compact-button" disabled={isLoadingRepositories} onClick={refreshRepositoryWorkspace} type="button">
              {isLoadingRepositories ? '正在刷新…' : '刷新列表'}
            </button>
          </div>

          <RepositoryWorkspace
            annotation={annotation}
            annotationMessage={annotationMessage}
            filters={repositoryFilters}
            isLoading={isLoadingRepositories}
            isLoadingAnnotation={isLoadingAnnotation}
            isSavingAnnotation={isSavingAnnotation}
            isSavingTag={isSavingTag}
            languages={repositoryLanguages}
            newTagColor={newTagColor}
            newTagName={newTagName}
            noteDraft={noteDraft}
            page={repositoryPage}
            readingStatusDraft={readingStatusDraft}
            selectedRepository={selectedRepository}
            tags={tags}
            onApplyFilters={applyRepositoryFilters}
            onCreateTag={handleCreateTag}
            onDeleteTag={handleDeleteTag}
            onRenameTag={handleRenameTag}
            onResetFilters={resetRepositoryFilters}
            onSaveAnnotation={handleSaveAnnotation}
            onSelectRepository={setSelectedRepositoryId}
            onSetNewTagColor={setNewTagColor}
            onSetNewTagName={setNewTagName}
            onSetNoteDraft={setNoteDraft}
            onSetReadingStatusDraft={setReadingStatusDraft}
            onToggleRepositoryTag={handleToggleRepositoryTag}
          />
        </section>

        <section className="capability-card" id="settings">
          <div className="section-heading">
            <div>
              <p className="eyebrow compact">GitHub 连接</p>
              <h2>连接你的 GitHub 账号</h2>
            </div>
            <AuthBadge authState={authState} />
          </div>

          <div className="auth-layout">
            <form className="token-form" onSubmit={handleSaveToken}>
              <label htmlFor="github-token">Personal Access Token</label>
              <input
                id="github-token"
                value={token}
                type="password"
                autoComplete="off"
                placeholder="粘贴 GitHub Token"
                onChange={(event) => setToken(event.target.value)}
              />
              <p className="form-help">
                建议使用 fine-grained token，并授予读取已 Star 仓库所需的最小权限。
              </p>
              <button className="primary-button" disabled={isSavingToken} type="submit">
                {isSavingToken ? '正在验证…' : '验证并保存'}
              </button>
            </form>

            <GitHubAccountCard
              authState={authState}
              isClearingToken={isClearingToken}
              onClearToken={handleClearToken}
            />
          </div>
        </section>

        <section className="capability-card" id="sync">
          <div className="section-heading">
            <div>
              <p className="eyebrow compact">同步中心</p>
              <h2>同步 GitHub Stars</h2>
            </div>
            <span className="auth-badge">Task 2.3</span>
          </div>

          <div className="sync-layout">
            <div>
              <p className="form-help">
                先从 GitHub API 分页同步全部 Star 仓库，再抓取 README 并按内容 hash 缓存。重复执行会跳过未变化的 README，不会覆盖标签和笔记。
              </p>
              {syncSummary ? (
                <p className="sync-result">
                  @{syncSummary.accountLogin} 当前已同步 {syncSummary.syncedCount} 个 Star 项目。
                </p>
              ) : null}
              {readmeSummary ? (
                <p className="sync-result">
                  README：新增/更新 {readmeSummary.fetchedCount} 个，跳过 {readmeSummary.skippedCount} 个，无 README {readmeSummary.missingCount} 个。
                </p>
              ) : null}
            </div>
            <div className="sync-actions">
              <button
                className="primary-button"
                disabled={!authState.user || isSyncingStars}
                onClick={handleSyncStars}
                type="button"
              >
                {isSyncingStars ? '正在同步…' : '同步 Stars'}
              </button>
              <button
                className="secondary-button"
                disabled={!authState.user || isFetchingReadmes}
                onClick={handleFetchReadmes}
                type="button"
              >
                {isFetchingReadmes ? '正在抓取…' : '抓取 README'}
              </button>
            </div>
          </div>
        </section>

        <section className="capability-card">
          <h2>首个可用闭环</h2>
          <div className="capability-list">
            {capabilities.map((capability) => (
              <span key={capability}>{capability}</span>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function StatusCard(props: { label: string; value: string }) {
  return (
    <article className="status-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function RepositoryWorkspace(props: {
  annotation: RepositoryAnnotationView | null;
  annotationMessage: string | null;
  filters: RepositoryFilters;
  isLoading: boolean;
  isLoadingAnnotation: boolean;
  isSavingAnnotation: boolean;
  isSavingTag: boolean;
  languages: string[];
  newTagColor: string;
  newTagName: string;
  noteDraft: string;
  page: RepositoryListPage | null;
  readingStatusDraft: ReadingStatus;
  selectedRepository: RepositoryListItem | null;
  tags: TagItem[];
  onApplyFilters: (filters: RepositoryFilters) => void;
  onCreateTag: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteTag: (tag: TagItem) => void;
  onRenameTag: (tag: TagItem) => void;
  onResetFilters: () => void;
  onSaveAnnotation: () => void;
  onSelectRepository: (repositoryId: string) => void;
  onSetNewTagColor: (value: string) => void;
  onSetNewTagName: (value: string) => void;
  onSetNoteDraft: (value: string) => void;
  onSetReadingStatusDraft: (value: ReadingStatus) => void;
  onToggleRepositoryTag: (tag: TagItem) => void;
}) {
  if (props.isLoading && !props.page) {
    return <p className="empty-state">正在读取本地 Star 列表…</p>;
  }

  const hasActiveFilters = Boolean(props.filters.keyword || props.filters.language || props.filters.tagId);

  if (!props.page) {
    return (
      <div className="repo-workspace">
        <RepositoryFilterBar
          filters={props.filters}
          isLoading={props.isLoading}
          languages={props.languages}
          tags={props.tags}
          onApplyFilters={props.onApplyFilters}
          onResetFilters={props.onResetFilters}
        />
        <p className="empty-state">正在等待本地 Star 列表。</p>
      </div>
    );
  }

  if (props.page.items.length === 0) {
    return (
      <div className="repo-workspace">
        <RepositoryFilterBar
          filters={props.filters}
          isLoading={props.isLoading}
          languages={props.languages}
          tags={props.tags}
          onApplyFilters={props.onApplyFilters}
          onResetFilters={props.onResetFilters}
        />
        <div className="empty-state">
          <strong>{hasActiveFilters ? '没有匹配的 Star 项目' : '还没有同步的 Star 项目'}</strong>
          <p>
            {hasActiveFilters
              ? '可以调整关键词、语言或标签筛选条件后重新查询。'
              : '连接 GitHub 后先点击“同步 Stars”，这里会展示仓库名称、语言、Topics、Star 数和 README 状态。'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="repo-workspace split">
      <div className="repo-list-panel">
        <RepositoryFilterBar
          filters={props.filters}
          isLoading={props.isLoading}
          languages={props.languages}
          tags={props.tags}
          onApplyFilters={props.onApplyFilters}
          onResetFilters={props.onResetFilters}
        />
        <div className="repo-toolbar">
          <span>匹配 {props.page.totalCount} 个项目</span>
          <span>当前显示 {props.page.items.length} 个</span>
        </div>
        <div className="repo-list" role="list">
          {props.page.items.map((repository) => (
            <RepositoryCard
              key={repository.id}
              isSelected={repository.id === props.selectedRepository?.id}
              repository={repository}
              onSelectRepository={props.onSelectRepository}
            />
          ))}
        </div>
      </div>

      <AnnotationPanel
        annotation={props.annotation}
        annotationMessage={props.annotationMessage}
        isLoadingAnnotation={props.isLoadingAnnotation}
        isSavingAnnotation={props.isSavingAnnotation}
        isSavingTag={props.isSavingTag}
        newTagColor={props.newTagColor}
        newTagName={props.newTagName}
        noteDraft={props.noteDraft}
        readingStatusDraft={props.readingStatusDraft}
        repository={props.selectedRepository}
        tags={props.tags}
        onCreateTag={props.onCreateTag}
        onDeleteTag={props.onDeleteTag}
        onRenameTag={props.onRenameTag}
        onSaveAnnotation={props.onSaveAnnotation}
        onSetNewTagColor={props.onSetNewTagColor}
        onSetNewTagName={props.onSetNewTagName}
        onSetNoteDraft={props.onSetNoteDraft}
        onSetReadingStatusDraft={props.onSetReadingStatusDraft}
        onToggleRepositoryTag={props.onToggleRepositoryTag}
      />
    </div>
  );
}

function RepositoryFilterBar(props: {
  filters: RepositoryFilters;
  isLoading: boolean;
  languages: string[];
  tags: TagItem[];
  onApplyFilters: (filters: RepositoryFilters) => void;
  onResetFilters: () => void;
}) {
  const [draftFilters, setDraftFilters] = useState<RepositoryFilters>(props.filters);
  const hasActiveFilters = Boolean(props.filters.keyword || props.filters.language || props.filters.tagId);

  useEffect(() => {
    setDraftFilters(props.filters);
  }, [props.filters]);

  function updateDraftFilter<Key extends keyof RepositoryFilters>(key: Key, value: RepositoryFilters[Key]) {
    setDraftFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onApplyFilters(draftFilters);
  }

  function handleReset() {
    setDraftFilters(emptyRepositoryFilters);
    props.onResetFilters();
  }

  return (
    <form className="filter-bar" onSubmit={handleSubmit}>
      <label htmlFor="repository-keyword">
        <span>关键词</span>
        <input
          id="repository-keyword"
          value={draftFilters.keyword}
          placeholder="搜索名称、描述、Topics 或笔记"
          onChange={(event) => updateDraftFilter('keyword', event.target.value)}
        />
      </label>
      <label htmlFor="repository-language">
        <span>语言</span>
        <select
          id="repository-language"
          value={draftFilters.language}
          onChange={(event) => updateDraftFilter('language', event.target.value)}
        >
          <option value="">全部语言</option>
          {props.languages.map((language) => (
            <option key={language} value={language}>{language}</option>
          ))}
        </select>
      </label>
      <label htmlFor="repository-tag">
        <span>标签</span>
        <select
          id="repository-tag"
          value={draftFilters.tagId}
          onChange={(event) => updateDraftFilter('tagId', event.target.value)}
        >
          <option value="">全部标签</option>
          {props.tags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
      </label>
      <div className="filter-actions">
        <button className="primary-button" disabled={props.isLoading} type="submit">
          {props.isLoading ? '正在搜索…' : '搜索'}
        </button>
        <button className="secondary-button" disabled={props.isLoading || !hasActiveFilters} type="button" onClick={handleReset}>
          重置
        </button>
      </div>
    </form>
  );
}

function RepositoryCard(props: {
  isSelected: boolean;
  repository: RepositoryListItem;
  onSelectRepository: (repositoryId: string) => void;
}) {
  const repository = props.repository;

  return (
    <article className={props.isSelected ? 'repo-card selected' : 'repo-card'} role="listitem">
      <button className="repo-select-button" type="button" onClick={() => props.onSelectRepository(repository.id)}>
        <span>整理</span>
      </button>
      <div className="repo-card-main">
        <div>
          <a className="repo-name" href={repository.htmlUrl} target="_blank" rel="noreferrer">
            {repository.fullName}
          </a>
          <p>{repository.description ?? '这个项目暂未提供描述。'}</p>
        </div>
        <span className={repository.hasReadme ? 'readme-badge ready' : 'readme-badge'}>
          {repository.hasReadme ? 'README 已缓存' : 'README 待抓取'}
        </span>
      </div>
      <div className="repo-meta">
        {repository.language ? <span>{repository.language}</span> : null}
        <span>★ {repository.starsCount.toLocaleString()}</span>
        <span>Fork {repository.forksCount.toLocaleString()}</span>
        <span>Starred {formatDate(repository.starredAt)}</span>
      </div>
      {repository.topics.length > 0 ? (
        <div className="topic-list">
          {repository.topics.slice(0, 8).map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function AnnotationPanel(props: {
  annotation: RepositoryAnnotationView | null;
  annotationMessage: string | null;
  isLoadingAnnotation: boolean;
  isSavingAnnotation: boolean;
  isSavingTag: boolean;
  newTagColor: string;
  newTagName: string;
  noteDraft: string;
  readingStatusDraft: ReadingStatus;
  repository: RepositoryListItem | null;
  tags: TagItem[];
  onCreateTag: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteTag: (tag: TagItem) => void;
  onRenameTag: (tag: TagItem) => void;
  onSaveAnnotation: () => void;
  onSetNewTagColor: (value: string) => void;
  onSetNewTagName: (value: string) => void;
  onSetNoteDraft: (value: string) => void;
  onSetReadingStatusDraft: (value: ReadingStatus) => void;
  onToggleRepositoryTag: (tag: TagItem) => void;
}) {
  const selectedTagIds = new Set(props.annotation?.tags.map((tag) => tag.id) ?? []);

  if (!props.repository) {
    return (
      <aside className="annotation-panel empty">
        <strong>选择一个项目开始整理</strong>
        <p>标签、阅读状态和 Markdown 笔记会写入本地注解层，不会被 GitHub 同步覆盖。</p>
      </aside>
    );
  }

  return (
    <aside className="annotation-panel">
      <div className="annotation-header">
        <div>
          <span>当前整理</span>
          <strong>{props.repository.fullName}</strong>
        </div>
        <span className="auth-badge">Task 3.2</span>
      </div>

      {props.isLoadingAnnotation ? <p className="form-help">正在读取标签和笔记…</p> : null}
      {props.annotationMessage ? <p className="success-message compact-message">{props.annotationMessage}</p> : null}

      <label className="field-group" htmlFor="reading-status">
        <span>阅读状态</span>
        <select
          id="reading-status"
          value={props.readingStatusDraft}
          onChange={(event) => props.onSetReadingStatusDraft(event.target.value as ReadingStatus)}
        >
          {Object.entries(readingStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <div className="field-group">
        <span>项目标签</span>
        {props.tags.length > 0 ? (
          <div className="tag-chip-list">
            {props.tags.map((tag) => (
              <button
                key={tag.id}
                className={selectedTagIds.has(tag.id) ? 'tag-chip selected' : 'tag-chip'}
                disabled={props.isSavingTag}
                style={tag.color ? { '--tag-color': tag.color } as CSSProperties : undefined}
                type="button"
                onClick={() => props.onToggleRepositoryTag(tag)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="form-help">还没有标签。先创建一个标签，再给项目打标。</p>
        )}
      </div>

      <form className="tag-create-form" onSubmit={props.onCreateTag}>
        <input
          value={props.newTagName}
          placeholder="新标签名称"
          onChange={(event) => props.onSetNewTagName(event.target.value)}
        />
        <input
          aria-label="标签颜色"
          className="color-input"
          type="color"
          value={props.newTagColor}
          onChange={(event) => props.onSetNewTagColor(event.target.value)}
        />
        <button className="secondary-button" disabled={props.isSavingTag || props.newTagName.trim().length === 0} type="submit">
          新建标签
        </button>
      </form>

      {props.tags.length > 0 ? (
        <details className="tag-admin">
          <summary>管理标签</summary>
          <div>
            {props.tags.map((tag) => (
              <span key={tag.id} className="tag-admin-row">
                <span>{tag.name}</span>
                <button type="button" onClick={() => props.onRenameTag(tag)}>重命名</button>
                <button type="button" onClick={() => props.onDeleteTag(tag)}>删除</button>
              </span>
            ))}
          </div>
        </details>
      ) : null}

      <label className="field-group" htmlFor="note-markdown">
        <span>Markdown 笔记</span>
        <textarea
          id="note-markdown"
          value={props.noteDraft}
          placeholder="记录这个项目适合解决什么问题、关键 API、使用注意事项或后续阅读计划。"
          onChange={(event) => props.onSetNoteDraft(event.target.value)}
        />
      </label>

      <button className="primary-button" disabled={props.isSavingAnnotation || props.isLoadingAnnotation} type="button" onClick={props.onSaveAnnotation}>
        {props.isSavingAnnotation ? '正在保存…' : '保存笔记'}
      </button>
    </aside>
  );
}

function optionalRequestText(value: string) {
  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('zh-CN');
}

function AuthBadge(props: { authState: GitHubAuthState }) {
  if (props.authState.user) {
    return <span className="auth-badge connected">已连接</span>;
  }

  if (props.authState.hasToken) {
    return <span className="auth-badge warning">需要重新验证</span>;
  }

  return <span className="auth-badge">未连接</span>;
}

function GitHubAccountCard(props: {
  authState: GitHubAuthState;
  isClearingToken: boolean;
  onClearToken: () => void;
}) {
  const { authState } = props;

  if (!authState.user) {
    return (
      <article className="account-card empty">
        <strong>等待连接</strong>
        <p>连接后会在这里展示 GitHub 用户信息，并作为后续 Stars 同步的账号来源。</p>
      </article>
    );
  }

  return (
    <article className="account-card">
      {authState.user.avatarUrl ? <img src={authState.user.avatarUrl} alt="" /> : null}
      <div>
        <span>当前 GitHub 用户</span>
        <strong>{authState.user.name ?? authState.user.login}</strong>
        <a href={authState.user.htmlUrl} target="_blank" rel="noreferrer">
          @{authState.user.login}
        </a>
      </div>
      <button className="secondary-button" disabled={props.isClearingToken} onClick={props.onClearToken} type="button">
        {props.isClearingToken ? '正在移除…' : '移除连接'}
      </button>
    </article>
  );
}