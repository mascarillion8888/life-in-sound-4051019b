import { getThemeForTrack } from "./ThemeMapper";

interface SilhouetteCanvasProps {
  artist: string;
  songTitle: string;
  eraTitle?: string;
}

export function SilhouetteCanvas({ artist, songTitle, eraTitle }: SilhouetteCanvasProps) {
  const theme = getThemeForTrack(artist, songTitle);

  return (
    <div
      data-testid="silhouette-canvas"
      className="absolute inset-0 flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: theme.background }}
    >
      {/* Ambient radial glow in the theme's primary color. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${theme.primary} 0%, transparent 70%)`,
        }}
      />
      {/* Vinyl silhouette — reading disc, not a cover photo. */}
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full border-4 shadow-lg"
        style={{ borderColor: theme.primary, backgroundColor: "#000000" }}
      >
        <div className="h-6 w-6 rounded-full border-2" style={{ borderColor: theme.secondary }} />
      </div>
      <div className="z-10 mt-3 px-4 text-center">
        {eraTitle && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: theme.secondary }}>
            {eraTitle}
          </p>
        )}
        <h4 className="max-w-[200px] truncate text-sm font-bold" style={{ color: theme.primary }}>
          {songTitle}
        </h4>
        <p className="max-w-[200px] truncate text-xs opacity-80" style={{ color: theme.accent }}>
          {artist}
        </p>
      </div>
    </div>
  );
}
