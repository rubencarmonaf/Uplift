import type { Brief, ElementType, Industry, PageType, VariantAngle } from '@uplift/shared';

/** Everything a provider needs to write variants for one element. */
export type CopyRequest = {
  project: {
    name: string;
    url: string;
    industry: Industry;
    pageType: PageType;
    /** Market the copy is written for, e.g. `es-ES`. */
    locale: string;
  };
  brief: Brief;
  element: {
    name: string;
    type: ElementType;
    originalText: string;
    minLength: number | null;
    maxLength: number | null;
    notes: string;
  };
  /** Variants that already exist for the element, so new ones don't repeat them. */
  existingTexts: string[];
  count: number;
  instructions: string;
  /** Language for the rationales shown in the app (the UI language, not the market). */
  rationaleLanguage: 'es' | 'en';
};

export type GeneratedCopy = {
  text: string;
  angle: VariantAngle;
  rationale: string;
  /** Self-assessment, 1-5 each. */
  clarity: number;
  relevance: number;
  persuasion: number;
};

export type CopyResult = {
  variants: GeneratedCopy[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

export interface CopyProvider {
  readonly name: 'anthropic' | 'mock';
  generate(request: CopyRequest): Promise<CopyResult>;
}

export const COPY_PROVIDER = Symbol('COPY_PROVIDER');

/** Raised when the model declines or returns something unusable; the element is marked as failed. */
export class CopyGenerationError extends Error {}
