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
    const narrative =
      ctx.contextText?.trim() ||
      `${stage}: ${songTitle}${artistName !== "Bilinmeyen Sanatçı" ? ` — ${artistName}` : ""}`;

    return {
      id: `chapter-${index}`,
      stageName: stage,
      songTitle,
      artistName,
      artist: artistName,
      narrative,
      releaseYear: ctx.song?.year ?? ctx.song?.releaseYear ?? 2000,
      emotionalTone: "Nostalgic",
    };
  });

  const dominantEra = dna?.temporalPattern?.primaryEra
    ? `${dna.temporalPattern.primaryEra} Dönemi`
    : "Modern Dönem";
  const diversity = dna?.musicalIdentity?.dominantVibe || "Geniş bir yelpaze";

  return {
    title: "Hayatımın Anlatısı",
    summary: "Hayat hikayenizin müzikal bir özeti.",
    dominantEraText: dominantEra,
    diversityInsight: diversity,
    isGrounded: true,
    chapters,
  };
}
