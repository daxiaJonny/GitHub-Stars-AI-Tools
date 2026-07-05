import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/app-layout';
import { DashboardPage } from '@/pages/dashboard';
import { RepositoriesPage } from '@/pages/repositories';
import { TagNetworkPage } from '@/pages/tag-network';
import { AISearchPage } from '@/pages/ai-search';
import { ProfilePage } from '@/pages/profile';
import { SettingsPage } from '@/pages/settings';
import { WelcomeFlow } from '@/components/welcome-flow';
import { WorkspaceProvider, useWorkspace } from '@/providers/workspace-provider';
import { SettingsProvider, useAppSettings } from '@/providers/settings-provider';
import type { RepositoryListItem } from '@/types';

type Page = 'dashboard' | 'repositories' | 'tag-network' | 'ai-search' | 'profile' | 'settings';

type RepositoryNavigationState = {
  query: string;
  language: string;
  tagId: string;
  selectedRepositoryId: string | null;
  key: number;
};

function AppContent() {
  const workspace = useWorkspace();
  const settingsHook = useAppSettings();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [showWelcome, setShowWelcome] = useState(false);
  const [repositoryNavigation, setRepositoryNavigation] = useState<RepositoryNavigationState>({
    query: '',
    language: '',
    tagId: '',
    selectedRepositoryId: null,
    key: 0,
  });
  const isWelcomeDecisionPending = settingsHook.isLoading || workspace.isLoadingAuth;
  const hasTriggeredAutoSyncRef = useRef(false);
  const autoSyncAccountIdRef = useRef<string | null>(null);
  const isSyncingStarsRef = useRef(false);

  useEffect(() => {
    isSyncingStarsRef.current = workspace.isSyncingStars;
  }, [workspace.isSyncingStars]);

  // 检查是否需要显示欢迎流程
  useEffect(() => {
    if (isWelcomeDecisionPending || showWelcome) {
      return;
    }

    if (!workspace.authState.user && settingsHook.settings.general.showWelcomeOnStartup) {
      setShowWelcome(true);
    }
  }, [isWelcomeDecisionPending, showWelcome, workspace.authState.user, settingsHook.settings.general.showWelcomeOnStartup]);

  useEffect(() => {
    const accountId = workspace.authState.user ? String(workspace.authState.user.id) : null;
    if (autoSyncAccountIdRef.current !== accountId) {
      autoSyncAccountIdRef.current = accountId;
      hasTriggeredAutoSyncRef.current = false;
    }

    if (
      settingsHook.isLoading ||
      workspace.isLoadingAuth ||
      showWelcome ||
      !settingsHook.settings.sync.enableAutoSync ||
      !accountId
    ) {
      return;
    }

    const runAutoSync = () => {
      if (isSyncingStarsRef.current) {
        return;
      }

      void workspace.handleSyncStars();
    };

    if (!hasTriggeredAutoSyncRef.current) {
      hasTriggeredAutoSyncRef.current = true;
      runAutoSync();
    }

    const intervalMinutes = normalizeAutoSyncInterval(settingsHook.settings.sync.autoSyncInterval);
    const timer = window.setInterval(runAutoSync, intervalMinutes * 60_000);

    return () => window.clearInterval(timer);
  }, [
    settingsHook.isLoading,
    settingsHook.settings.sync.enableAutoSync,
    settingsHook.settings.sync.autoSyncInterval,
    workspace.isLoadingAuth,
    workspace.authState.user?.id,
    showWelcome,
  ]);

  async function handleWelcomeComplete() {
    setShowWelcome(false);
    await settingsHook.updateGeneral({ showWelcomeOnStartup: false });
  }

  async function handleWelcomeConnect(token: string) {
    await workspace.connectWithToken(token);
  }

  function handleGlobalSearch(query: string) {
    setRepositoryNavigation((current) => ({
      query,
      language: '',
      tagId: '',
      selectedRepositoryId: null,
      key: current.key + 1,
    }));
    setCurrentPage('repositories');
  }

  function handleRepositoryLanguageSelect(language: string) {
    setRepositoryNavigation((current) => ({
      query: '',
      language,
      tagId: '',
      selectedRepositoryId: null,
      key: current.key + 1,
    }));
    setCurrentPage('repositories');
  }

  function handleRepositoryTagSelect(tagId: string) {
    setRepositoryNavigation((current) => ({
      query: '',
      language: '',
      tagId,
      selectedRepositoryId: null,
      key: current.key + 1,
    }));
    setCurrentPage('repositories');
  }

  function handleRepositoryOpen(repository: RepositoryListItem) {
    setRepositoryNavigation((current) => ({
      query: repository.fullName,
      language: '',
      tagId: '',
      selectedRepositoryId: repository.id,
      key: current.key + 1,
    }));
    setCurrentPage('repositories');
  }

  if (settingsHook.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        正在加载本地配置...
      </div>
    );
  }

  if (showWelcome) {
    return (
      <WelcomeFlow
        onComplete={handleWelcomeComplete}
        onConnectGitHub={handleWelcomeConnect}
        onSyncStars={() => workspace.handleSyncStars({ throwOnError: true })}
        onFetchReadmes={async () => {
          const summary = await workspace.handleFetchReadmes({
            aiConfig: settingsHook.settings.ai,
            autoGenerateAi: settingsHook.settings.ai.enableAutoSummary,
            aiLimit: 50,
            onlyMissing: true,
          });
          if (!summary) {
            throw new Error('README 缓存失败，请检查网络连接后重试。');
          }
        }}
      />
    );
  }

  // 渲染当前页面
  function renderPage() {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            onOpenRepository={(query) => handleGlobalSearch(query)}
            onSelectLanguage={handleRepositoryLanguageSelect}
          />
        );
      case 'repositories':
        return (
          <RepositoriesPage
            navigationKey={repositoryNavigation.key}
            globalSearchQuery={repositoryNavigation.query}
            globalLanguageFilter={repositoryNavigation.language}
            globalTagFilter={repositoryNavigation.tagId}
            globalSelectedRepositoryId={repositoryNavigation.selectedRepositoryId}
          />
        );
      case 'tag-network':
        return <TagNetworkPage onSelectTag={handleRepositoryTagSelect} />;
      case 'ai-search':
        return <AISearchPage onOpenRepository={handleRepositoryOpen} />;
      case 'profile':
        return <ProfilePage onOpenRepository={handleRepositoryOpen} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            onOpenRepository={handleGlobalSearch}
            onSelectLanguage={handleRepositoryLanguageSelect}
          />
        );
    }
  }

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={workspace.authState.user}
      onSyncStars={workspace.handleSyncStars}
      isSyncing={workspace.isSyncingStars}
      syncSummary={workspace.syncSummary}
      onGlobalSearch={handleGlobalSearch}
      taskProgress={workspace.taskProgress}
    >
      {renderPage()}
    </AppLayout>
  );
}

function normalizeAutoSyncInterval(value: number) {
  if (!Number.isFinite(value)) {
    return 30;
  }

  return Math.min(Math.max(Math.trunc(value), 5), 1440);
}

export function App() {
  return (
    <SettingsProvider>
      <WorkspaceProvider>
        <AppContent />
      </WorkspaceProvider>
    </SettingsProvider>
  );
}
