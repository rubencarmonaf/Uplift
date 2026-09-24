import { useTranslation } from 'react-i18next';
import { PageHeader } from './page-header';

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return <PageHeader title={t(titleKey)} description={t('comingSoon')} />;
}
