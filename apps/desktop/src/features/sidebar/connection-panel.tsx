import { FormEvent } from 'react';
import { GitBranch, KeyRound, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GitHubAuthState } from '@/types';

type ConnectionPanelProps = {
  authState: GitHubAuthState;
  isClearingToken: boolean;
  isSavingToken: boolean;
  token: string;
  onClearToken: () => void;
  onSaveToken: (event: FormEvent<HTMLFormElement>) => void;
  onSetToken: (value: string) => void;
};

export function ConnectionPanel(props: ConnectionPanelProps) {
  return (
    <section className="rail-section">
      <div className="rail-title">
        <GitBranch className="size-4" />
        <strong>GitHub</strong>
      </div>
      {props.authState.user ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <Avatar className="size-11 rounded-lg ring-2 ring-background">
              <AvatarImage src={props.authState.user.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-lg bg-primary/10"><UserRound className="size-5 text-primary" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-semibold">{props.authState.user.name ?? props.authState.user.login}</strong>
              <a className="text-xs text-muted-foreground transition-colors hover:text-primary hover:underline" href={props.authState.user.htmlUrl} target="_blank" rel="noreferrer">
                @{props.authState.user.login}
              </a>
            </div>
          </div>
          <Button className="h-10 rounded-lg shadow-sm" disabled={props.isClearingToken} variant="outline" onClick={props.onClearToken}>
            {props.isClearingToken ? '移除中…' : '移除连接'}
          </Button>
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={props.onSaveToken}>
          <label className="grid gap-2.5 text-xs font-semibold text-foreground" htmlFor="github-token">
            Personal Access Token
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="github-token"
                className="h-10 rounded-lg pl-10 shadow-sm"
                value={props.token}
                type="password"
                autoComplete="off"
                placeholder="粘贴 GitHub Token"
                onChange={(event) => props.onSetToken(event.target.value)}
              />
            </div>
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">Token 仅用于本地验证和 GitHub API 请求，保存在系统 Keychain。</p>
          <Button className="h-10 rounded-lg shadow-sm" disabled={props.isSavingToken || props.token.trim().length === 0} type="submit">
            {props.isSavingToken ? '验证中…' : '连接账号'}
          </Button>
        </form>
      )}
    </section>
  );
}
