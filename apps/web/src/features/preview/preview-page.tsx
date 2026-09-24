import type { PageElement, Variant } from '@uplift/shared';
import {
  AlertTriangle,
  Loader2,
  Monitor,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Smartphone,
  Sparkles,
  Tablet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useElements } from '@/features/elements/api';
import { useProjectContext } from '@/features/projects/project-steps';
import {
  snapshotDocumentUrl,
  snapshotErrorReason,
  useCaptureSnapshot,
  useSnapshot,
} from '@/features/snapshots/api';
import { useLatestGeneration, useVariants } from '@/features/variants/api';
import { displayUrl, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const VIEWPORTS = {
  desktop: { width: null, icon: Monitor },
  tablet: { width: 768, icon: Tablet },
  mobile: { width: 390, icon: Smartphone },
} as const;
type Viewport = keyof typeof VIEWPORTS;

const ORIGINAL = 'original';
type Selection = Record<string, string>; // elementId → variantId | ORIGINAL

/** The variant most likely to win: compliant first, then highest quality score. */
function bestVariant(variants: Variant[]) {
  return [...variants].sort(
    (a, b) =>
      Number(b.issues.length === 0) - Number(a.issues.length === 0) ||
      (b.qualityScore ?? 0) - (a.qualityScore ?? 0),
  )[0];
}

export function PreviewPage() {
  const { t, i18n } = useTranslation();
  const { project } = useProjectContext();
  const elements = useElements(project.id);
  const job = useLatestGeneration(project.id);
  const variants = useVariants(project.id, job.data);
  const snapshot = useSnapshot(project.id);
  const capture = useCaptureSnapshot(project.id);

  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [hideConsent, setHideConsent] = useState(true);
  const [selection, setSelection] = useState<Selection>({});
  const [missing, setMissing] = useState<string[]>([]);
  // Covered until the preview script is ready and the page has finished painting.
  const [frameReady, setFrameReady] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeByElement = useMemo(() => {
    const map = new Map<string, Variant[]>();
    for (const v of variants.data ?? []) {
      if (v.status === 'active') map.set(v.elementId, [...(map.get(v.elementId) ?? []), v]);
    }
    return map;
  }, [variants.data]);

  const changes = useMemo(
    () =>
      (elements.data ?? []).map((element) => {
        const chosen = selection[element.id];
        const variant = activeByElement.get(element.id)?.find((v) => v.id === chosen);
        return { selector: element.selector, text: variant?.text ?? null };
      }),
    [elements.data, selection, activeByElement],
  );

  const documentUrl = snapshot.data ? snapshotDocumentUrl(snapshot.data, 'preview') : null;
  const [shownUrl, setShownUrl] = useState(documentUrl);
  if (shownUrl !== documentUrl) {
    setShownUrl(documentUrl);
    setFrameReady(false);
    setFrameLoaded(false);
  }

  const send = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'uplift-app', type: 'preview:apply', changes, hideConsent },
      '*',
    );
  }, [changes, hideConsent]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { source?: string; type?: string; missing?: string[] };
      if (data?.source !== 'uplift-preview') return;
      if (data.type === 'preview:ready') setFrameReady(true);
      if (data.type === 'preview:applied') setMissing(data.missing ?? []);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (frameReady) send();
  }, [frameReady, send]);

  const setAll = (pick: (element: PageElement, variants: Variant[]) => Variant | undefined) =>
    setSelection(
      Object.fromEntries(
        (elements.data ?? []).map((element) => {
          const chosen = pick(element, activeByElement.get(element.id) ?? []);
          return [element.id, chosen?.id ?? ORIGINAL];
        }),
      ),
    );

  if (elements.isPending || variants.isPending || snapshot.isPending) {
    return <Skeleton className="h-[70svh] w-full" />;
  }

  if (!snapshot.data) {
    return (
      <section className="grid place-items-center rounded-xl border border-dashed px-6 py-14 text-center">
        <div className="grid max-w-sm justify-items-center gap-3">
          <Monitor className="size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-medium">{t('preview.noSnapshot.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('preview.noSnapshot.description')}</p>
          <Button onClick={() => capture.mutate()} disabled={capture.isPending}>
            {capture.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t(capture.isPending ? 'picker.capturing' : 'preview.noSnapshot.cta')}
          </Button>
          {capture.isError && (
            <p className="text-sm text-destructive">
              {t(`picker.errors.${snapshotErrorReason(capture.error)}`)}
            </p>
          )}
        </div>
      </section>
    );
  }

  const elementList = elements.data ?? [];
  const width = VIEWPORTS[viewport].width;

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-5 rounded-xl border p-4">
        <div className="grid gap-2">
          <span className="text-sm font-medium" id="viewport-label">
            {t('preview.viewport')}
          </span>
          <div
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
            role="radiogroup"
            aria-labelledby="viewport-label"
          >
            {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => {
              const Icon = VIEWPORTS[key].icon;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={viewport === key}
                  onClick={() => setViewport(key)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-muted-foreground transition-colors',
                    viewport === key && 'bg-background text-foreground shadow-sm',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t(`preview.viewports.${key}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="hide-consent" className="text-sm">
            {t('preview.hideConsent')}
          </Label>
          <Switch id="hide-consent" checked={hideConsent} onCheckedChange={setHideConsent} />
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('preview.elements')}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => setAll(() => undefined)}>
              <RotateCcw />
              {t('preview.allOriginal')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAll((_, vs) => bestVariant(vs))}>
              <Sparkles />
              {t('preview.best')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAll((_, vs) => vs[Math.floor(Math.random() * (vs.length + 1))])}
            >
              <Shuffle />
              {t('preview.random')}
            </Button>
          </div>

          {elementList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('preview.noElements')}{' '}
              <Link to="../elements" relative="path" className="underline underline-offset-4">
                {t('variants.noElements.cta')}
              </Link>
            </p>
          ) : (
            elementList.map((element) => {
              const options = activeByElement.get(element.id) ?? [];
              const notFound = missing.includes(element.selector);
              return (
                <div key={element.id} className="grid gap-1.5">
                  <Label
                    htmlFor={`preview-${element.id}`}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    {element.name}
                    {notFound && (
                      <AlertTriangle
                        className="size-3.5 text-amber-600 dark:text-amber-400"
                        aria-label={t('preview.notFound')}
                      />
                    )}
                  </Label>
                  <Select
                    value={selection[element.id] ?? ORIGINAL}
                    onValueChange={(value) => setSelection((s) => ({ ...s, [element.id]: value }))}
                  >
                    <SelectTrigger id={`preview-${element.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ORIGINAL}>
                        {t('preview.original')}: {element.originalText.slice(0, 40)}
                      </SelectItem>
                      {options.map((v, i) => (
                        <SelectItem key={v.id} value={v.id}>
                          {i + 1}. {v.text.slice(0, 48)}
                          {v.text.length > 48 ? '…' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {notFound && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {t('preview.notFoundHint')}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="grid gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span>
            {displayUrl(snapshot.data.finalUrl)} ·{' '}
            {t('picker.capturedAt', {
              when: formatRelative(snapshot.data.createdAt, i18n.resolvedLanguage ?? 'en'),
            })}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="justify-start"
            onClick={() => capture.mutate()}
            disabled={capture.isPending}
          >
            <RefreshCw className={capture.isPending ? 'animate-spin' : undefined} />
            {t('picker.refresh')}
          </Button>
        </div>
      </aside>

      <div className="relative flex min-h-[75svh] items-start justify-center overflow-auto rounded-xl border bg-muted/40 p-3">
        {documentUrl && (
          <iframe
            key={documentUrl}
            ref={iframeRef}
            src={documentUrl}
            title={t('preview.frameTitle', { url: displayUrl(project.url) })}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            onLoad={() => setFrameLoaded(true)}
            className="h-[72svh] shrink-0 rounded-lg border bg-white shadow-sm transition-[width] duration-300"
            style={{ width: width ? `${width}px` : '100%', maxWidth: '100%' }}
          />
        )}
        {(!frameReady || !frameLoaded || capture.isPending) && (
          <div className="absolute inset-0 grid place-items-center bg-background/70" role="status">
            <Loader2
              className="size-7 animate-spin text-primary"
              aria-label={t('picker.loading')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
