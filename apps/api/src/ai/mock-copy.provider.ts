import type { ElementKind, VariantApproach } from '@uplift/shared';
import type { CopyProvider, CopyRequest, CopyResult, GeneratedCopy } from './copy-provider.js';

type Lang = 'es' | 'en';
type Template = { approach: VariantApproach; make: (ctx: Context) => string | null };
type Context = { original: string; benefit?: string; proof?: string; goal?: string };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// Deliberately simple patterns: enough to demo the workflow without an API key.
const TEMPLATES: Record<Lang, Partial<Record<ElementKind, Template[]>> & { default: Template[] }> =
  {
    es: {
      cta: [
        { approach: 'clarity', make: () => 'Empieza ahora' },
        { approach: 'risk_reversal', make: () => 'Pruébalo sin compromiso' },
        {
          approach: 'benefit',
          make: (c) => (c.goal ? `Quiero ${lower(c.goal)}` : 'Ver cómo funciona'),
        },
        { approach: 'urgency', make: () => 'Empieza hoy mismo' },
        { approach: 'curiosity', make: () => 'Descubre cómo' },
        { approach: 'specificity', make: () => 'Empieza en 2 minutos' },
        { approach: 'benefit', make: () => 'Quiero empezar' },
        { approach: 'clarity', make: () => 'Continuar' },
        { approach: 'risk_reversal', make: () => 'Probar gratis' },
        { approach: 'curiosity', make: () => 'Ver ejemplos' },
        { approach: 'emotional', make: () => '¡Vamos allá!' },
        { approach: 'specificity', make: () => 'Ver precios y planes' },
      ],
      default: [
        { approach: 'benefit', make: (c) => c.benefit ?? null },
        { approach: 'social_proof', make: (c) => (c.proof ? `${c.proof}. ${c.original}` : null) },
        {
          approach: 'clarity',
          make: (c) => c.original.replace(/[.!]+$/, '') + ', sin complicaciones',
        },
        {
          approach: 'answers_doubt',
          make: (c) => `${c.original.replace(/[.!]+$/, '')}. Sin letra pequeña.`,
        },
        { approach: 'curiosity', make: (c) => `¿Y si ${lower(c.benefit ?? c.original)}?` },
        { approach: 'emotional', make: (c) => `Por fin: ${lower(c.original)}` },
        {
          approach: 'specificity',
          make: (c) => (c.proof && c.benefit ? `${c.benefit}: ${lower(c.proof)}` : null),
        },
        {
          approach: 'benefit',
          make: (c) =>
            c.goal ? `${c.original.replace(/[.!]+$/, '')} para ${lower(c.goal)}` : null,
        },
        { approach: 'clarity', make: (c) => `Así de fácil: ${lower(c.original)}` },
      ],
    },
    en: {
      cta: [
        { approach: 'clarity', make: () => 'Get started' },
        { approach: 'risk_reversal', make: () => 'Try it risk-free' },
        {
          approach: 'benefit',
          make: (c) => (c.goal ? `Yes, ${lower(c.goal)}` : 'See how it works'),
        },
        { approach: 'urgency', make: () => 'Start today' },
        { approach: 'curiosity', make: () => 'Find out how' },
        { approach: 'specificity', make: () => 'Start in 2 minutes' },
        { approach: 'benefit', make: () => 'I want this' },
        { approach: 'clarity', make: () => 'Continue' },
        { approach: 'risk_reversal', make: () => 'Try it free' },
        { approach: 'curiosity', make: () => 'See examples' },
        { approach: 'emotional', make: () => "Let's go!" },
        { approach: 'specificity', make: () => 'See plans and pricing' },
      ],
      default: [
        { approach: 'benefit', make: (c) => c.benefit ?? null },
        { approach: 'social_proof', make: (c) => (c.proof ? `${c.proof}. ${c.original}` : null) },
        { approach: 'clarity', make: (c) => c.original.replace(/[.!]+$/, '') + ', made simple' },
        {
          approach: 'answers_doubt',
          make: (c) => `${c.original.replace(/[.!]+$/, '')}. No fine print.`,
        },
        { approach: 'curiosity', make: (c) => `What if ${lower(c.benefit ?? c.original)}?` },
        { approach: 'emotional', make: (c) => `Finally: ${lower(c.original)}` },
        {
          approach: 'specificity',
          make: (c) => (c.proof && c.benefit ? `${c.benefit}: ${lower(c.proof)}` : null),
        },
        {
          approach: 'benefit',
          make: (c) => (c.goal ? `${c.original.replace(/[.!]+$/, '')} to ${lower(c.goal)}` : null),
        },
        { approach: 'clarity', make: (c) => `It's this simple: ${lower(c.original)}` },
      ],
    },
  };

const RATIONALES: Record<Lang, Record<VariantApproach, string>> = {
  es: {
    clarity: 'Más directo: deja claro qué pasa al hacer clic.',
    benefit: 'Lidera con el beneficio en lugar de con la característica.',
    social_proof: 'Apoya el mensaje con un dato real para generar confianza.',
    urgency: 'Invita a actuar ahora sin inventar plazos.',
    risk_reversal: 'Reduce el miedo a comprometerse.',
    curiosity: 'Despierta curiosidad para seguir leyendo.',
    specificity: 'Un detalle concreto resulta más creíble que una promesa genérica.',
    answers_doubt: 'Despeja una duda habitual antes de que aparezca.',
    emotional: 'Conecta con el alivio de resolver el problema.',
  },
  en: {
    clarity: 'More direct: makes it clear what happens on click.',
    benefit: 'Leads with the benefit instead of the feature.',
    social_proof: 'Backs the message with a real fact to build trust.',
    urgency: 'Invites action now without inventing deadlines.',
    risk_reversal: 'Lowers the fear of committing.',
    curiosity: 'Sparks curiosity to keep reading.',
    specificity: 'A concrete detail is more credible than a generic promise.',
    answers_doubt: 'Clears up a common doubt before it comes up.',
    emotional: 'Connects with the relief of solving the problem.',
  },
};

/** Cuts at a word boundary so the text fits `max` characters. */
function fit(text: string, max: number | null) {
  if (max == null || text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : text.slice(0, max)).replace(
    /[,;:]$/,
    '',
  );
}

/** Small stable hash so the same input always yields the same "scores". */
function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Template-based stand-in for the AI, used when no API key is configured. */
export class MockCopyProvider implements CopyProvider {
  readonly name = 'mock' as const;

  constructor(private readonly delayMs = 700) {}

  async generate(request: CopyRequest): Promise<CopyResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    const lang: Lang = request.project.locale.startsWith('es') ? 'es' : 'en';
    const rationaleLang = request.rationaleLanguage;
    const { brief, element } = request;
    const templates = TEMPLATES[lang][element.type] ?? TEMPLATES[lang].default;
    const taken = new Set(
      [element.originalText, ...request.existingTexts].map((t) => t.toLowerCase()),
    );
    const offset = request.existingTexts.length;

    const variants: GeneratedCopy[] = [];
    for (let i = 0; i < templates.length * 2 && variants.length < request.count; i++) {
      const template = templates[(offset + i) % templates.length]!;
      const ctx: Context = {
        original: element.originalText,
        benefit: brief.offer.benefits[(offset + i) % Math.max(1, brief.offer.benefits.length)],
        proof:
          brief.evidence.proofPoints[(offset + i) % Math.max(1, brief.evidence.proofPoints.length)],
        goal: brief.offer.pageGoal || undefined,
      };
      const raw = template.make(ctx);
      if (!raw) continue;
      const text = fit(raw, element.maxLength);
      if (taken.has(text.toLowerCase())) continue;
      taken.add(text.toLowerCase());
      const h = hash(text);
      variants.push({
        text,
        approach: template.approach,
        rationale: RATIONALES[rationaleLang][template.approach],
        clarity: 3 + (h % 3),
        relevance: 3 + ((h >> 3) % 3),
        persuasion: 2 + ((h >> 6) % 4),
      });
    }

    return { variants, model: 'mock', usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
