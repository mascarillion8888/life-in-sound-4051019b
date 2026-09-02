export interface ColorTheme {
  primary: string;
  secondary: string;
  background: string;
  accent: string;
}

export function getThemeForTrack(artist: string = '', title: string = ''): ColorTheme {
  const text = `${artist} ${title}`.toLowerCase();

  if (text.includes('marley') || text.includes('reggae')) {
    return { primary: '#eab308', secondary: '#22c55e', background: '#15803d', accent: '#ef4444' };
  }
  if (text.includes('floyd') || text.includes('rock') || text.includes('psychedelic')) {
    return { primary: '#a855f7', secondary: '#ec4899', background: '#3b0764', accent: '#06b6d4' };
  }
  if (text.includes('metal') || text.includes('metallica') || text.includes('slayer')) {
    return { primary: '#ef4444', secondary: '#78716c', background: '#18181b', accent: '#dc2626' };
  }

  return { primary: '#f59e0b', secondary: '#d97706', background: '#1c1917', accent: '#fbbf24' };
}
