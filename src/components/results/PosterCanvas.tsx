import { Download, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PoeticAnalysis, VisualSpec } from "@/lib/llm/poetic-analyzer";
import { exportPoeticPoster } from "@/lib/soundmap/poeticPoster";

/**
 * PosterCanvas — the exportable Dynamic Music Map.
 *
 * Every visual decision (background gradient, borders, text, typography
 * direction) is driven by the analysis' dynamic visual spec, so a Metal/Gothic
 * map, an 80s Synthwave map and a Jazz/Classical map render as genuinely
 * different posters from the same component.
 */

const FONT_BY_TYPOGRAPHY: Record<string, string> = {
  "blackletter-display": "Georgia, 'Times New Roman', serif",
  "neon-chrome": "'Segoe UI', Verdana, sans-serif",
  "elegant-serif": "Georgia, 'Palatino Linotype', serif",
  "handwritten-warm": "'Segoe Script', 'Bradley Hand', cursive",
  "bold-grotesque": "Inter, 'Helvetica Neue', sans-serif",
  "cinematic-serif": "Georgia, 'Times New Roman', serif",
};

function displayFont(visual: VisualSpec): string {
  return FONT_BY_TYPOGRAPHY[visual.typography] ?? "Georgia, serif";
}

export function PosterCanvas({ analysis, songs }: { analysis: PoeticAnalysis; songs: string[] }) {
  const { palette, aura, typography } = analysis.visual;
  const song = (i: number) => songs[i - 1] ?? `Untitled track ${i}`;
  const font = displayFont(analysis.visual);
  const maxIntensity = Math.max(...analysis.emotionalCurve.map((p) => p.intensity), 0.01);

  return (
    <section
      aria-label="Dynamic Music Map poster"
      className="overflow-hidden rounded-[2rem] border backdrop-blur-xl"
      style={{
        borderColor: `${palette.primary}55`,
        background: `radial-gradient(ellipse at top, ${palette.primary}26, transparent 55%), radial-gradient(ellipse at bottom, ${palette.accent}1f, transparent 60%), ${palette.background}`,
        color: palette.text,
      }}
    >
      {/* Header: manifesto + aura */}
      <header className="px-6 pt-10 text-center sm:px-12">
        <p
          className="text-xs font-semibold uppercase tracking-[0.35em]"
          style={{ color: palette.accent }}
        >
          Your Music Map
          {analysis.source === "gemini" ? " · Gemini" : ""}
        </p>
        <blockquote
          className="mx-auto mt-6 max-w-2xl text-2xl italic leading-snug sm:text-3xl"
          style={{ fontFamily: font }}
        >
          “{analysis.manifesto}”
        </blockquote>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {aura.map((keyword) => (
            <li
              key={keyword}
              className="rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest"
              style={{ borderColor: `${palette.primary}66`, color: palette.primary }}
            >
              {keyword}
            </li>
          ))}
        </ul>
      </header>

      {/* Emotional journey timeline */}
      <div className="mt-10 px-6 sm:px-12">
        <h3
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: `${palette.text}99` }}
        >
          Emotional Journey
        </h3>
        <div
          className="mt-4 flex h-28 items-end gap-2 rounded-2xl border p-4 sm:gap-3"
          style={{ borderColor: `${palette.primary}33`, background: `${palette.background}88` }}
        >
          {analysis.emotionalCurve.map((point, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md transition-all"
                title={`${song(i + 1)} — ${point.label}`}
                style={{
                  height: `${Math.max(10, (point.intensity / maxIntensity) * 72)}px`,
                  background: `linear-gradient(to top, ${palette.accent}, ${palette.primary})`,
                  opacity: 0.55 + point.intensity * 0.45,
                }}
              />
              <span className="text-[10px] font-mono" style={{ color: `${palette.text}80` }}>
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chapter cards */}
      <div className="mt-10 grid gap-4 px-6 sm:px-12 md:grid-cols-3">
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
              {chapter.title}
            </p>
            <p
              className="mt-1 text-[11px] uppercase tracking-widest"
              style={{ color: palette.accent }}
            >
              {chapter.mood}
            </p>
            <ul className="mt-4 space-y-1.5">
              {chapter.songIndexes.map((i) => (
                <li
                  key={i}
                  className="truncate text-sm font-semibold"
                  style={{ color: palette.text }}
                >
                  {song(i)}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: `${palette.text}b3` }}>
              {chapter.narrative}
            </p>
          </article>
        ))}
      </div>

      {/* Song insights */}
      <div className="mt-10 px-6 sm:px-12">
        <h3
          className="text-xs font-semibold uppercase tracking-[0.25em]"
          style={{ color: `${palette.text}99` }}
        >
          Song Insights
        </h3>
        <ol className="mt-4 space-y-3">
          {analysis.songInsights.map((insight) => (
            <li
              key={insight.index}
              className="flex items-start gap-4 rounded-2xl border px-4 py-3"
              style={{ borderColor: `${palette.primary}26`, background: `${palette.background}66` }}
            >
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
                <span
                  className="block text-sm leading-relaxed"
                  style={{ color: `${palette.text}a6` }}
                >
                  {insight.insight}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

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
          Core Duality
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

      {/* Footer */}
      <footer className="flex flex-col items-center gap-3 px-6 py-10 sm:px-12">
        <Button
          onClick={() => exportPoeticPoster(analysis, songs)}
          className="h-12 rounded-full px-8 text-sm font-semibold"
          style={{ background: palette.primary, color: palette.background }}
        >
          <Download className="mr-2 h-4 w-4" />
          Export High-Res Poster
        </Button>
        <p className="flex items-center gap-1.5 text-xs" style={{ color: `${palette.text}66` }}>
          <Sparkles className="h-3.5 w-3.5" />
          Theme: {analysis.visual.themeId} · {typography}
        </p>
      </footer>
    </section>
  );
}
