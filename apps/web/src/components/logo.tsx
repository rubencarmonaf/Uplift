import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 24 24" className="size-6 text-primary" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="currentColor" />
        <path
          d="M6 16.5 10.5 12l3 3L18 8.5M18 8.5h-4M18 8.5v4"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg">Uplift</span>
    </span>
  );
}
