import { LifeContext, MusicDNA } from "../types/musicDna";
import { GroundedLifeStory } from "../types/lifeStory";

export function generateGroundedLifeStory(
  dna: MusicDNA | null,
  contexts: LifeContext[],
): GroundedLifeStory {
  if (!contexts || !Array.isArray(contexts) || contexts.length === 0) {
    return {
      title: "Müzikal Yolculuk",
      chapters: [],
      summary: "Özet bulunamadı",
      dominantEraText: "Bilinmiyor",
      diversityInsight: "Bilinmiyor",
      isGrounded: false,
    };
  }

  const chapters = contexts.map((ctx, index) => {
    const songTitle = ctx.song?.title || "Bilinmeyen Parça";
    const artistName = ctx.song?.artist || "Bilinmeyen Sanatçı";
    const stage = ctx.stageName || "Hayat Dilimi";
    const year = ctx.song?.year ?? ctx.song?.releaseYear ?? null;

    const narrative = ctx.contextText?.trim() || buildNarrative({ stage, songTitle, artistName, year, index });

    return {
      id: `chapter-${index}`,
      stageName: stage,
      songTitle,
      artistName,
      artist: artistName,
      narrative,
      releaseYear: year ?? 2000,
      emotionalTone: toneForStage(stage),
    };
  });

  const dominantEra = dna?.temporalPattern?.primaryEra
    ? `${dna.temporalPattern.primaryEra} Dönemi`
    : "Modern Dönem";
  const diversity = dna?.musicalIdentity?.dominantVibe || "Geniş bir yelpaze";

  const span = dna?.temporalPattern?.spanYears ?? 0;
  const summary =
    span > 0
      ? `${chapters.length} dönem, ${span} yıla yayılan bir dinleme çizgisi: ${chapters[0].songTitle} ile başlayıp ${chapters[chapters.length - 1].songTitle} ile kapanıyor.`
      : `${chapters.length} dönem boyunca seçtiğin parçalar, ${chapters[0].songTitle} etrafında toplanan bir hikâye anlatıyor.`;

  return {
    title: "Hayatımın Anlatısı",
    summary,
    dominantEraText: dominantEra,
    diversityInsight: diversity,
    isGrounded: true,
    chapters,
  };
}

const STAGE_TONE: Record<string, string> = {
  Childhood: "Nostalgic",
  "First Signature": "Curious",
  Rebellion: "Defiant",
  Inquiry: "Introspective",
  Steel: "Resilient",
  "Hard Time": "Cathartic",
  Darkness: "Melancholic",
  Longing: "Yearning",
  Acceptance: "Peaceful",
};

function toneForStage(stage: string): string {
  return STAGE_TONE[stage] ?? "Reflective";
}

function buildNarrative(input: {
  stage: string;
  songTitle: string;
  artistName: string;
  year: number | null;
  index: number;
}): string {
  const { stage, songTitle, artistName, year, index } = input;
  const known = artistName !== "Bilinmeyen Sanatçı";
  const artistPart = known ? ` — ${artistName}` : "";
  const yearPart = year ? ` (${year})` : "";
  const tone = toneForStage(stage).toLowerCase();

  const openings = [
    `${stage}: her şey ${songTitle}${artistPart}${yearPart} ile başlıyor.`,
    `${stage} döneminde ${songTitle}${artistPart}${yearPart} sahneyi devralıyor.`,
    `${stage} yıllarında ${songTitle}${artistPart}${yearPart} arka planda dönüyor.`,
    `${stage}: ${songTitle}${artistPart}${yearPart} bu bölümün sesi oluyor.`,
  ];

  const opening = openings[index % openings.length];
  return `${opening} Bu seçim, dönemin ${tone} tonunu taşıyor ve hikâyenin bu bölümünü kendi ritmiyle işaretliyor.`;
}

