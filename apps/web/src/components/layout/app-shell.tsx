import { FolderKanban, Library, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { DemoBanner } from './demo-banner';
import { UserMenu } from './user-menu';

const NAV = [
  { to: '/projects', icon: FolderKanban, label: 'nav.projects' },
  { to: '/library', icon: Library, label: 'nav.library' },
  { to: '/settings', icon: Settings, label: 'nav.settings' },
] as const;

export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col">
      <DemoBanner />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="flex shrink-0 items-center gap-1 border-b bg-sidebar px-3 py-2 md:w-60 md:flex-col md:items-stretch md:border-r md:border-b-0 md:px-3 md:py-4">
          <Logo className="mr-auto px-2 md:mr-0 md:mb-6" />
          <nav className="flex gap-1 md:flex-col" aria-label="Main">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="sr-only md:not-sr-only">{t(label)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="md:mt-auto md:px-1">
            <UserMenu />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
