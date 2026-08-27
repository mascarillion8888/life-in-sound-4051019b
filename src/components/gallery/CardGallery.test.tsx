import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoryChapter } from "@/types/lifeStory";
import type { EmotionalNode } from "@/types/emotionalTimeline";
import { mapChapterToGalleryCard } from "@/types/gallery";
import { buildSocialSharePayload } from "@/types/socialShare";
import type { MusicDNA } from "@/types/musicDna";
import { CardGallery } from "./CardGallery";
import { loadGalleryCards } from "@/lib/supabase/cards-remote";

/*
 * The gallery's data layer is mocked — there is no real Supabase backend in
 * the test environment, so the DAL must be stubbed. This is the only mock in
 * the file; the model mapping helpers above exercise real code paths.
 */
vi.mock("@/lib/supabase/cards-remote", () => ({
  loadGalleryCards: vi.fn(),
}));
vi.mock("@/lib/supabase/use-session", () => ({
  useSession: () => ({ status: "anonymous", user: { id: "user-123" } }),
}));

function chapter(over: Partial<StoryChapter> = {}): StoryChapter {
  return {
    stageName: "Childhood",
    songTitle: "Holy Diver",
    artistName: "Dio",
    releaseYear: 1983,
    narrative: `During the childhood phase, "Holy Diver" by Dio became the soundtrack of choice.`,
    ...over,
  };
}

function node(over: Partial<EmotionalNode> = {}): EmotionalNode {
  return {
    stageName: "Childhood",
    songTitle: "Holy Diver",
    artistName: "Dio",
    releaseYear: 1983,
    valency: 0.8,
    intensity: 7,
    vibeLabel: "Nostalgic Spark",
    temporalArcPosition: 0,
    ...over,
  };
}

describe("CardGallery grounded mapping (mapChapterToGalleryCard)", () => {
  it("maps chapter+node to GalleryCardData with P3 intensity/vibe", () => {
    const card = mapChapterToGalleryCard(chapter(), node());
    expect(card.id).toBe("card-childhood");
    expect(card.stageName).toBe("Childhood");
    expect(card.songTitle).toBe("Holy Diver");
    expect(card.artistName).toBe("Dio");
    expect(card.intensityScore).toBe(7);
    expect(card.vibeLabel).toBe("Nostalgic Spark");
    expect(card.isGrounded).toBe(true);
  });

  it("falls back to default intensity/vibe when no emotional node exists", () => {
    const card = mapChapterToGalleryCard(chapter(), undefined, "");
    expect(card.intensityScore).toBe(8);
    expect(card.vibeLabel).toBe("Grounded Reflection");
    expect(card.imageUrl).toBe("/assets/default-woodcut-placeholder.jpg");
  });

  it(" preserves given imageUrl / falls back to woodcut placeholder", () => {
    const withImage = mapChapterToGalleryCard(chapter(), node(), "https://cdn.example/a.jpg");
    expect(withImage.imageUrl).toBe("https://cdn.example/a.jpg");

    const without = mapChapterToGalleryCard(chapter(), node(), "");
    expect(without.imageUrl).toBe("/assets/default-woodcut-placeholder.jpg");
  });
});

describe("SocialSharePayload (buildSocialSharePayload)", () => {
  const dna: MusicDNA = {
    temporalPattern: {
      primaryEra: "1980s",
      spanYears: 17,
      eraDistribution: { "1980s": 3 },
      earliestReleaseYear: 1970,
      latestReleaseYear: 1987,
    },
    musicalIdentity: {
      topArtists: ["Dio", "Sting"],
      diversityScore: 25,
      dominantVibe: "Focused Nostalgic",
      hasVerifiedTracks: true,
    },
    songCount: 3,
    isGrounded: true,
    analyzedAt: "2026-08-27T00:00:00.000Z",
  };

  it("builds era badge + top artists bullets from grounded DNA", () => {
    const payload = buildSocialSharePayload(dna, "https://lifeinsound.app/results");
    expect(payload.title).toContain("1980s");
    expect(payload.description).toContain("17-year");
    expect(payload.description).toContain("Dio, Sting");
    expect(payload.eraBadge).toBe("1980s");
    expect(payload.topArtistsText).toBe("Dio • Sting");
    expect(payload.shareUrl).toBe("https://lifeinsound.app/results");
  });
});

/*
 * Wire test — the gallery's select path goes through `mapCardRowToGrounded` —
 * the badge renders the grounded vibe label decoded from the scene token.
 */
describe("CardGallery adapter wire (select path)", () => {
  beforeEach(() => {
    vi.mocked(loadGalleryCards).mockResolvedValue([
      {
        id: "c1",
        trackKey: "dio — holy diver",
        title: "Holy Diver",
        artist: "Dio",
        genre: null,
        releaseYear: 1983,
        birthYear: null,
        encounterAge: null,
        eraYear: 1983,
        userMemory: null,
        scene: "Childhood|Nostalgic Spark|9",
        lore: "A defining track for childhood.",
        imagePath: null,
        createdAt: "2026-08-27T10:00:00Z",
      },
    ]);
  });

  it("decodes the packed scene through supabaseCardAdapter → vibe badge", async () => {
    render(<CardGallery />);
    expect(screen.queryByTestId("gallery-loading")).toBeTruthy();
    const badges = await screen.findAllByTestId("grounded-vibe-badge");
    expect(badges[0].textContent).toBe("Nostalgic Spark");
    expect(screen.getByText("Holy Diver")).toBeTruthy();
    expect(screen.getByText("Dio")).toBeTruthy();
  });
});
