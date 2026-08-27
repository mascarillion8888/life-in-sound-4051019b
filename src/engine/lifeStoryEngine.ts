import type { MusicDNA, LifeContext } from "../types/musicDna";
import type { GroundedLifeStory, StoryChapter } from "../types/lifeStory";

/**
 * Deterministic Fallback Anlatı Oluşturucu
 * (LLM/API kesintilerinde veya ana akışta uydurmasız veri üretir)
 */
function buildDeterministicChapter(context: LifeContext): StoryChapter {
  const { stageName, song } = context;

  return {
    stageName,
    songTitle: song.title,
    artistName: song.artist,
    releaseYear: song.releaseYear || "Unknown Year",
    narrative: `During the ${stageName.toLowerCase()} phase, "${song.title}" by ${song.artist} became the soundtrack of choice, marking a defining emotional anchor for this period.`,
  };
}

/**
 * P2 — Main Life Story Pipeline
 * MusicDNA + 8 Life Contexts -> Grounded Life Story
 */
export function generateGroundedLifeStory(
  dna: MusicDNA,
  contexts: LifeContext[],
): GroundedLifeStory {
  if (!contexts || contexts.length === 0) {
    throw new Error("Life Story generation requires valid LifeContext array.");
  }

  // 1. Her yaşam bağlamını ve şarkıyı chapter haline getir
  const chapters: StoryChapter[] = contexts.map((ctx) => buildDeterministicChapter(ctx));

  // 2. MusicDNA verilerinden tematik özetler çıkar
  const dominantEraText = `Your musical arc is strongly rooted in the ${dna.temporalPattern.primaryEra}, spanning a ${dna.temporalPattern.spanYears}-year sonic journey.`;

  const diversityInsight =
    dna.musicalIdentity.diversityScore > 75
      ? `With a ${dna.musicalIdentity.diversityScore}% artist diversity index, your taste spans a wide array of musical influences.`
      : `Your selection shows a deep connection to specific core artists like ${dna.musicalIdentity.topArtists.join(", ")}.`;

  const summary = `A ${dna.songCount}-track journey anchored by ${dna.musicalIdentity.dominantVibe} themes, moving seamlessly from early influences to pivotal milestones.`;

  return {
    title: `The ${dna.temporalPattern.primaryEra} Sonic Autobiography`,
    summary,
    chapters,
    dominantEraText,
    diversityInsight,
    isGrounded: dna.isGrounded && contexts.every((c) => c.song.verified !== false),
  };
}
