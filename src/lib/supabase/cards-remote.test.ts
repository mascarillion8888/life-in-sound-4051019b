import { describe, expect, it } from "vitest";

import { toCardRow } from "./cards-remote";

const VALID_RAW = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  track_key: "itunes:123",
  title: "Fragile",
  artist: "Sting",
  genre: "Gothic Folk",
  release_year: 1987,
  birth_year: 1978,
  encounter_age: 9,
  era_year: 1987,
  user_memory: null,
  scene: "gothic",
  lore: "A child hums along. The song never leaves.",
  image_path: "user/card.png",
  created_at: "2026-08-26T00:00:00Z",
};

describe("toCardRow", () => {
  it("maps a valid snake_case row into the camelCase CardRow", () => {
    const row = toCardRow(VALID_RAW);
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      id: VALID_RAW.id,
      trackKey: "itunes:123",
      title: "Fragile",
      artist: "Sting",
      genre: "Gothic Folk",
      releaseYear: 1987,
      birthYear: 1978,
      encounterAge: 9,
      eraYear: 1987,
      userMemory: null,
      scene: "gothic",
      imagePath: "user/card.png",
    });
  });

  it("drops rows missing the identity fields (id / title / track_key)", () => {
    expect(toCardRow({ ...VALID_RAW, id: "" })).toBeNull();
    expect(toCardRow({ ...VALID_RAW, title: "   " })).toBeNull();
    expect(toCardRow({ ...VALID_RAW, track_key: undefined })).toBeNull();
    expect(toCardRow(null)).toBeNull();
    expect(toCardRow("not a row")).toBeNull();
  });

  it("sanitizes malformed optional fields instead of crashing", () => {
    const row = toCardRow({
      ...VALID_RAW,
      artist: 42,
      genre: "",
      release_year: "nineteen eighty seven",
      encounter_age: Number.NaN,
      scene: "",
      created_at: null,
    });
    expect(row).not.toBeNull();
    expect(row?.artist).toBe("");
    expect(row?.genre).toBeNull();
    expect(row?.releaseYear).toBeNull();
    expect(row?.encounterAge).toBeNull();
    expect(row?.scene).toBe("gothic");
    expect(row?.createdAt).toBe(new Date(0).toISOString());
  });
});
