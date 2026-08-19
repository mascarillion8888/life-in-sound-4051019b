import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AIPersonalityCard } from "./AIPersonalityCard";
import type { PersonalityProfile } from "@/lib/ai/types";

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
    emotions: { dominantEmotion: "nostalgia", secondaryEmotions: ["hope"], intensity: 0.6 },
    music: {
      primaryGenres: ["indie folk"],
      secondaryGenres: ["ambient"],
      mood: "bittersweet",
      listeningStyle: "album-oriented",
    },
    poeticSummary: "A quiet map of where you've been.",
    poster: {
      headline: "The Wanderer",
      subheadline: "Seeker of Sound",
      archetype: "The Wanderer",
      paletteLabel: "Dusk",
      keywords: ["drift", "memory"],
    },
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
