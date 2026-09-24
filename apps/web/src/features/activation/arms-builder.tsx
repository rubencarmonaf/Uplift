import { type Arm, MAX_ARMS, type PageElement, type Variant } from '@uplift/shared';
import { Plus, Scale, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ORIGINAL = 'original';
const LETTERS = 'ABCD';

/**
 * Elements × arms grid. Each non-control arm picks, per element, a variant or the original copy;
 * weights split the experiment traffic between arms.
 */
export function ArmsBuilder({
  arms,
  onChange,
  elements,
  variantsByElement,
  disabled,
}: {
  arms: Arm[];
  onChange: (arms: Arm[]) => void;
  elements: PageElement[];
  variantsByElement: Map<string, Variant[]>;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const totalWeight = arms.reduce((sum, a) => sum + a.weight, 0);

  const updateArm = (id: string, patch: Partial<Arm>) =>
    onChange(arms.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const setVariant = (arm: Arm, elementId: string, variantId: string) => {
    const others = arm.changes.filter((c) => c.elementId !== elementId);
    updateArm(arm.id, {
      changes: variantId === ORIGINAL ? others : [...others, { elementId, variantId }],
    });
  };

  const addArm = () => {
    const nonControl = arms.filter((a) => !a.isControl).length;
    onChange([
      ...arms,
      {
        id: crypto.randomUUID(),
        name: t('activation.armName', { letter: LETTERS[nonControl] ?? nonControl + 1 }),
        weight: Math.round(100 / (arms.length + 1)),
        isControl: false,
        changes: [],
      },
    ]);
  };

  const splitEvenly = () => {
    const base = Math.floor(100 / arms.length);
    onChange(arms.map((a, i) => ({ ...a, weight: base + (i < 100 - base * arms.length ? 1 : 0) })));
  };

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="w-48 px-3 py-2 text-left font-medium">
                {t('activation.arms.element')}
              </th>
              {arms.map((arm) => (
                <th key={arm.id} scope="col" className="px-3 py-2 text-left font-medium">
                  <div className="flex items-center gap-1">
                    {arm.isControl ? (
                      <span>{t('activation.arms.control')}</span>
                    ) : (
                      <Input
                        value={arm.name}
                        onChange={(e) => updateArm(arm.id, { name: e.target.value.slice(0, 40) })}
                        disabled={disabled}
                        aria-label={t('activation.arms.nameLabel')}
                        className="h-7"
                      />
                    )}
                    {!arm.isControl && !disabled && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onChange(arms.filter((a) => a.id !== arm.id))}
                        disabled={arms.length <= 2}
                        aria-label={t('activation.arms.remove', { name: arm.name })}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {elements.map((element) => {
              const options = variantsByElement.get(element.id) ?? [];
              return (
                <tr key={element.id} className="border-b last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left align-top font-normal">
                    <span className="block font-medium">{element.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {element.originalText}
                    </span>
                  </th>
                  {arms.map((arm) => {
                    if (arm.isControl) {
                      return (
                        <td key={arm.id} className="px-3 py-2 align-top text-muted-foreground">
                          {t('preview.original')}
                        </td>
                      );
                    }
                    const chosen = arm.changes.find((c) => c.elementId === element.id)?.variantId;
                    return (
                      <td key={arm.id} className="px-3 py-2 align-top">
                        <Select
                          value={chosen ?? ORIGINAL}
                          onValueChange={(v) => setVariant(arm, element.id, v)}
                          disabled={disabled}
                        >
                          <SelectTrigger
                            className={cn('w-full', chosen && 'border-primary/50')}
                            aria-label={t('activation.arms.cellLabel', {
                              arm: arm.name,
                              element: element.name,
                            })}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ORIGINAL}>{t('preview.original')}</SelectItem>
                            {options.map((v, i) => (
                              <SelectItem key={v.id} value={v.id}>
                                {i + 1}. {v.text.slice(0, 50)}
                                {v.text.length > 50 ? '…' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="bg-muted/20">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {t('activation.arms.traffic')}
              </th>
              {arms.map((arm) => (
                <td key={arm.id} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={arm.weight}
                      onChange={(e) =>
                        updateArm(arm.id, {
                          weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        })
                      }
                      disabled={disabled}
                      className="h-8 w-20"
                      aria-label={t('activation.arms.weightLabel', { name: arm.name })}
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {totalWeight > 0 ? Math.round((arm.weight / totalWeight) * 100) : 0}%
                    </span>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addArm} disabled={arms.length >= MAX_ARMS}>
            <Plus />
            {t('activation.arms.add')}
          </Button>
          <Button variant="outline" size="sm" onClick={splitEvenly}>
            <Scale />
            {t('activation.arms.split')}
          </Button>
        </div>
      )}
    </div>
  );
}
