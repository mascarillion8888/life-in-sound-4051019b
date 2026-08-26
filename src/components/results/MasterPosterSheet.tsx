import type { PoeticAnalysis, VisualSpec } from "@/lib/llm/poetic-analyzer";
import {
  buildMasterPosterContent,
  RENDER_LABELS,
  type RenderLabels,
} from "@/lib/soundmap/masterPosterContent";
import { resolvePosterTheme, type PosterTheme } from "@/lib/soundmap/posterTheme";
import type { LifeFeedEntry } from "@/lib/life-feed";
import type { Song } from "@/lib/song/types";

/**
 * MasterPosterSheet — the strict 2:3 editorial infographic (1024×1536
 * logical; exported at 2048×3072 via html-to-image on the same element).
 *
 * Information architecture (never rearranged, only re-themed):
 *   Header      — rule line, title, era badge row
 *   Side panels — Left: early era tracks · Right: peak identity tracks
 *   Center      — master album frame (with its gothic inner border)
 *   Portals     — 4 gothic transition portals (age-facing chapter cards)
 *   Bottom      — emotional waveform (SVG), numbered tracklist, circular seal
 *
 * The posterTheme (posterTheme.ts) recasts palette/metal/sky per render.
 * This is a shared presentational component — rendered inline in
 * MasterPosterCanvas and inside the journey-completion MasterPosterModal.
 */

/** Build a smooth SVG path through the waveform points. */
function wavePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export function MasterPosterSheet({
  analysis,
  songs,
  feedEntries = [],
  labels,
  locale,
}: {
  analysis: PoeticAnalysis;
  songs: Song[];
  feedEntries?: LifeFeedEntry[];
  /** Resolved labels — MASTER_COMPONENT passes RENDER_LABELS[locale]. */
  labels: RenderLabels;
  locale: "tr" | "en";
}) {
  const { palette } = analysis.visual;
  const theme: PosterTheme = resolvePosterTheme({
    genres: [
      analysis.visual.themeId,
      ...songs.map((s) => `${s.title} ${s.artist} ${s.album ?? ""}`),
    ],
    releaseYears: songs.map((s) => s.releaseYear ?? null),
    emotionalIntensity:
      analysis.emotionalCurve.reduce((sum, p) => sum + p.intensity, 0) /
      Math.max(analysis.emotionalCurve.length, 1),
    mood: [...analysis.visual.aura, ...analysis.chapters.map((c) => c.mood)],
  });

  const content = buildMasterPosterContent(analysis, songs, feedEntries);
  const path = wavePath(content.wavePoints);

  const waveStops = content.wavePoints.map((p, i) => {
    if (i === 0) return null;
    return (
      <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={0.8} fill={theme.metalColor} opacity={0.9} />
    );
  });

  return (
    <div
      data-testid="master-poster-sheet"
      data-metal={theme.metal}
      data-atmosphere={theme.atmosphere}
      data-scene={theme.backgroundScene}
      data-locale={locale}
      style={{
        aspectRatio: "2 / 3",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        border: `1px solid ${theme.metalColor}66`,
        background: `radial-gradient(ellipse at top, ${theme.metalColor}1c, transparent 55%), radial-gradient(ellipse at bottom, ${palette.accent}18, transparent 60%), ${theme.primaryBg}`,
        color: palette.text,
        fontFamily: "ui-serif, Georgia, serif",
      }}
    >
      {/* Emotional weather — storm clouds vs clear sky. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        data-testid="sheet-sky"
        data-scene={theme.backgroundScene}
      >
        {theme.backgroundScene === "stormy" ? (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 90% 40% at 15% 0%, ${theme.metalColor}12, transparent 60%), radial-gradient(ellipse 80% 36% at 88% 4%, rgba(58,64,78,0.4), transparent 65%)`,
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-[28%]"
              style={{
                background: `radial-gradient(ellipse 26% 52% at 70% 0%, ${theme.metalHighlight}1f, transparent 70%)`,
                mixBlendMode: "screen",
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 70% 36% at 50% 0%, ${theme.metalColor}0e, transparent 65%)`,
            }}
          />
        )}
      </div>

      {/* ---------- Header ---------- */}
      <header
        className="px-[4.5%] pt-[3%] text-center"
        style={{ position: "relative" }}
        data-testid="sheet-header"
      >
        <p
          className="text-[0.55rem] font-semibold uppercase tracking-[0.4em]"
          style={{ color: theme.metalColor }}
        >
          {labels.title.split("—")[0].trim()}
          {" — "}
          {labels.title.split("—")[1]?.trim()}
        </p>
        <h2
          className="mt-[1.2%] text-[clamp(1rem,3.2cqw,1.6rem)] font-bold uppercase tracking-[0.18em]"
          style={{ color: palette.text }}
        >
          {labels.title.split("—")[1]?.trim()}
        </h2>
        <div
          className="mx-auto mt-[2%] flex flex-wrap justify-center gap-[1.2%]"
          data-testid="era-badges"
        >
          {analysis.chapters.map((c) => (
            <span
              key={c.id}
              className="rounded-full border px-[1.4%] py-[0.4%] text-[0.5rem] font-semibold uppercase tracking-widest"
              style={{
                borderColor: `${theme.metalColor}55`,
                background: `${theme.metalColor}14`,
                color: theme.metalHighlight,
              }}
            >
              {c.ageRange}
            </span>
          ))}
        </div>
      </header>

      {/* ---------- Side panels + Center ---------- */}
      <div
        className="mt-[2.5%] grid flex-1 grid-cols-[1fr_1.4fr_1fr] gap-[2%] px-[4.5%]"
        data-testid="sheet-middle"
      >
        {/* Left — early era tracks */}
        <section
          className="rounded-lg border p-[3%]"
          style={{
            borderColor: `${theme.metalColor}44`,
            background: `${palette.text}06`,
          }}
          data-testid="panel-left"
        >
          <h3
            className="text-[0.5rem] font-bold uppercase tracking-[0.25em]"
            style={{ color: theme.metalColor }}
          >
            {labels.earlySpark}
          </h3>
          <ol className="mt-[4%] space-y-[3%]">
            {content.earlyEraTracks.map((t) => (
              <li key={t} className="text-[0.55rem] leading-snug" style={{ color: palette.text }}>
                {t}
              </li>
            ))}
          </ol>
        </section>

        {/* Center — master album frame */}
        <section
          className="flex flex-col items-center justify-center rounded-lg border px-[3%] py-[2%]"
          style={{
            borderColor: `${theme.metalColor}66`,
            background: `${theme.metalColor}0c`,
            boxShadow: `0 0 32px ${theme.metalColor}26, inset 0 0 20px ${theme.metalColor}18`,
          }}
          data-testid="master-frame"
        >
          {content.masterSong.artworkUrl ? (
            <img
              src={content.masterSong.artworkUrl}
              alt={content.masterTitle}
              className="aspect-square w-[72%] rounded object-cover"
              style={{ filter: "sepia(0.4) contrast(1.08) saturate(0.75)" }}
              data-testid="master-artwork-img"
            />
          ) : (
            <div
              aria-hidden
              className="relative flex aspect-square w-[72%] items-center justify-center overflow-hidden rounded"
              style={{
                border: `2px solid ${theme.metalColor}88`,
                background: `radial-gradient(ellipse at 40% 35%, ${theme.metalColor}1e, transparent 60%), ${theme.primaryBg}`,
              }}
              data-testid="master-frame-face"
            >
              <span className="text-[1.4rem]" style={{ color: `${theme.metalColor}55` }}>
                ♪
              </span>
            </div>
          )}
          <p
            className="mt-[4%] max-w-full truncate text-center text-[0.62rem] font-bold uppercase tracking-widest"
            style={{ color: palette.text }}
          >
            {content.masterTitle}
          </p>
          <p
            className="max-w-full truncate text-center text-[0.55rem]"
            style={{ color: theme.metalHighlight }}
          >
            {content.masterArtist}
          </p>
          {/* portal strip inside the frame */}
          <div
            className="mx-auto mt-[5%] grid w-full grid-cols-4 gap-[2%]"
            data-testid="portal-strip"
          >
            {content.portals.map((portal) => (
              <div
                key={`${portal.age}-${portal.title}`}
                className="rounded border px-[2%] py-[3%] text-center"
                style={{
                  borderColor: `${theme.metalColor}55`,
                  background: `${palette.text}05`,
                }}
                title={portal.title}
              >
                <p
                  className="text-[0.42rem] font-bold uppercase tracking-wider"
                  style={{ color: theme.metalColor }}
                >
                  {portal.age}
                </p>
              </div>
            ))}
          </div>
          <p
            className="mt-[3%] text-[0.45rem] uppercase tracking-[0.3em]"
            style={{ color: `${palette.text}77` }}
          >
            {labels.portals}
          </p>
        </section>

        {/* Right — peak identity tracks */}
        <section
          className="rounded-lg border p-[3%]"
          style={{
            borderColor: `${theme.metalColor}44`,
            background: `${palette.text}06`,
          }}
          data-testid="panel-right"
        >
          <h3
            className="text-[0.5rem] font-bold uppercase tracking-[0.25em]"
            style={{ color: theme.metalColor }}
          >
            {labels.peakIdentity}
          </h3>
          <ol className="mt-[4%] space-y-[3%]">
            {content.peakIdentityTracks.map((t) => (
              <li key={t} className="text-[0.55rem] leading-snug" style={{ color: palette.text }}>
                {t}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ---------- Bottom: waveform + tracklist + seal ---------- */}
      <div className="px-[4.5%] pb-[3.5%]" data-testid="sheet-bottom">
        <div className="grid grid-cols-[1.5fr_1fr_0.55fr] gap-[2.5%]">
          {/* Waveform */}
          <section
            className="rounded-lg border p-[3%]"
            style={{ borderColor: `${theme.metalColor}44`, background: `${palette.text}05` }}
            data-testid="wave-panel"
          >
            <h3
              className="text-[0.48rem] font-bold uppercase tracking-[0.25em]"
              style={{ color: theme.metalColor }}
            >
              {labels.waveformHeader}
            </h3>
            <p
              className="text-[0.42rem] uppercase tracking-wider"
              style={{ color: `${palette.text}88` }}
            >
              {labels.journeyArc}
            </p>
            <svg
              viewBox="0 0 100 55"
              preserveAspectRatio="none"
              className="mt-[3%] h-[4.5rem] w-full"
              aria-label="emotional waveform"
            >
              <defs>
                <linearGradient id="sheetWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={theme.metalColor} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={theme.metalHighlight} stopOpacity="0.75" />
                </linearGradient>
              </defs>
              <path
                d={path}
                fill="none"
                stroke="url(#sheetWaveGrad)"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {waveStops}
            </svg>
          </section>

          {/* Tracklist */}
          <section
            className="rounded-lg border p-[3%]"
            style={{ borderColor: `${theme.metalColor}44`, background: `${palette.text}05` }}
            data-testid="tracklist-panel"
          >
            <h3
              className="text-[0.48rem] font-bold uppercase tracking-[0.25em]"
              style={{ color: theme.metalColor }}
            >
              {labels.tracklist}
            </h3>
            <ol className="mt-[3%] space-y-[1.5%]">
              {content.numberedTitles.map((t, i) => (
                <li
                  key={`${i}-${t}`}
                  className="truncate text-[0.5rem]"
                  style={{ color: palette.text }}
                >
                  <span style={{ color: theme.metalColor }}>{String(i + 1).padStart(2, "0")}.</span>{" "}
                  {t}
                </li>
              ))}
            </ol>
          </section>

          {/* Circular seal */}
          <section className="flex items-center justify-center" data-testid="seal-panel">
            <div
              aria-hidden
              className="relative flex aspect-square w-full max-w-[6.5rem] items-center justify-center rounded-full border"
              style={{
                borderColor: `${theme.metalColor}99`,
                boxShadow: `0 0 24px ${theme.metalColor}33, inset 0 0 18px ${theme.metalColor}26`,
                background: `radial-gradient(circle at 40% 35%, ${theme.metalColor}20, transparent 62%)`,
              }}
              data-testid="circular-seal"
            >
              <div
                className="absolute inset-[9%] rounded-full border border-dashed"
                style={{ borderColor: `${theme.metalColor}55` }}
              />
              <div className="px-[12%] text-center">
                <p
                  className="text-[0.42rem] font-bold uppercase leading-tight tracking-[0.18em]"
                  style={{ color: theme.metalHighlight }}
                >
                  {labels.sealSlogan}
                </p>
                <p
                  className="mt-[2%] text-[0.36rem] uppercase tracking-[0.3em]"
                  style={{ color: `${palette.text}77` }}
                >
                  {labels.sealSub}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
