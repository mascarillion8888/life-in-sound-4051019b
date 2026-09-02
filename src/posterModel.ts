// Poster data model
// Fields:
// - background
// - title
// - subtitle
// - palette
// - effects
// - imagePrompt

/** Background types for posters */
export type BackgroundType = 'color' | 'gradient' | 'image' | 'pattern';

export interface BackgroundColor {
  type: 'color';
  value: string; // any CSS color, e.g. '#0f172a' or 'rgba(255,255,255,0.08)'
}

export interface GradientStop {
  color: string; // CSS color
  offset?: number; // 0..100 percentage, optional
}

export interface BackgroundGradient {
  type: 'gradient';
  angle?: number; // degrees, optional
  stops: GradientStop[]; // at least 2
}

export interface BackgroundImage {
  type: 'image';
  url?: string; // optional URL if generated or external
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  position?: string; // CSS position string like 'center', 'top right'
  blurPx?: number; // optional CSS blur applied as backdrop
  opacity?: number; // 0..1
  // If image is to be generated, imagePrompt may supply details; this is metadata only
}

export interface BackgroundPattern {
  type: 'pattern';
  name?: string; // e.g., 'diagonal-lines', 'dots'
  color?: string;
  scale?: number; // pattern scale
}

export type PosterBackground = BackgroundColor | BackgroundGradient | BackgroundImage | BackgroundPattern;

/** Palette describing main colors for the poster */
export interface Palette {
  primary?: string; // main text / focal color
  secondary?: string; // supporting color
  accent?: string; // used for small highlights
  background?: string; // optional override/background hint
  colors?: string[]; // fallback list of colors (hex or CSS color strings)
}

/** Effects that can be toggled or tuned on the poster */
export interface GlassmorphismEffect {
  enabled: boolean;
  blurPx?: number; // e.g. 8
  opacity?: number; // 0..1 overlay
  borderOpacity?: number; // 0..1 for frosted border
}

export interface VignetteEffect {
  enabled: boolean;
  intensity?: number; // 0..1
}

export interface GrainEffect {
  enabled: boolean;
  intensity?: number; // 0..1
}

export interface ShadowEffect {
  enabled: boolean;
  spread?: number;
  blur?: number;
  color?: string;
}

export interface AnimationEffect {
  enabled: boolean;
  type?: 'subtle-glow' | 'pulse' | 'parallax' | 'gradient-shift';
  speed?: number; // relative speed modifier
}

export interface PosterEffects {
  glassmorphism?: GlassmorphismEffect;
  vignette?: VignetteEffect;
  grain?: GrainEffect;
  shadow?: ShadowEffect;
  animation?: AnimationEffect;
  // Any additional raw CSS filters to apply
  extraCssFilters?: string[];
}

/** Image prompt model for image generation */
export interface ImagePrompt {
  prompt: string;
  negativePrompt?: string;
  model?: string; // e.g., 'stable-diffusion-1.5'
  seed?: number;
  aspectRatio?: string; // e.g., '16:9', '1:1'
  guidanceScale?: number; // e.g., classifier-free guidance
  // optional hint for focal subject
  subjectHint?: string;
}

/** Main Poster data model */
export interface PosterData {
  // Background composition
  background: PosterBackground;

  // Primary text fields
  title: string;
  subtitle?: string;

  // Color palette and accents
  palette?: Palette;

  // Visual effects toggles and parameters
  effects?: PosterEffects;

  // If the poster includes or should generate an image, imagePrompt encodes generation details
  imagePrompt?: ImagePrompt | string;

  // optional metadata
  widthPx?: number;
  heightPx?: number;
  createdAt?: string; // ISO timestamp
  id?: string;
}

/** Simple factory to create a PosterData object with sensible defaults */
export function createPosterData(overrides: Partial<PosterData> = {}): PosterData {
  const defaultBackground: BackgroundGradient = {
    type: 'gradient',
    angle: 135,
    stops: [
      { color: '#0f172a', offset: 0 },
      { color: '#1e293b', offset: 100 },
    ],
  };

  const base: PosterData = {
    background: defaultBackground,
    title: 'Untitled Poster',
    subtitle: undefined,
    palette: { primary: '#FFFFFF', secondary: '#A1A1AA', accent: '#7C3AED', colors: ['#7C3AED', '#06B6D4', '#F59E0B'] },
    effects: {
      glassmorphism: { enabled: true, blurPx: 8, opacity: 0.08, borderOpacity: 0.12 },
      vignette: { enabled: true, intensity: 0.15 },
      grain: { enabled: false, intensity: 0.02 },
      shadow: { enabled: true, spread: 8, blur: 30, color: 'rgba(2,6,23,0.6)' },
      animation: { enabled: true, type: 'gradient-shift', speed: 1 },
    },
    imagePrompt: undefined,
    widthPx: 1200,
    heightPx: 1800,
    createdAt: new Date().toISOString(),
  };

  return { ...base, ...overrides };
}

/** Basic validator for PosterData shape (lightweight checks) */
export function validatePosterData(data: Partial<PosterData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.background) errors.push('background is required');
  if (!data.title || data.title.trim().length === 0) errors.push('title is required');

  // background specifics
  if (data.background) {
    const b = data.background as PosterBackground;
    if (b.type === 'gradient') {
      const g = b as BackgroundGradient;
      if (!Array.isArray(g.stops) || g.stops.length < 2) errors.push('gradient background requires at least two stops');
    }
  }

  return { valid: errors.length === 0, errors };
}
