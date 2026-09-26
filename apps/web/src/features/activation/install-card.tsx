import type { Experiment } from '@uplift/shared';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { installCode } from './install-code';

export function InstallCard({ experiment }: { experiment: Experiment }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const code = installCode(experiment);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); the code stays selectable.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('activation.install.title')}</CardTitle>
        <CardDescription>{t('activation.install.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 pr-12 font-mono text-xs leading-relaxed">
            <code>{code}</code>
          </pre>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            onClick={copy}
            aria-label={t('activation.install.copy')}
          >
            {copied ? <Check className="text-primary" /> : <Copy />}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={experiment.testPageUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink />
              {t('activation.install.testPage')}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">{t('activation.install.testPageHint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
