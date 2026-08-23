import { Disc3, Download, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PoeticAnalysis, VisualSpec } from "@/lib/llm/poetic-analyzer";
import { feedEntryIntensity, type LifeFeedEntry } from "@/lib/life-feed";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { exportPoeticPoster } from "@/lib/soundmap/poeticPoster";
import type { Song } from "@/lib/song/types";

/**
 * PosterCanvas — the exportable Dynamic Music Map.
 *
 * Every visual decision (background gradient, borders, text, typography
 * direction) is driven by the analysis' dynamic visual spec, so a Metal/Gothic
 * map, an 80s Synthwave map and a Jazz/Classical map render as genuinely
 * different posters from the same component.
 */

const FONT_BY_TYPOGRAPHY: Record<string, string> = {
  "blackletter-display": "'Cinzel', Georgia, 'Times New Roman', serif",
  "neon-chrome": "'Plus Jakarta Sans', 'Segoe UI', Verdana, sans-serif",
  "elegant-serif": "'Playfair Display', Georgia, 'Palatino Linotype', serif",
  "handwritten-warm": "'Playfair Display', Georgia, serif",
  "bold-grotesque": "'Inter', 'Helvetica Neue', sans-serif",
  "cinematic-serif": "'Cinzel', Georgia, 'Times New Roman', serif",
};

export const FALLBACK_EXTRAS = {
  frame: "hairline",
  waveGradient: null as [string, string] | null,
  texture: "nebula",
  auraGlow: null as string | null,
};

export function posterExtras(visual: VisualSpec) {
  return {
    frame: visual.frame ?? FALLBACK_EXTRAS.frame,
    waveGradient:
      visual.waveGradient ?? ([visual.palette.accent, visual.palette.primary] as [string, string]),
    texture: visual.texture ?? FALLBACK_EXTRAS.texture,
    auraGlow: visual.auraGlow ?? visual.palette.accent,
  };
}

function displayFont(visual: VisualSpec): string {
  return FONT_BY_TYPOGRAPHY[visual.typography] ?? "Georgia, serif";
}

function hexToRgbaCss(hex: string, alpha: number): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const full =
    m[1].length === 3
      ? m[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1];
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Frame border style resolved from the dynamic theme extras. */
const FRAME_STYLES: Record<string, string> = {
  arch: "rounded-t-full",
  "double-rule": "rounded-[2rem]",
  "rough-edge": "rounded-2xl",
  "neon-glow": "rounded-[2rem]",
  hairline: "rounded-[2rem]",
  none: "rounded-none",
};

/** Build a smooth SVG path through the emotional curve points. */
function buildWaveformPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const first = points[0];
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export function PosterCanvas({
  analysis,
  songs,
  feedEntries = [],
}: {
  analysis: PoeticAnalysis;
  /** Structured Song objects — artwork + artist for the playlist & chapters. */
  songs: Song[];
  /**
   * Life Feed entries — each one extends the emotional curve and the playlist
   * section, so the poster evolves as the map grows beyond the original 8.
   */
  feedEntries?: LifeFeedEntry[];
}) {
  const { t } = useLanguage();
  const { palette, aura, typography } = analysis.visual;
  const extras = posterExtras(analysis.visual);
  const auraGlowColor = extras.auraGlow;
  const glowRgba = hexToRgbaCss(extras.auraGlow, 0.35);
  const song = (i: number) =>
    songs[i - 1] ?? {
      provider: "manual" as const,
      providerId: `missing-${i}`,
      title: `Untitled track ${i}`,
      artist: "",
      album: null,
      artworkUrl: null,
      isrc: null,
    };
  const font = displayFont(analysis.visual);
  const curve = [
    ...analysis.emotionalCurve,
    ...feedEntries.map((entry) => ({
      label: entry.song.title,
      intensity: feedEntryIntensity(entry),
    })),
  ];
  const maxIntensity = Math.max(...curve.map((p) => p.intensity), 0.01);

  // SVG waveform points (0..100 viewBox).
  const wavePoints = curve.map((p, i) => ({
    x: (i / Math.max(curve.length - 1, 1)) * 100,
    y: 50 - (p.intensity / maxIntensity) * 35,
  }));
  const wavePath = buildWaveformPath(wavePoints);

  const frameClass = FRAME_STYLES[extras.frame] ?? FRAME_STYLES.hairline;
  const frameShadow =
    extras.frame === "neon-glow"
      ? {
          boxShadow: `0 0 40px ${glowRgba ?? `${palette.accent}55`}, inset 0 0 24px ${glowRgba ?? `${palette.accent}33`}`,
        }
      : extras.frame === "arch"
        ? { boxShadow: `0 0 60px ${glowRgba ?? `${palette.accent}44`}` }
        : extras.frame === "double-rule"
          ? {
              boxShadow: `0 0 0 1px ${palette.primary}22, 0 0 30px ${glowRgba ?? `${palette.accent}22`}`,
            }
          : { boxShadow: `0 0 24px ${glowRgba ?? `${palette.primary}22`}` };

  return (
    <section
      aria-label={t.poster.ariaLabel}
      data-frame={extras.frame}
      data-texture={extras.texture}
      className={`overflow-hidden border backdrop-blur-xl ${frameClass}`}
      style={{
        borderColor: `${palette.primary}55`,
        background: `radial-gradient(ellipse at top, ${palette.primary}26, transparent 55%), radial-gradient(ellipse at bottom, ${palette.accent}1f, transparent 60%), ${palette.background}`,
        color: palette.text,
        ...frameShadow,
      }}
    >
      {/* Top Header: personalized title + signature motto + phase roadmap */}
      <header className="px-6 pt-10 text-center sm:px-12">
        <p
          className="text-xs font-semibold uppercase tracking-[0.35em]"
          style={{ color: palette.accent }}
        >
          {t.poster.yourMusicMap}
          {analysis.source === "gemini" ? " · Gemini" : ""}
        </p>
        <blockquote
          className="mx-auto mt-6 max-w-2xl border-l-2 pl-4 text-left text-2xl italic leading-snug sm:text-3xl"
          style={{ fontFamily: font, borderColor: `${palette.accent}80` }}
        >
          “{analysis.manifesto}”
        </blockquote>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {aura.map((keyword) => (
            <li
              key={keyword}
              className="rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest backdrop-blur-sm"
              style={{
                borderColor: `${palette.accent}33`,
                background: `${palette.accent}1a`,
                color: palette.primary,
              }}
            >
              {keyword}
            </li>
          ))}
        </ul>

        {/* Age Phase Roadmap — 4 phases across the 8 songs */}
        <div className="mx-auto mt-8 max-w-3xl">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: `${palette.text}66` }}
          >
            {t.poster.lifePhaseRoadmap}
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {analysis.chapters.map((chapter) => (
              <div
                key={chapter.id}
                className="rounded-xl border px-2 py-3 text-center"
                style={{ borderColor: `${palette.primary}33`, background: `${palette.text}05` }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: palette.primary, fontFamily: font }}
                >
                  {t.poster.phaseTitles[chapter.id] ?? chapter.title}
                </p>
                <p className="mt-1 text-[10px] font-medium" style={{ color: palette.accent }}>
                  {t.poster.phaseAgeRanges[chapter.id] ?? chapter.ageRange}
                </p>
                <p
                  className="mt-1 text-[9px] uppercase tracking-widest"
                  style={{ color: `${palette.text}66` }}
                >
                  {chapter.mood}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Central Focus: Album artworks in narrative chapters */}
      <div className="mt-10 px-6 sm:px-12">
        <h3
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: `${palette.text}99` }}
        >
          {t.poster.narrativeChapters}
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {analysis.chapters.map((chapter) => (
            <article
              key={chapter.id}
              className="rounded-3xl border p-5"
              style={{ borderColor: `${palette.primary}40`, background: `${palette.text}08` }}
            >
              <p
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: palette.primary, fontFamily: font }}
              >
                {t.poster.phaseTitles[chapter.id] ?? chapter.title}
              </p>
              <p
                className="mt-1 text-[11px] uppercase tracking-widest"
                style={{ color: palette.accent }}
              >
                {t.poster.phaseAgeRanges[chapter.id] ?? chapter.ageRange} · {chapter.mood}
              </p>

              {/* Album artwork strip */}
              <div className="mt-4 flex gap-2 overflow-hidden">
                {chapter.songIndexes.map((i) => {
                  const s = song(i);
                  return s.artworkUrl ? (
                    <img
                      key={i}
                      src={s.artworkUrl}
                      alt={`${s.title} album artwork`}
                      className="h-16 w-16 shrink-0 rounded-xl border object-cover"
                      style={{ borderColor: `${palette.primary}33` }}
                    />
                  ) : (
                    <span
                      key={i}
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border"
                      style={{ borderColor: `${palette.primary}33` }}
                    >
                      <Disc3 className="h-6 w-6" style={{ color: palette.primary }} />
                    </span>
                  );
                })}
              </div>

              <ul className="mt-4 space-y-1.5">
                {chapter.songIndexes.map((i) => {
                  const s = song(i);
                  return (
                    <li
                      key={i}
                      className="truncate text-sm font-semibold"
                      style={{ color: palette.text }}
                      title={s.artist ? `${s.title} — ${s.artist}` : s.title}
                    >
                      {s.title}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: `${palette.text}b3` }}>
                {chapter.narrative}
              </p>
            </article>
          ))}
        </div>
      </div>

      {/* Bottom Section: Emotional Frequency Timeline (SVG waveform) */}
      <div className="mt-10 px-6 sm:px-12">
        <h3
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: `${palette.text}99` }}
        >
          {t.poster.emotionalTimeline}
        </h3>
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{ borderColor: `${palette.primary}33`, background: `${palette.background}88` }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-32 w-full"
            aria-label={t.poster.waveformAria}
          >
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={extras.waveGradient[0]} stopOpacity="0.95" />
                <stop offset="100%" stopColor={extras.waveGradient[1]} stopOpacity="0.7" />
              </linearGradient>
            </defs>
            {/* Glow line */}
            <path
              d={wavePath}
              fill="none"
              stroke={auraGlowColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.4"
              vectorEffect="non-scaling-stroke"
            />
            {/* Main waveform */}
            <path
              d={wavePath}
              fill="none"
              stroke="url(#waveGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Data points */}
            {wavePoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="2.5"
                fill={i < analysis.emotionalCurve.length ? palette.accent : palette.primary}
                opacity="0.9"
              />
            ))}
          </svg>
          <div
            className="mt-2 flex justify-between text-[10px] font-mono"
            style={{ color: `${palette.text}80` }}
          >
            {curve.map((p, i) => (
              <span key={i} className="truncate" style={{ maxWidth: "10%" }}>
                {i < analysis.emotionalCurve.length
                  ? String(i + 1).padStart(2, "0")
                  : `+${i - analysis.emotionalCurve.length + 1}`}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 8-track Playlist */}
      <div className="mt-10 px-6 sm:px-12">
        <h3
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: `${palette.text}99` }}
        >
          {t.poster.theEightTracks}
        </h3>
        <ol className="mt-4 space-y-3">
          {analysis.songInsights.map((insight) => {
            const s = song(insight.index);
            return (
              <li
                key={insight.index}
                className="flex items-start gap-4 rounded-2xl border px-4 py-3"
                style={{
                  borderColor: `${palette.primary}26`,
                  background: `${palette.background}66`,
                }}
              >
                {s.artworkUrl ? (
                  <img
                    src={s.artworkUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl border object-cover"
                    style={{ borderColor: `${palette.primary}33` }}
                  />
                ) : (
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${palette.primary}33` }}
                  >
                    <Disc3 className="h-5 w-5" style={{ color: palette.primary }} />
                  </span>
                )}
                <span
                  className="mt-0.5 shrink-0 text-xs font-mono"
                  style={{ color: palette.primary }}
                >
                  {String(insight.index).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm font-semibold"
                    style={{ color: palette.text }}
                  >
                    {insight.title}
                  </span>
                  {s.artist ? (
                    <span className="block truncate text-xs" style={{ color: palette.accent }}>
                      {s.artist}
                    </span>
                  ) : null}
                  <span
                    className="block text-sm leading-relaxed"
                    style={{ color: `${palette.text}a6` }}
                  >
                    {insight.insight}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Life Feed playlist — the map beyond the original 8 */}
      {feedEntries.length > 0 ? (
        <div className="mt-10 px-6 sm:px-12">
          <h3
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            style={{ color: `${palette.text}99` }}
          >
            {t.poster.lifeFeedGrowing}
          </h3>
          <ol className="mt-4 space-y-2">
            {feedEntries.map((entry, i) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-2xl border px-4 py-2.5"
                style={{ borderColor: `${palette.primary}26`, background: `${palette.text}05` }}
              >
                {entry.song.artworkUrl ? (
                  <img
                    src={entry.song.artworkUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-xl border object-cover"
                    style={{ borderColor: `${palette.primary}33` }}
                  />
                ) : (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${palette.primary}33` }}
                  >
                    <Disc3 className="h-4 w-4" style={{ color: palette.primary }} />
                  </span>
                )}
                <span className="shrink-0 text-xs font-mono" style={{ color: palette.accent }}>
                  +{i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm font-semibold"
                    style={{ color: palette.text }}
                  >
                    {entry.song.title}
                  </span>
                  <span className="block truncate text-xs" style={{ color: `${palette.text}80` }}>
                    {entry.song.artist || entry.note || "Life Feed entry"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* Core duality */}
      <div
        className="mx-6 mt-10 rounded-3xl border p-8 text-center sm:mx-12"
        style={{
          borderColor: `${palette.accent}4d`,
          background: `linear-gradient(120deg, ${palette.primary}14, ${palette.accent}14)`,
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: `${palette.text}99` }}
        >
          {t.poster.coreDuality}
        </p>
        <p
          className="mt-4 text-3xl font-black tracking-tight sm:text-4xl"
          style={{ fontFamily: font }}
        >
          <span style={{ color: palette.primary }}>{analysis.coreDuality.left}</span>
          <span style={{ color: `${palette.text}66` }}> / </span>
          <span style={{ color: palette.accent }}>{analysis.coreDuality.right}</span>
        </p>
        <p
          className="mx-auto mt-4 max-w-xl text-sm leading-relaxed"
          style={{ color: `${palette.text}b3` }}
        >
          {analysis.coreDuality.resolution}
        </p>
      </div>

      {/* Footer: poetic quotes + download */}
      <footer className="flex flex-col items-center gap-6 px-6 py-10 sm:px-12">
        <blockquote
          className="max-w-2xl text-center text-lg italic leading-relaxed"
          style={{ color: `${palette.text}cc`, fontFamily: font }}
        >
          “{t.poster.footerQuote1}”
        </blockquote>
        <p className="text-sm font-medium tracking-wide" style={{ color: palette.accent }}>
          {t.poster.footerQuote2}
        </p>

        <Button
          onClick={() => exportPoeticPoster(analysis, songs, feedEntries)}
          className="h-12 rounded-full border px-8 text-sm font-semibold"
          style={{
            background: palette.primary,
            color: palette.background,
            borderColor: `${palette.accent}4d`,
            boxShadow: `0 0 18px ${glowRgba ?? `${palette.primary}33`}`,
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          {t.poster.downloadPoster}
        </Button>
        <p className="flex items-center gap-1.5 text-xs" style={{ color: `${palette.text}66` }}>
          <Sparkles className="h-3.5 w-3.5" />
          {t.poster.themeLabel} {analysis.visual.themeId} · {typography}
        </p>
      </footer>
    </section>
  );
}
