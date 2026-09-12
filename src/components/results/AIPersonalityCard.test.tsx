import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AIPersonalityCard } from "./AIPersonalityCard";
import { buildPosterModel } from "@/lib/ai/posterModel";
import type { EmotionProfile, MusicProfile, PersonalityProfile } from "@/lib/ai/types";

const DEFAULT_EMOTIONS: EmotionProfile = {
  dominantEmotion: "nostalgia",
  secondaryEmotions: ["hope"],
  intensity: 0.6,
};

const DEFAULT_MUSIC: MusicProfile = {
  primaryGenres: ["indie folk"],
  secondaryGenres: ["ambient"],
  mood: "bittersweet",
  listeningStyle: "album-oriented",
};

function buildProfile(overrides: Partial<PersonalityProfile> = {}): PersonalityProfile {
  return {
    archetype: "The Wanderer",
    title: "Seeker of Sound",
    description: "You move through life collecting moments of meaning.",
    emotionalProfile: ["nostalgic", "hopeful"],
    traits: ["curious", "reflective"],
    musicProfile: "Broad and eclectic.",
    recommendedGenres: ["indie folk", "ambient"],
    confidence: 0.72,
    scores: {
      introspection: 5,
      nostalgia: 4,
      energy: 3,
      melancholy: 2,
      hope: 4,
      rebellion: 1,
      connection: 3,
    },
    emotions: DEFAULT_EMOTIONS,
    music: DEFAULT_MUSIC,
    poeticSummary: "A quiet map of where you've been.",
    // Derive from buildPosterModel so the required visual: PosterVisual field
    // (added in c9fb515) stays in sync — never hand-write poster literals.
    poster: buildPosterModel("The Wanderer", "Seeker of Sound", DEFAULT_EMOTIONS, DEFAULT_MUSIC),
    ...overrides,
  };
}

describe("AIPersonalityCard", () => {
  it("renders a placeholder when no profile is supplied", () => {
    render(<AIPersonalityCard profile={null} />);
    expect(
      screen.getByText(/complete your journey to unlock your personality profile/i),
    ).toBeInTheDocument();
  });

  it("renders the archetype, title, and description", () => {
    render(<AIPersonalityCard profile={buildProfile()} />);
    expect(screen.getByRole("heading", { name: "The Wanderer" })).toBeInTheDocument();
    expect(screen.getByText("Seeker of Sound")).toBeInTheDocument();
    expect(screen.getByText(/collecting moments of meaning/i)).toBeInTheDocument();
  });

  it("renders the poetic summary when present", () => {
    render(<AIPersonalityCard profile={buildProfile()} />);
    expect(screen.getByText(/A quiet map of where you've been/i)).toBeInTheDocument();
  });

  it("omits the poetic summary block when it is empty", () => {
    render(<AIPersonalityCard profile={buildProfile({ poeticSummary: "" })} />);
    expect(screen.queryByText(/A quiet map/i)).not.toBeInTheDocument();
  });

  it("lists emotional profile, traits, and recommended genres", () => {
    render(<AIPersonalityCard profile={buildProfile()} />);
    expect(screen.getByText("nostalgic")).toBeInTheDocument();
    expect(screen.getByText("hopeful")).toBeInTheDocument();
    expect(screen.getByText("curious")).toBeInTheDocument();
    expect(screen.getByText("reflective")).toBeInTheDocument();
    expect(screen.getByText("indie folk")).toBeInTheDocument();
    expect(screen.getByText("ambient")).toBeInTheDocument();
  });

  it("prefers grounded topGenres over the legacy Q&A-predicted genres", () => {
    render(<AIPersonalityCard profile={buildProfile()} topGenres={["Metal", "Rock", "Jazz"]} />);
    expect(screen.getByText("Metal")).toBeInTheDocument();
    expect(screen.getByText("Rock")).toBeInTheDocument();
    expect(screen.getByText("Jazz")).toBeInTheDocument();
    // Legacy prediction must not leak through when grounded data exists.
    expect(screen.queryByText("indie folk")).not.toBeInTheDocument();
    expect(screen.queryByText("ambient")).not.toBeInTheDocument();
  });

  it("falls back to legacy recommendedGenres when topGenres is empty", () => {
    render(<AIPersonalityCard profile={buildProfile()} topGenres={[]} />);
    expect(screen.getByText("indie folk")).toBeInTheDocument();
    expect(screen.getByText("ambient")).toBeInTheDocument();
  });

  it("renders confidence as a rounded percentage", () => {
    render(<AIPersonalityCard profile={buildProfile({ confidence: 0.725 })} />);
    // Math.round(0.725 * 100) === 73
    expect(screen.getByText("73%")).toBeInTheDocument();
  });

  it("renders 0% confidence when confidence is missing/zero", () => {
    render(<AIPersonalityCard profile={buildProfile({ confidence: 0 })} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders gracefully when optional arrays are empty", () => {
    render(
      <AIPersonalityCard
        profile={buildProfile({
          emotionalProfile: [],
          traits: [],
          recommendedGenres: [],
        })}
      />,
    );
    // Core identity is still present; no list items crash.
    expect(screen.getByRole("heading", { name: "The Wanderer" })).toBeInTheDocument();
  });
});
