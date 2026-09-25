import type {
  AppToPickerMessage,
  PickedElement,
  PickerToAppMessage,
  Project,
} from '@uplift/shared';
import { AlertTriangle, Loader2, MousePointerClick, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  snapshotDocumentUrl,
  snapshotErrorReason,
  useCaptureSnapshot,
  useSnapshot,
} from '@/features/snapshots/api';
import { displayUrl, formatRelative } from '@/lib/format';

/**
 * Shows a rendered copy of the project's page in a sandboxed iframe and lets the user click the
 * element to optimize. The iframe has an opaque origin; it only talks to us through postMessage.
 */
export function PagePickerDialog({
  project,
  open,
  onOpenChange,
  existingSelectors,
  onPick,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSelectors: string[];
  onPick: (element: PickedElement) => void;
}) {
  const { t, i18n } = useTranslation();
  const snapshot = useSnapshot(project.id, open);
  const capture = useCaptureSnapshot(project.id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // The overlay stays until both the picker script has started and the page has finished painting.
  const [frameReady, setFrameReady] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);

  // First time: there is no snapshot yet, so render the page right away.
  const { mutate: captureNow, isIdle } = capture;
  useEffect(() => {
    if (open && snapshot.data === null && isIdle) captureNow();
  }, [open, snapshot.data, isIdle, captureNow]);

  const current = snapshot.data;
  const documentUrl = current ? snapshotDocumentUrl(current) : null;

  // A new document (or reopening the dialog) means a new iframe and picker, which start over.
  const frameKey = open ? documentUrl : null;
  const [shownKey, setShownKey] = useState(frameKey);
  if (shownKey !== frameKey) {
    setShownKey(frameKey);
    setFrameReady(false);
    setFrameLoaded(false);
  }

  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      // The sandboxed frame's origin is "null", so the only trustworthy check is the sender window.
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as PickerToAppMessage;
      if (data?.source !== 'uplift-picker') return;
      if (data.type === 'ready') setFrameReady(true);
      else if (data.type === 'pick') onPick(data.element);
      else if (data.type === 'cancel') onOpenChange(false);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, onPick, onOpenChange]);

  // Outline the elements that are already part of the project.
  const selectorsKey = existingSelectors.join('\n');
  useEffect(() => {
    if (!frameReady) return;
    const message: AppToPickerMessage = {
      source: 'uplift-app',
      type: 'highlight',
      selectors: selectorsKey ? selectorsKey.split('\n') : [],
    };
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, [frameReady, selectorsKey]);

  const capturing = capture.isPending;
  const failed = capture.isError && !capturing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 sm:max-w-[calc(100vw-4rem)]">
        <DialogHeader className="flex-row flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 pr-12 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-2">
              <MousePointerClick className="size-4 text-primary" aria-hidden="true" />
              {t('picker.title')}
            </DialogTitle>
            <DialogDescription className="truncate">{t('picker.description')}</DialogDescription>
          </div>
          {current && (
            <p className="text-xs text-muted-foreground">
              {displayUrl(current.finalUrl)} ·{' '}
              {t('picker.capturedAt', {
                when: formatRelative(current.createdAt, i18n.resolvedLanguage ?? 'en'),
              })}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => capture.mutate()}
            disabled={capturing || snapshot.isPending}
          >
            <RefreshCw className={capturing ? 'animate-spin' : undefined} />
            {t('picker.refresh')}
          </Button>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-muted/40">
          {documentUrl && (
            <iframe
              key={documentUrl}
              ref={iframeRef}
              src={documentUrl}
              title={t('picker.frameTitle', { url: displayUrl(project.url) })}
              // No allow-same-origin: the page's HTML must never run with the app's origin.
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              onLoad={() => setFrameLoaded(true)}
              className="size-full border-0 bg-white"
            />
          )}

          {(capturing ||
            snapshot.isPending ||
            (documentUrl && !(frameReady && frameLoaded) && !failed)) && (
            <div
              className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              <div className="grid max-w-sm justify-items-center gap-3 px-6 text-center">
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
                <p className="font-medium">
                  {capturing ? t('picker.capturing') : t('picker.loading')}
                </p>
                {capturing && (
                  <p className="text-sm text-muted-foreground">{t('picker.capturingHint')}</p>
                )}
              </div>
            </div>
          )}

          {failed && !current && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid max-w-md justify-items-center gap-3 px-6 text-center">
                <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
                <p className="font-medium">{t('picker.failedTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`picker.errors.${snapshotErrorReason(capture.error)}`)}
                </p>
                <Button variant="outline" onClick={() => capture.mutate()}>
                  {t('common.retry')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {failed && current && (
          <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">
            {t('picker.refreshFailed')} {t(`picker.errors.${snapshotErrorReason(capture.error)}`)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
