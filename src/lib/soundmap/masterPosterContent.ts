/**
 * Pure content builders for the fixed 1024×1536 editorial Master Poster.
 *
 * Reused by both renderers: the in-page component in
 * `MasterPosterCanvas.tsx` and the journey-completion modal in
 * `MasterPosterModal` (which exports it at 2048×3072 via html-to-image).
 * Every label is resolved here from `PoeticAnalysis` — the renderers only
 * do layout, never text derivation.
 */

import type { PoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import type { LifeFeedEntry } from "@/lib/life-feed";
import type { Song } from "@/lib/song/types";

export type RenderLabels = {
  title: string;
  tracklist: string;
  portals: string;
  waveformHeader: string;
  journeyArc: string;
  sealSlogan: string;
  sealSub: string;
  peakIdentity: string;
  earlySpark: string;
  close: string;
  download: string;
  openPoster: string;
};

export const RENDER_LABELS: Record<"tr" | "en", RenderLabels> = {
  en: {
    title: "A LIFE'S SOUNDTRACK — MUSIC MAP",
    tracklist: "The Tracklist",
    portals: "Transition Portals",
    waveformHeader: "Emotional Waveform",
    journeyArc: "Discovery → Rebellion → Questioning → Darkness → Depth",
    sealSlogan: "Life in a Sound",
    sealSub: "Personal Seal",
    peakIdentity: "Peak Identity",
    earlySpark: "Early Spark",
    close: "Close",
    download: "Download PNG (2048×3072)",
    openPoster: "Open Your Music Map",
  },
  tr: {
    title: "BİR HAYATIN SOUNDTRACK'İ — MÜZİK HARİTASI",
    tracklist: "Parça Listesi",
    portals: "Geçiş Portalları",
    waveformHeader: "Duygusal Dalgaform",
    journeyArc: "Keşif → İsyan → Sorgulama → Karanlık → Derinlik",
    sealSlogan: "Life in a Sound",
    sealSub: "Kişisel Mührü",
    peakIdentity: "Zirve Kimliği",
    earlySpark: "İlk Kıvılcım",
    close: "Kapat",
    download: "PNG İndir (2048×3072)",
    openPoster: "Müzik Haritanı Aç",
  },
};

export type PortalSpec = { age: string; title: string };

export type MasterPosterContent = {
  songList: Song[];
  /** Numbered "01." — style entries for the bottom tracklist. */
  numberedTitles: string[];
  /** Left panel: tracks of chapters i & ii. */
  earlyEraTracks: string[];
  /** Right panel: tracks of chapter v. */
  peakIdentityTracks: string[];
  masterSong: Song;
  masterTitle: string;
  masterArtist: string;
  portals: PortalSpec[];
  curve: { label: string; intensity: number }[];
  wavePoints: { x: number; y: number }[];
};

function placeholderSong(i: number): Song {
  return {
    provider: "manual",
    providerId: `missing-${i}`,
    title: `Untitled track ${i}`,
    artist: "",
    album: null,
    artworkUrl: null,
    isrc: null,
  };
}

export function buildMasterPosterContent(
  analysis: PoeticAnalysis,
  songs: Song[],
  feedEntries: LifeFeedEntry[] = [],
): MasterPosterContent {
  const songList = [...songs, ...feedEntries.map((e) => e.song)];
  const numberedTitles = songList.map((s) => s.title);

  const getSong = (oneBased: number) => songList[oneBased - 1] ?? placeholderSong(oneBased);

  const earlyEraTracks = analysis.chapters
    .slice(0, 2)
    .flatMap((c) => c.songIndexes)
    .map((i) => getSong(i).title);

  const peakChapter = analysis.chapters[4] ?? analysis.chapters[0];
  const peakIdentityTracks = (peakChapter?.songIndexes ?? []).map((i) => getSong(i).title);

  const masterIndex = analysis.emotionalCurve.reduce(
    (best, point, i) => (point.intensity > analysis.emotionalCurve[best].intensity ? i : best),
    0,
  );
  const masterSong = getSong(masterIndex + 1);
  const masterTitle = masterSong.title;
  const masterArtist = masterSong.artist || masterSong.title;

  const portals: PortalSpec[] = analysis.chapters
    .slice(0, 4)
    .map((c) => ({ age: c.ageRange, title: c.title }));

  const curve = analysis.emotionalCurve;
  const maxIntensity = Math.max(...curve.map((p) => p.intensity), 0.01);
  const wavePoints = curve.map((p, i) => ({
    x: (i / Math.max(curve.length - 1, 1)) * 100,
    y: 50 - (p.intensity / maxIntensity) * 30,
  }));

  return {
    songList,
    numberedTitles,
    earlyEraTracks,
    peakIdentityTracks,
    masterSong,
    masterTitle,
    masterArtist,
    portals,
    curve,
    wavePoints,
  };
}
