import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string; description?: string };

const chipClass = (selected: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
    selected
      ? 'border-primary bg-primary/10 text-foreground'
      : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
  );

/** Pick one option. Clicking the selected option again clears it (every brief field is optional). */
export function SingleChoice({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  legend: string;
  options: readonly Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label key={option.value} className={chipClass(selected)} title={option.description}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                onClick={() => selected && onChange(null)}
                className="sr-only"
              />
              {selected && <Check className="size-3.5 text-primary" aria-hidden="true" />}
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Pick up to `max` options. */
export function MultiChoice({
  legend,
  hint,
  options,
  value,
  onChange,
  max,
  disabled,
}: {
  legend: string;
  hint?: string;
  options: readonly Option[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const full = max !== undefined && value.length >= max;
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(chipClass(selected), full && !selected && 'opacity-50')}
              title={option.description}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={full && !selected}
                onChange={() =>
                  onChange(
                    selected ? value.filter((v) => v !== option.value) : [...value, option.value],
                  )
                }
                className="sr-only"
              />
              {selected && <Check className="size-3.5 text-primary" aria-hidden="true" />}
              {option.label}
            </label>
          );
        })}
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}
