import { useMe } from '@/features/auth/api';

/**
 * The organization the user is working in. Every user has exactly one for now;
 * an organization switcher can replace this later without touching callers.
 */
export function useCurrentOrg() {
  const { data: me } = useMe();
  const org = me?.organizations[0];
  if (!org) throw new Error('useCurrentOrg used outside an authenticated route');
  return { ...org, canEdit: org.role !== 'viewer' };
}
