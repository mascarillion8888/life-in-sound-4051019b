import type { MusicDNA } from "./musicDna";

export interface SocialSharePayload {
  title: string;
  description: string;
  eraBadge: string;
  topArtistsText: string;
  shareUrl: string;
}

/**
 * Grounded Music DNA'dan sosyal share payload'u oluşturucu — UI bağımsız,
 * belge CardGallery bizi almak istediği sıradır.
 */
export function buildSocialSharePayload(dna: MusicDNA, shareUrl: string): SocialSharePayload {
  return {
    title: `Life in a Sound — My ${dna.temporalPattern.primaryEra} Sonic Autobiography`,
    description: `Across ${dna.songCount} defining tracks, my music DNA spans a ${dna.temporalPattern.spanYears}-year journey featuring ${dna.musicalIdentity.topArtists.join(", ")}.`,
    eraBadge: dna.temporalPattern.primaryEra,
    topArtistsText: dna.musicalIdentity.topArtists.join(" • "),
    shareUrl,
  };
}
