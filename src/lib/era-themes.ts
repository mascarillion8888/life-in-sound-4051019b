export interface EraTheme {
  bg: string;      // arka plan gradient sınıfları
  text: string;    // metin rengi sınıfı
  accent: string;  // vurgu rengi (border, badge)
  shadow: string;  // gölge rengi
  overlay: string; // overlay gradient
}

export const eraThemes: Record<string, EraTheme> = {
  '70s': {
    bg: 'from-amber-950 via-orange-900 to-amber-900',
    text: 'text-amber-100',
    accent: 'border-amber-400',
    shadow: 'shadow-amber-900/50',
    overlay: 'bg-gradient-to-b from-black/70 via-transparent to-black/90',
  },
  '80s': {
    bg: 'from-purple-950 via-pink-900 to-purple-900',
    text: 'text-pink-100',
    accent: 'border-pink-400',
    shadow: 'shadow-pink-900/50',
    overlay: 'bg-gradient-to-b from-black/70 via-transparent to-black/90',
  },
  '90s': {
    bg: 'from-blue-950 via-cyan-900 to-blue-900',
    text: 'text-cyan-100',
    accent: 'border-cyan-400',
    shadow: 'shadow-cyan-900/50',
    overlay: 'bg-gradient-to-b from-black/70 via-transparent to-black/90',
  },
  '2000s': {
    bg: 'from-emerald-950 via-teal-900 to-emerald-900',
    text: 'text-teal-100',
    accent: 'border-teal-400',
    shadow: 'shadow-teal-900/50',
    overlay: 'bg-gradient-to-b from-black/70 via-transparent to-black/90',
  },
  default: {
    bg: 'from-gray-950 via-gray-900 to-gray-950',
    text: 'text-gray-100',
    accent: 'border-gray-400',
    shadow: 'shadow-gray-900/50',
    overlay: 'bg-gradient-to-b from-black/70 via-transparent to-black/90',
  },
};

export function getEraTheme(era: string | undefined): EraTheme {
  if (!era) return eraThemes.default;
  const normalized = era.replace('s', '') + 's';
  return eraThemes[normalized] || eraThemes.default;
}