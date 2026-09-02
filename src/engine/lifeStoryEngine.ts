import type { MusicDNA, LifeContext } from "../types/musicDna";
import type { GroundedLifeStory, StoryChapter } from "../types/lifeStory";

/**
 * Deterministic Fallback Anlatı Oluşturucu
 * (LLM/API kesintilerinde veya ana akışta uydurmasız veri üretir)
 */
function buildDeterministicChapter(context: LifeContext): StoryChapter {
  const { stageName, song, contextText } = context;

  return {
    stageName: stageName || "Unknown",
    songTitle: song?.title || "Unknown Song",
    artistName: song?.artist || "Unknown Artist",
    releaseYear: song?.year ?? song?.releaseYear ?? "Unknown Year",
    narrative:
      contextText ||
      `During the ${(stageName || "life").toLowerCase()} phase, "${song?.title ?? "this song"}" by ${song?.artist ?? "the artist"} became the soundtrack of choice, marking a defining emotional anchor for this period.`,
  };
}

/**
 * P2 — Main Life Story Pipeline
 * MusicDNA + 8 Life Contexts -> Grounded Life Story
 */
export function generateGroundedLifeStory(
  dna: MusicDNA | null,
  contexts: LifeContext[],
): GroundedLifeStory {
  if (!contexts || contexts.length === 0) {
    return {
      title: "Müzikal Yolculuk",
      chapters: [],
      summary: "Özet bulunamadı",
      dominantEraText: "Bilinmiyor",
      diversityInsight: "Bilinmiyor",
      isGrounded: false,
    };
  }

  const chapters: StoryChapter[] = contexts.map((ctx) => buildDeterministicChapter(ctx));

  const dominantEraText = dna
    ? `Your musical arc is strongly rooted in the ${dna.temporalPattern.primaryEra}, spanning a ${dna.temporalPattern.spanYears}-year sonic journey.`
    : "Bilinmiyor";

  const diversityInsight = dna
    ? dna.musicalIdentity.diversityScore > 75
      ? `With a ${dna.musicalIdentity.diversityScore}% artist diversity index, your taste spans a wide array of musical influences.`
      : `Your selection shows a deep connection to specific core artists like ${dna.musicalIdentity.topArtists.join(", ")}.`
    : "Bilinmiyor";

  const summary = dna
    ? `A ${dna.songCount}-track journey anchored by ${dna.musicalIdentity.dominantVibe} themes, moving seamlessly from early influences to pivotal milestones.`
    : "Hayat hikayenizin müzikal bir özeti.";

  return {
    title: dna ? `The ${dna.temporalPattern.primaryEra} Sonic Autobiography` : "Hayatımın Anlatısı",
    summary,
    chapters,
    dominantEraText,
    diversityInsight,
    isGrounded: dna
      ? dna.isGrounded && contexts.every((c) => c.song?.verified !== false)
      : contexts.every((c) => c.song?.verified !== false),
  };
}
