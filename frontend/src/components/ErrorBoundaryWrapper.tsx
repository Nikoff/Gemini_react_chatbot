import { ErrorBoundary } from './ErrorBoundary';
import { useI18n } from '../context/I18nContext';

export function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return <ErrorBoundary t={t}>{children}</ErrorBoundary>;
}
