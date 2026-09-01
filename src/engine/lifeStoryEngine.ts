import { LifeContext } from "../types/musicDna";
import { GroundedLifeStory } from "../types/lifeStory";

export function generateGroundedLifeStory(dna: any, contexts: LifeContext[]): GroundedLifeStory {
  if (!contexts || !Array.isArray(contexts)) {
    return { 
      title: "Müzikal Yolculuk", 
      chapters: [],
      summary: "Özet bulunamadı",
      dominantEraText: "Bilinmiyor",
      diversityInsight: "Bilinmiyor",
      isGrounded: false
    };
  }

  const chapters = contexts.map((ctx, index) => ({
    id: `chapter-${index}`,
    stageName: ctx.stageName || "Hayat Dilimi",
    songTitle: ctx.song?.title || "Bilinmeyen Parça",
    artistName: ctx.song?.artist || "Bilinmeyen Sanatçı",
    artist: ctx.song?.artist || "Bilinmeyen Sanatçı",
    narrative: ctx.contextText || "Bu döneme ait detay belirtilmedi.",
    releaseYear: ctx.song?.year ?? ctx.song?.releaseYear ?? 2000,
    emotionalTone: "Nostalgic"
  }));

  return {
    title: "Hayatımın Anlatısı",
    summary: "Hayat hikayenizin müzikal bir özeti.",
    dominantEraText: "Modern Dönem",
    diversityInsight: "Geniş bir yelpaze",
    isGrounded: true,
    chapters
  };
}
