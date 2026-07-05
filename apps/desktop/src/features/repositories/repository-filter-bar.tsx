import { FormEvent, useEffect, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { emptyRepositoryFilters } from '@/lib/repository';
import type { RepositoryFilters, TagItem } from '@/types';

type RepositoryFilterBarProps = {
  filters: RepositoryFilters;
  isLoading: boolean;
  languages: string[];
  tags: TagItem[];
  onApplyFilters: (filters: RepositoryFilters) => void;
  onResetFilters: () => void;
};

export function RepositoryFilterBar(props: RepositoryFilterBarProps) {
  const [draftFilters, setDraftFilters] = useState<RepositoryFilters>(props.filters);
  const hasActiveFilters = Boolean(props.filters.keyword || props.filters.language || props.filters.tagId);

  useEffect(() => {
    setDraftFilters(props.filters);
  }, [props.filters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onApplyFilters(draftFilters);
  }

  function handleReset() {
    setDraftFilters(emptyRepositoryFilters);
    props.onResetFilters();
  }

  return (
    <form className="flex flex-wrap items-center gap-3" onSubmit={handleSubmit}>
      <div className="relative min-w-0 flex-[1_1_260px]">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-10 rounded-lg pl-10 pr-12 shadow-sm transition-shadow focus-visible:shadow-md"
          value={draftFilters.keyword}
          placeholder="搜索名称、描述、Topics、笔记"
          onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value }))}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
          ⌘K
        </kbd>
      </div>

      <Select value={draftFilters.language || 'all'} onValueChange={(value) => setDraftFilters((current) => ({ ...current, language: value === 'all' ? '' : value }))}>
        <SelectTrigger className="h-10 w-full min-w-[140px] sm:w-40 rounded-lg shadow-sm">
          <SelectValue placeholder="全部语言" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部语言</SelectItem>
          {props.languages.map((language) => (
            <SelectItem key={language} value={language}>{language}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={draftFilters.tagId || 'all'} onValueChange={(value) => setDraftFilters((current) => ({ ...current, tagId: value === 'all' ? '' : value }))}>
        <SelectTrigger className="h-10 w-full min-w-[140px] sm:w-40 rounded-lg shadow-sm">
          <SelectValue placeholder="全部标签" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部标签</SelectItem>
          {props.tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button className="h-10 rounded-lg shadow-sm" disabled={props.isLoading} type="submit">
        <Search className="size-4" />
        {props.isLoading ? '搜索中' : '搜索'}
      </Button>
      <Button className="h-10 rounded-lg shadow-sm" disabled={props.isLoading || !hasActiveFilters} type="button" variant="outline" onClick={handleReset}>
        <Filter className="size-4" />
        重置
      </Button>
    </form>
  );
}
