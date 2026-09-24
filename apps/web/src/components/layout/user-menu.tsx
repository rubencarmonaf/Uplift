import { Check, Languages, LogOut, SunMoon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout, useMe } from '@/features/auth/api';
import { LOCALES, setLocale } from '@/lib/i18n';

const THEMES = ['light', 'dark', 'system'] as const;
const LOCALE_NAMES = { es: 'Español', en: 'English' } as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={me.user.name}>
          <Avatar className="size-8">
            <AvatarFallback>{initials(me.user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{me.user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {me.user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages />
            {t('user.language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LOCALES.map((locale) => (
              <DropdownMenuItem key={locale} onSelect={() => setLocale(locale)}>
                {LOCALE_NAMES[locale]}
                {i18n.resolvedLanguage === locale && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunMoon />
            {t('user.theme')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEMES.map((value) => (
              <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                {t(`user.themes.${value}`)}
                {theme === value && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            logout.mutate(undefined, {
              onSettled: () => void navigate('/login', { replace: true }),
            })
          }
        >
          <LogOut />
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
