/** Colour slot for an arm: follows the arm's position in the experiment, never its rank. */
export const seriesColor = (index: number) => `var(--series-${(index % 5) + 1})`;

export const percent = (value: number, locale: string, digits = 1) =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const signedPercent = (value: number, locale: string, digits = 1) =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(value);

export const integer = (value: number, locale: string) =>
  new Intl.NumberFormat(locale).format(value);

/** Probabilities never reach certainty: show "> 99.9%" / "< 0.1%" instead of rounding to 100% or 0%. */
export const probability = (value: number, locale: string, digits = 1) => {
  const edge = 10 ** -(digits + 2);
  if (value > 1 - edge) return `> ${percent(1 - edge, locale, digits)}`;
  if (value < edge) return `< ${percent(edge, locale, digits)}`;
  return percent(value, locale, digits);
};
