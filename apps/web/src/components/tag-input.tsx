import { X } from 'lucide-react';
import { type ClipboardEvent, type KeyboardEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * A list of short texts edited as chips. Enter (or a comma, when `splitOnComma`) adds the typed
 * value; pasting several lines adds one chip per line; Backspace on an empty input removes the last.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  maxItems,
  maxLength = 300,
  splitOnComma = false,
  disabled,
  'aria-describedby': describedBy,
}: {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  maxLength?: number;
  splitOnComma?: boolean;
  disabled?: boolean;
  'aria-describedby'?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const hintId = useId();
  const full = maxItems !== undefined && value.length >= maxItems;

  const add = (raw: string[]) => {
    const existing = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const item of raw.map((r) => r.trim().slice(0, maxLength)).filter(Boolean)) {
      if (maxItems !== undefined && next.length >= maxItems) break;
      if (existing.has(item.toLowerCase())) continue;
      existing.add(item.toLowerCase());
      next.push(item);
    }
    if (next.length !== value.length) onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || (splitOnComma && event.key === ',')) {
      event.preventDefault();
      add([draft]);
      setDraft('');
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    const parts = pasted.split(splitOnComma ? /[\n,]/ : /\n/);
    if (parts.length < 2) return;
    event.preventDefault();
    add(parts);
  };

  return (
    <div
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {value.length > 0 && (
        <ul className="contents">
          {value.map((item, index) => (
            <li
              key={item}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-2 text-secondary-foreground"
            >
              <span className="truncate">{item}</span>
              <button
                type="button"
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={t('tagInput.remove', { item })}
                disabled={disabled}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (draft.trim()) {
            add([draft]);
            setDraft('');
          }
        }}
        placeholder={full ? t('tagInput.full') : placeholder}
        disabled={disabled || full}
        maxLength={maxLength}
        aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
        className="min-w-40 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground"
      />
      <span id={hintId} className="sr-only">
        {t('tagInput.hint')}
      </span>
    </div>
  );
}
