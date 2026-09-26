import {
  ELEMENT_KINDS,
  type ElementKind,
  type LibraryItem,
  type LibraryQuery,
} from '@uplift/shared';
import {
  Bookmark,
  Check,
  Copy,
  CornerDownRight,
  Library,
  Search,
  SearchX,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageTitle } from '@/components/page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrg } from '@/features/organizations/use-current-org';
import { signedPercent } from '@/features/results/format';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLibrary } from './api';
import { UseInProjectDialog } from './use-in-project-dialog';

const ALL = 'all';
type Source = NonNullable<LibraryQuery['source']> | typeof ALL;

export function LibraryPage() {
  const { t } = useTranslation();
  const org = useCurrentOrg();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ElementKind | typeof ALL>(ALL);
  const [source, setSource] = useState<Source>(ALL);
  const [using, setUsing] = useState<LibraryItem | null>(null);
  const q = useDebouncedValue(search.trim());

  const {
    data: items,
    isPending,
    isError,
  } = useLibrary(org.id, {
    q: q || undefined,
    type: type === ALL ? undefined : type,
    source: source === ALL ? undefined : source,
  });
  const filtered = !!q || type !== ALL || source !== ALL;

  return (
    <>
      <PageTitle title={t('library.title')} description={t('library.description')} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('library.search')}
            aria-label={t('library.search')}
            className="pl-8"
          />
        </div>
        <div
          className="flex rounded-lg bg-muted p-1"
          role="radiogroup"
          aria-label={t('library.source')}
        >
          {(['all', 'winner', 'saved'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={source === value}
              onClick={() => setSource(value)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors',
                source === value && 'bg-background text-foreground shadow-sm',
              )}
            >
              {t(`library.sources.${value}`)}
            </button>
          ))}
        </div>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="w-44" aria-label={t('elements.fields.type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('library.allTypes')}</SelectItem>
            {ELEMENT_KINDS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`elements.types.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p>{t('common.errors.loadFailed')}</p>
      ) : items.length === 0 ? (
        <section className="grid place-items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <div className="grid max-w-sm justify-items-center gap-3">
            {filtered ? (
              <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Library className="size-8 text-muted-foreground" aria-hidden="true" />
            )}
            <h2 className="text-lg font-medium">
              {t(filtered ? 'library.noResults' : 'library.empty.title')}
            </h2>
            {!filtered && (
              <p className="text-sm text-muted-foreground">{t('library.empty.description')}</p>
            )}
          </div>
        </section>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <LibraryCard
              key={item.variantId}
              item={item}
              canUse={org.canEdit}
              onUse={() => setUsing(item)}
            />
          ))}
        </ul>
      )}

      <UseInProjectDialog item={using} onOpenChange={(open) => !open && setUsing(null)} />
    </>
  );
}

function LibraryCard({
  item,
  canUse,
  onUse,
}: {
  item: LibraryItem;
  canUse: boolean;
  onUse: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; the text is still selectable.
    }
  };

  return (
    <li className="grid content-between gap-3 rounded-xl border bg-card p-4">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {item.source === 'winner' ? (
            <Badge className="gap-1">
              <Trophy className="size-3" aria-hidden="true" />
              {t('library.winner')}
              {item.lift != null && ` ${signedPercent(item.lift, locale, 0)}`}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Bookmark className="size-3" aria-hidden="true" />
              {t('library.saved')}
            </Badge>
          )}
          <Badge variant="outline">{t(`elements.types.${item.elementKind}`)}</Badge>
          {item.approach && (
            <Badge variant="outline">{t(`variants.approaches.${item.approach}`)}</Badge>
          )}
        </div>
        <p className="text-base font-medium">{item.text}</p>
        <p className="text-xs text-muted-foreground">
          {t('library.replaced')}: <span className="italic">{item.originalText}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          <Link to={`/projects/${item.project.id}`} className="hover:underline">
            {item.project.name}
          </Link>{' '}
          · {item.elementName} · {formatRelative(item.date, locale)}
        </p>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <Check className="text-primary" /> : <Copy />}
          {t(copied ? 'library.copied' : 'library.copy')}
        </Button>
        {canUse && (
          <Button variant="ghost" size="sm" onClick={onUse}>
            <CornerDownRight />
            {t('library.useInProject')}
          </Button>
        )}
      </div>
    </li>
  );
}
