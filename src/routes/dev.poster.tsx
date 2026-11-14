/**
 * DEV-ONLY poster preview (task P0-3, docs/architecture/CINEMATIC_LIFE_POSTER.md §8.3).
 *
 * Follows the `dev.player-card.tsx` pattern: a route that exists purely for
 * local inspection. It is NEVER linked from anywhere in the app and it is
 * hard-gated to development — `beforeLoad` throws `notFound()` whenever
 * `import.meta.env.DEV` is false, so a production request 404s and the preview
 * can never reach a real user.
 *
 * Query param `?n=` selects the entry count variant (0, 1, 3, 8, 12) so the
 * empty / large-stacked / two-column / compact-grid layouts can be eyeballed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildLifeCards } from "@/lib/soundmap/lifeCards";
import type { JourneyProgress } from "@/lib/journey-storage";
import type { Song } from "@/lib/song/types";
import { resolveBackdrop, backdropUrlByRef } from "@/lib/visual/backdropRegistry";
import {
  composePosterModel,
  type LifePosterModel,
  type PosterEntry,
} from "@/lib/poster/posterModel";
import { composePosterLayout } from "@/lib/poster/posterLayout";
import { buildPosterDrawPlan, type PosterAssets } from "@/lib/poster/posterDrawPlan";
import { exportPosterPng, renderDrawPlan, type LoadPosterImage } from "@/lib/poster/posterCanvas";
import { devOnlyGuard } from "@/lib/poster/devGuard";

export const Route = createFileRoute("/dev/poster")({
  beforeLoad: () => devOnlyGuard(import.meta.env.DEV),
  component: PosterPreview,
});

const SAMPLE_SONGS: Song[] = [
  ["Aurora Field", "Nova Lumen", "dream pop", "Dreamy", 1988],
  ["Paper Kites", "Harbour Lights", "folk", "Nostalgic", 1974],
  ["Iron Meridian", "Ash Cathedral", "metal", "Dark", 1996],
  ["Neon Harbour", "Cassette Sun", "synth-pop", "Euphoric", 1984],
  ["Slow Tide", "Marla Quinn", "soul", "Romantic", 1971],
  ["Glass Corridor", "The Quiet Signal", "post-rock", "Melancholic", 2003],
  ["Voltage Garden", "Kid Static", "electronic", "Energetic", 2012],
  ["River of Salt", "Amara Diallo", "world", "World", 1999],
  ["Midnight Fold", "Lior Vance", "jazz", "Dreamy", 1962],
  ["Signal Fires", "Rook & Wren", "indie", "Playful", 2016],
  ["Ash & Amber", "Sable Choir", "gospel", "Euphoric", 2008],
  ["Low Orbit", "Field Notes", "ambient", "Melancholic", 2021],
].map(([title, artist, genre, mood, releaseYear]) => ({
  provider: "manual" as const,
  providerId: `dev-${title}`,
  title: String(title),
  artist: String(artist),
  album: null,
  artworkUrl: null,
  isrc: null,
  genre: String(genre),
  mood: String(mood),
  releaseYear: Number(releaseYear),
}));

const SAMPLE_LORE = [
  "You hear it first in a room that no longer exists.",
  "The volume was louder than anything you could say.",
  "A door opened somewhere behind the drums.",
  "The city turned to colour and you followed it.",
  "Someone hummed this and the whole evening softened.",
  "The quiet arrived before you were ready for it.",
  "Every wire in the room seemed to hum along.",
  "You carried this across a border you cannot name.",
  "The night folded itself around one slow chord.",
  "A chorus opened and you forgot to be careful.",
  "It sounded like everyone you had ever missed.",
  "From far above, the earth kept its slow tempo.",
];

function sampleModel(count: number): LifePosterModel {
  const n = Math.max(0, Math.min(count, SAMPLE_SONGS.length));
  const songs: Record<number, Song> = {};
  const loreLines: Record<number, string> = {};
  for (let i = 0; i < n; i++) {
    songs[i + 1] = SAMPLE_SONGS[i];
    loreLines[i] = SAMPLE_LORE[i];
  }
  const progress: JourneyProgress = { current: n + 1, answers: {}, songs };
  return composePosterModel({
    progress,
    cards: buildLifeCards({ locale: "en" }),
    loreLines,
    birthYear: 1980,
    language: "en",
  });
}

/** Backdrop resolver: the EXISTING decade-aware registry, no new mapping. */
function backdropAssets(): PosterAssets {
  return {
    backdropFor: (entry: PosterEntry) => {
      const resolution = resolveBackdrop({
        mood: entry.mood,
        genre: entry.genre,
        decade: entry.decade,
        releaseYear: entry.releaseYear,
      });
      const url = backdropUrlByRef(resolution.assetRef);
      return url ? { src: url } : null;
    },
  };
}

function browserLoadImage(): LoadPosterImage {
  return (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
}

function PosterPreview() {
  const params = new URLSearchParams(window.location.search);
  const requested = Number(params.get("n"));
  const count = Number.isFinite(requested) ? requested : 8;

  const model = useMemo(() => sampleModel(count), [count]);
  const layout = useMemo(() => composePosterLayout(model), [model]);
  const plan = useMemo(() => buildPosterDrawPlan(layout, model, backdropAssets()), [layout, model]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    void (async () => {
      try {
        const srcs = [
          ...new Set(plan.commands.filter((c) => c.kind === "image").map((c) => c.src)),
        ];
        const loader = browserLoadImage();
        const loaded: Record<string, CanvasImageSource | null> = {};
        await Promise.all(
          srcs.map(async (src) => {
            loaded[src] = await loader(src);
          }),
        );
        if (cancelled) return;
        renderDrawPlan(ctx, plan, loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  const download = async () => {
    try {
      const blob = await exportPosterPng(plan, browserLoadImage());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `life-poster-${count}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0c0618", color: "#f5f0ff", padding: 24 }}>
      <h1 style={{ font: "600 20px Inter, sans-serif", marginBottom: 8 }}>
        Poster preview — {layout.variant} ({model.entries.length} entries)
      </h1>
      <p style={{ font: "400 14px Inter, sans-serif", opacity: 0.7, marginBottom: 16 }}>
        Dev-only. Try <code>?n=0</code>, <code>?n=1</code>, <code>?n=3</code>, <code>?n=8</code>,{" "}
        <code>?n=12</code>.
      </p>
      <button
        type="button"
        onClick={download}
        style={{
          font: "600 14px Inter, sans-serif",
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background: "#7c5cff",
          color: "#fff",
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        Download PNG
      </button>
      {error ? <p style={{ color: "#ff8a8a" }}>Error: {error}</p> : null}
      <div>
        <canvas
          ref={canvasRef}
          width={plan.canvas.width}
          height={plan.canvas.height}
          style={{ width: 512, height: 768, border: "1px solid #2a2140", background: "#000" }}
        />
      </div>
    </div>
  );
}
