/** Markets offered for copy generation. The language drives the AI output, the region its conventions. */
export const MARKET_LOCALES = [
  'es-ES',
  'es-MX',
  'en-US',
  'en-GB',
  'fr-FR',
  'de-DE',
  'it-IT',
  'pt-PT',
  'pt-BR',
  'nl-NL',
] as const;

export function localeLabel(tag: string, uiLocale: string) {
  try {
    return new Intl.DisplayNames([uiLocale], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
