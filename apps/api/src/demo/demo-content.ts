import type {
  Brief,
  ElementKind,
  GoalTarget,
  Industry,
  PageType,
  VariantApproach,
} from '@uplift/shared';

/**
 * Content for the demo account: a fictional home-insurance company (Casaclara) whose landing page
 * ships with the app (assets/casaclara.html), so the demo never depends on a third-party site.
 * Selectors use the page's data-testid attributes.
 */

export const DEMO_SITE = 'https://www.casaclara-seguros.example/';

export const DEMO_BRIEF: Brief = {
  offer: {
    product:
      'Seguro de hogar online con asistencia 24 horas, reparaciones urgentes y sin permanencia.',
    pageGoal: 'Que calculen su precio y empiecen el presupuesto online',
    benefits: [
      'Precio en 2 minutos, sin llamadas',
      'Reparaciones urgentes en menos de 3 horas',
      'Sin permanencia',
      'Coberturas explicadas sin letra pequeña',
    ],
  },
  reader: {
    audience:
      'Personas de 28 a 45 años que viven de alquiler o acaban de comprar su primera casa y quieren contratar sin llamadas.',
    stage: 'comparing',
    doubts: [
      '«Luego el precio sube»',
      '«Los seguros nunca cubren nada»',
      '«Contratar lleva mucho tiempo»',
    ],
  },
  evidence: {
    proofPoints: [
      '120.000 hogares asegurados',
      'Valoración media de 4,6 sobre 5',
      'Reparaciones urgentes en menos de 3 horas',
      'Precio desde 9,90 €/mes para un piso de 85 m² en Madrid',
    ],
    offLimits: ['el seguro más barato', 'cubre todo'],
  },
  style: {
    tones: ['friendly', 'reassuring'],
    formality: 'informal',
    readingLevel: 'simple',
    notes:
      'Frases cortas. Hablamos de «tu casa», nunca de «la vivienda». Nada de tecnicismos de seguros.',
  },
  rules: {
    sensitivity: 'high',
    bannedWords: ['gratis', 'garantizado', '100%'],
    requiredMentions: ['Sin permanencia'],
    legalNotes: ['Precio para un piso de 85 m² en Madrid con la cobertura básica.'],
    avoidStyles: ['Urgencia falsa («¡solo hoy!»)', 'Miedo exagerado a las desgracias'],
  },
};

type DemoVariant = { text: string; approach: VariantApproach; rationale: string; quality: number };
type DemoElement = {
  key: string;
  name: string;
  type: ElementKind;
  selector: string;
  originalText: string;
  maxLength: number;
  notes?: string;
  variants: DemoVariant[];
};

export const DEMO_ELEMENTS: DemoElement[] = [
  {
    key: 'headline',
    name: 'Titular principal',
    type: 'headline',
    selector: '[data-testid="hero-title"]',
    originalText: 'El seguro de hogar que entiendes a la primera',
    maxLength: 70,
    variants: [
      {
        text: 'Tu casa protegida en 2 minutos, sin llamadas',
        approach: 'specificity',
        rationale:
          'Convierte la ventaja más concreta (rapidez y sin llamadas) en la promesa principal.',
        quality: 86,
      },
      {
        text: 'Un seguro de hogar sin letra pequeña, por fin',
        approach: 'answers_doubt',
        rationale: 'Responde a la desconfianza hacia los seguros, la objeción más habitual.',
        quality: 78,
      },
      {
        text: '120.000 hogares ya duermen tranquilos con Casaclara',
        approach: 'social_proof',
        rationale: 'Usa un dato real de la fuente de verdad para generar confianza.',
        quality: 72,
      },
      {
        // Deliberately breaks the brief so the demo shows the rule checks at work.
        text: 'El seguro más barato, garantizado',
        approach: 'benefit',
        rationale: 'Promesa de precio muy directa.',
        quality: 45,
      },
    ],
  },
  {
    key: 'subheadline',
    name: 'Subtítulo',
    type: 'subheadline',
    selector: '[data-testid="hero-subtitle"]',
    originalText:
      'Coberturas claras, asistencia las 24 horas y un precio que no sube al año siguiente sin avisarte.',
    maxLength: 160,
    variants: [
      {
        text: 'Calcula tu precio en 2 minutos. Si algo se rompe, un profesional llega en menos de 3 horas.',
        approach: 'specificity',
        rationale: 'Dos datos concretos y creíbles en lugar de adjetivos genéricos.',
        quality: 84,
      },
      {
        text: 'Asistencia 24 horas, reparaciones urgentes y sin permanencia: si no te convence, te vas cuando quieras.',
        approach: 'risk_reversal',
        rationale: 'Reduce el miedo a comprometerse, clave en la fase de consideración.',
        quality: 80,
      },
      {
        text: 'Más de 120.000 hogares confían en nosotros, con una valoración media de 4,6 sobre 5.',
        approach: 'social_proof',
        rationale: 'Apoya el titular con prueba social verificable.',
        quality: 70,
      },
    ],
  },
  {
    key: 'cta',
    name: 'Botón principal',
    type: 'cta',
    selector: '[data-testid="hero-cta"]',
    originalText: 'Calcular mi precio',
    maxLength: 25,
    notes: 'Debe dejar claro que no hay que llamar a nadie.',
    variants: [
      {
        text: 'Ver mi precio',
        approach: 'clarity',
        rationale: 'Más corto y centrado en el resultado, no en el esfuerzo.',
        quality: 82,
      },
      {
        text: 'Calcular en 2 minutos',
        approach: 'specificity',
        rationale: 'Anticipa cuánto se tarda, lo que reduce la fricción del clic.',
        quality: 88,
      },
      {
        text: 'Quiero mi presupuesto',
        approach: 'benefit',
        rationale: 'Primera persona: el visitante se ve a sí mismo haciendo la acción.',
        quality: 74,
      },
    ],
  },
  {
    key: 'benefit',
    name: 'Beneficio: reparaciones',
    type: 'bullet',
    selector: '[data-testid="benefit-1"] b',
    originalText: 'Reparaciones urgentes en 3 horas',
    maxLength: 50,
    variants: [
      {
        text: 'Un profesional en casa en menos de 3 horas',
        approach: 'specificity',
        rationale: 'Pone a una persona en la escena: más tangible que «reparaciones».',
        quality: 83,
      },
      {
        text: 'Averías urgentes resueltas el mismo día',
        approach: 'benefit',
        rationale: 'Habla del resultado que le importa al cliente.',
        quality: 76,
      },
    ],
  },
];

export const DEMO_GOALS: { name: string; target: GoalTarget; isPrimary: boolean }[] = [
  {
    name: 'Clic en «Calcular mi precio»',
    target: { kind: 'click', selector: '[data-testid="hero-cta"]' },
    isPrimary: true,
  },
  {
    name: 'Llega al presupuesto',
    target: { kind: 'pageview', match: 'prefix', value: '/presupuesto' },
    isPrimary: false,
  },
  {
    name: 'Empieza el formulario',
    target: { kind: 'event', eventName: 'quote_started' },
    isPrimary: false,
  },
];

/** Arms by element key → variant index. */
export const DEMO_ARMS = [
  {
    name: 'Variante A · Rapidez',
    weight: 33,
    changes: { headline: 0, subheadline: 0, cta: 1 },
  },
  {
    name: 'Variante B · Prueba social',
    weight: 33,
    changes: { headline: 2, subheadline: 2 },
  },
] as const;

/** Variants bookmarked to the library in the demo (element key → variant index). */
export const DEMO_SAVED = [
  { element: 'subheadline', variant: 1 },
  { element: 'benefit', variant: 0 },
] as const;

export const SECONDARY_PROJECTS: {
  name: string;
  url: string;
  industry: Industry;
  pageType: PageType;
  status: 'draft' | 'finished';
  archived: boolean;
  /** How long ago the project was last touched, so the list looks lived-in. */
  ageDays: number;
  /** A finished experiment (Control vs. each variant of the first element) and its winner. */
  finishedExperiment?: {
    winnerVariant: number;
    seed: string;
    days: number;
    visitorsPerDay: number;
  };
  elements: {
    name: string;
    type: ElementKind;
    selector: string;
    originalText: string;
    variants: string[];
  }[];
}[] = [
  {
    name: 'Precios · Facturapp',
    url: 'https://www.facturapp.example/precios',
    industry: 'saas',
    pageType: 'pricing',
    status: 'draft',
    archived: false,
    ageDays: 3,
    elements: [
      {
        name: 'Titular de precios',
        type: 'headline',
        selector: 'main h1',
        originalText: 'Planes para autónomos y pymes',
        variants: [
          'Factura en minutos, desde el primer día',
          'Un plan para cada etapa de tu negocio',
        ],
      },
      {
        name: 'Botón del plan Pro',
        type: 'cta',
        selector: '#plan-pro .btn',
        originalText: 'Empezar prueba',
        variants: ['Probar Pro 14 días', 'Empezar con Pro'],
      },
    ],
  },
  {
    name: 'Landing Black Friday',
    url: 'https://www.casaclara-seguros.example/black-friday',
    industry: 'insurance',
    pageType: 'landing',
    status: 'finished',
    archived: true,
    ageDays: 45,
    finishedExperiment: { winnerVariant: 1, seed: 'casaclara-bf-7', days: 14, visitorsPerDay: 900 },
    elements: [
      {
        name: 'Titular de campaña',
        type: 'headline',
        selector: '[data-testid="bf-title"]',
        originalText: 'Black Friday: 30 % de descuento en tu seguro de hogar',
        variants: [
          'Este Black Friday, protege tu casa por un 30 % menos',
          'Tu seguro de hogar con un 30 % menos todo el primer año',
        ],
      },
    ],
  },
];
