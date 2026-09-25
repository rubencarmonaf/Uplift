import type { TFunction } from 'i18next';
import { ApiError } from '@/lib/api';

export function authErrorMessage(err: unknown, t: TFunction) {
  if (err instanceof ApiError) {
    if (err.status === 401) return t('auth.errors.invalidCredentials');
    if (err.status === 409) return t('auth.errors.emailTaken');
    if (err.status === 429) return t('auth.errors.tooManyAttempts');
  }
  return t('auth.errors.generic');
}
