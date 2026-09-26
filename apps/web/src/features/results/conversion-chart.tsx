import type { ExperimentResults } from '@uplift/shared';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { percent, seriesColor } from './format';

type Point = { date: string } & Record<string, number | string | null>;

/**
 * Cumulative conversion rate per arm, one point per day. Lines are 2px, grid and axes recessive,
 * a crosshair tooltip lists every arm; the legend and the table above carry identity too.
 */
export function ConversionChart({ results }: { results: ExperimentResults }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en';

  const data: Point[] = results.series.map((point) => ({
    date: point.date,
    ...Object.fromEntries(
      results.arms.map((arm) => {
        const totals = point.arms[arm.armId];
        return [
          arm.armId,
          totals && totals.visitors > 0 ? totals.conversions / totals.visitors : null,
        ];
      }),
    ),
  }));

  // Round ticks: the top of the axis goes up to a multiple of 4 points so every tick is a whole %.
  const maxRate = Math.max(
    0.01,
    ...data.flatMap((p) =>
      results.arms.map((a) => (typeof p[a.armId] === 'number' ? (p[a.armId] as number) : 0)),
    ),
  );
  const top = Math.ceil((maxRate * 100) / 4) * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => (top * i) / 4 / 100);

  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
      new Date(`${date}T12:00:00`),
    );

  if (data.length < 2) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {t('results.chart.notEnough')}
      </p>
    );
  }

  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t('results.chart.title')}</span>
        <ul
          className="flex flex-wrap gap-3 text-xs text-muted-foreground"
          aria-label={t('results.chart.legend')}
        >
          {results.arms.map((arm, i) => (
            <li key={arm.armId} className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{ background: seriesColor(i) }}
                aria-hidden="true"
              />
              {arm.name}
            </li>
          ))}
        </ul>
      </figcaption>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => percent(v, locale, 0)}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, top / 100]}
              ticks={ticks}
            />
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
              content={(props: TooltipContentProps<ValueType, NameType>) => (
                <ChartTooltip {...props} results={results} locale={locale} dayLabel={dayLabel} />
              )}
            />
            {results.arms.map((arm, i) => (
              <Line
                key={arm.armId}
                type="monotone"
                dataKey={arm.armId}
                name={arm.name}
                stroke={seriesColor(i)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">{t('results.chart.caption')}</p>
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  results,
  locale,
  dayLabel,
}: TooltipContentProps<ValueType, NameType> & {
  results: ExperimentResults;
  locale: string;
  dayLabel: (date: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="grid gap-1 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <span className="font-medium">{dayLabel(String(label))}</span>
      {results.arms.map((arm, i) => {
        const value = payload.find((p) => p.dataKey === arm.armId)?.value;
        return (
          <span key={arm.armId} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: seriesColor(i) }}
                aria-hidden="true"
              />
              {arm.name}
            </span>
            <span className="tabular-nums">
              {typeof value === 'number' ? percent(value, locale) : '—'}
            </span>
          </span>
        );
      })}
    </div>
  );
}
