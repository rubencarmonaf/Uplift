import type { ElementType, VariantAngle } from '@uplift/shared';
import type { CopyProvider, CopyRequest, CopyResult, GeneratedCopy } from './copy-provider.js';

type Lang = 'es' | 'en';
type Template = { angle: VariantAngle; make: (ctx: Context) => string | null };
type Context = { original: string; valueProp?: string; fact?: string; goal?: string };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// Deliberately simple patterns: enough to demo the workflow without an API key.
const TEMPLATES: Record<Lang, Partial<Record<ElementType, Template[]>> & { default: Template[] }> =
  {
    es: {
      cta: [
        { angle: 'clarity', make: () => 'Empieza ahora' },
        { angle: 'risk_reversal', make: () => 'Pruébalo sin compromiso' },
        {
          angle: 'benefit',
          make: (c) => (c.goal ? `Quiero ${lower(c.goal)}` : 'Ver cómo funciona'),
        },
        { angle: 'urgency', make: () => 'Empieza hoy mismo' },
        { angle: 'curiosity', make: () => 'Descubre cómo' },
        { angle: 'specificity', make: () => 'Empieza en 2 minutos' },
        { angle: 'benefit', make: () => 'Quiero empezar' },
        { angle: 'clarity', make: () => 'Continuar' },
        { angle: 'risk_reversal', make: () => 'Probar gratis' },
        { angle: 'curiosity', make: () => 'Ver ejemplos' },
        { angle: 'emotional', make: () => '¡Vamos allá!' },
        { angle: 'specificity', make: () => 'Ver precios y planes' },
      ],
      default: [
        { angle: 'benefit', make: (c) => c.valueProp ?? null },
        { angle: 'social_proof', make: (c) => (c.fact ? `${c.fact}. ${c.original}` : null) },
        {
          angle: 'clarity',
          make: (c) => c.original.replace(/[.!]+$/, '') + ', sin complicaciones',
        },
        {
          angle: 'objection_handling',
          make: (c) => `${c.original.replace(/[.!]+$/, '')}. Sin letra pequeña.`,
        },
        { angle: 'curiosity', make: (c) => `¿Y si ${lower(c.valueProp ?? c.original)}?` },
        { angle: 'emotional', make: (c) => `Por fin: ${lower(c.original)}` },
        {
          angle: 'specificity',
          make: (c) => (c.fact && c.valueProp ? `${c.valueProp}: ${lower(c.fact)}` : null),
        },
        {
          angle: 'benefit',
          make: (c) =>
            c.goal ? `${c.original.replace(/[.!]+$/, '')} para ${lower(c.goal)}` : null,
        },
        { angle: 'clarity', make: (c) => `Así de fácil: ${lower(c.original)}` },
      ],
    },
    en: {
      cta: [
        { angle: 'clarity', make: () => 'Get started' },
        { angle: 'risk_reversal', make: () => 'Try it risk-free' },
        { angle: 'benefit', make: (c) => (c.goal ? `Yes, ${lower(c.goal)}` : 'See how it works') },
        { angle: 'urgency', make: () => 'Start today' },
        { angle: 'curiosity', make: () => 'Find out how' },
        { angle: 'specificity', make: () => 'Start in 2 minutes' },
        { angle: 'benefit', make: () => 'I want this' },
        { angle: 'clarity', make: () => 'Continue' },
        { angle: 'risk_reversal', make: () => 'Try it free' },
        { angle: 'curiosity', make: () => 'See examples' },
        { angle: 'emotional', make: () => "Let's go!" },
        { angle: 'specificity', make: () => 'See plans and pricing' },
      ],
      default: [
        { angle: 'benefit', make: (c) => c.valueProp ?? null },
        { angle: 'social_proof', make: (c) => (c.fact ? `${c.fact}. ${c.original}` : null) },
        { angle: 'clarity', make: (c) => c.original.replace(/[.!]+$/, '') + ', made simple' },
        {
          angle: 'objection_handling',
          make: (c) => `${c.original.replace(/[.!]+$/, '')}. No fine print.`,
        },
        { angle: 'curiosity', make: (c) => `What if ${lower(c.valueProp ?? c.original)}?` },
        { angle: 'emotional', make: (c) => `Finally: ${lower(c.original)}` },
        {
          angle: 'specificity',
          make: (c) => (c.fact && c.valueProp ? `${c.valueProp}: ${lower(c.fact)}` : null),
        },
        {
          angle: 'benefit',
          make: (c) => (c.goal ? `${c.original.replace(/[.!]+$/, '')} to ${lower(c.goal)}` : null),
        },
        { angle: 'clarity', make: (c) => `It's this simple: ${lower(c.original)}` },
      ],
    },
  };

const RATIONALES: Record<Lang, Record<VariantAngle, string>> = {
  es: {
    clarity: 'Más directo: deja claro qué pasa al hacer clic.',
    benefit: 'Lidera con el beneficio en lugar de con la característica.',
    social_proof: 'Apoya el mensaje con un dato real para generar confianza.',
    urgency: 'Invita a actuar ahora sin inventar plazos.',
    risk_reversal: 'Reduce el miedo a comprometerse.',
    curiosity: 'Despierta curiosidad para seguir leyendo.',
    specificity: 'Un detalle concreto resulta más creíble que una promesa genérica.',
    objection_handling: 'Responde a una objeción habitual antes de que aparezca.',
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
    objection_handling: 'Answers a common objection before it comes up.',
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
        valueProp:
          brief.business.valueProps[(offset + i) % Math.max(1, brief.business.valueProps.length)],
        fact: brief.truth.facts[(offset + i) % Math.max(1, brief.truth.facts.length)],
        goal: brief.business.pageGoal || undefined,
      };
      const raw = template.make(ctx);
      if (!raw) continue;
      const text = fit(raw, element.maxLength);
      if (taken.has(text.toLowerCase())) continue;
      taken.add(text.toLowerCase());
      const h = hash(text);
      variants.push({
        text,
        angle: template.angle,
        rationale: RATIONALES[rationaleLang][template.angle],
        clarity: 3 + (h % 3),
        relevance: 3 + ((h >> 3) % 3),
        persuasion: 2 + ((h >> 6) % 4),
      });
    }

    return { variants, model: 'mock', usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
