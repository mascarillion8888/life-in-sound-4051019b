import { describe, expect, it } from "vitest";

import { trackToSong } from "./itunes-mapping";
import { normalizeGenre } from "@/lib/visual/assetRegistry";

/**
 * Genre normalization regression tests — uses REAL iTunes primaryGenreName
 * values observed from live API calls (2026-09-30 sampling of 27 artists).
 * These are canned payloads; NO network calls are made.
 *
 * Each test case: (artist, track, iTunes primaryGenreName) → expected normalized GenreId
 * The expected value is what the backdrop registry / scene theme will consume.
 */

interface TestCase {
  artist: string;
  title: string;
  primaryGenreName: string;
  expectedGenreId: string | null; // null means no genre / unknown
  description?: string;
}

const TEST_CASES: TestCase[] = [
  // POP family
  { artist: "Madonna", title: "Like a Prayer", primaryGenreName: "Pop", expectedGenreId: "pop" },
  { artist: "Taylor Swift", title: "Shake It Off", primaryGenreName: "Pop", expectedGenreId: "pop" },
  { artist: "Michael Jackson", title: "Billie Jean", primaryGenreName: "Pop", expectedGenreId: "pop" },
  { artist: "Bee Gees", title: "Stayin' Alive", primaryGenreName: "Pop", expectedGenreId: "pop" },
  { artist: "Whitney Houston", title: "I Will Always Love You", primaryGenreName: "R&B/Soul", expectedGenreId: "soul" },
  { artist: "The Weeknd", title: "Blinding Lights", primaryGenreName: "R&B/Soul", expectedGenreId: "soul" },
  { artist: "Stevie Wonder", title: "Superstition", primaryGenreName: "R&B/Soul", expectedGenreId: "soul" },
  { artist: "Prince", title: "Purple Rain", primaryGenreName: "Pop", expectedGenreId: "pop" },
  { artist: "Prince", title: "I Wanna Be Your Lover", primaryGenreName: "R&B/Soul", expectedGenreId: "soul" },
  { artist: "Daft Punk", title: "One More Time", primaryGenreName: "Dance", expectedGenreId: "synth" },
  { artist: "Daft Punk", title: "Get Lucky", primaryGenreName: "Pop", expectedGenreId: "pop" },
  { artist: "Enya", title: "Only Time", primaryGenreName: "Pop", expectedGenreId: "pop" }, // known mislabel; new age fallback missing

  // ROCK / METAL family
  { artist: "The Beatles", title: "Here Comes The Sun", primaryGenreName: "Rock", expectedGenreId: "rock" },
  { artist: "Led Zeppelin", title: "Stairway to Heaven", primaryGenreName: "Rock", expectedGenreId: "rock" },
  { artist: "Led Zeppelin", title: "Whole Lotta Love", primaryGenreName: "Hard Rock", expectedGenreId: "rock" },
  { artist: "Metallica", title: "Enter Sandman", primaryGenreName: "Metal", expectedGenreId: "rock" },
  { artist: "AC/DC", title: "Back In Black", primaryGenreName: "Hard Rock", expectedGenreId: "rock" },
  { artist: "Nirvana", title: "Smells Like Teen Spirit", primaryGenreName: "Rock", expectedGenreId: "rock" },
  { artist: "Nirvana", title: "Heart-Shaped Box", primaryGenreName: "Alternative", expectedGenreId: "grunge" },
  { artist: "Green Day", title: "Basket Case", primaryGenreName: "Alternative", expectedGenreId: "grunge" },
  { artist: "Pink Floyd", title: "Wish You Were Here", primaryGenreName: "Rock", expectedGenreId: "rock" },
  { artist: "David Bowie", title: "Heroes", primaryGenreName: "Pop", expectedGenreId: "pop" }, // known mislabel
  { artist: "Elvis Presley", title: "Jailhouse Rock", primaryGenreName: "Rock", expectedGenreId: "rock" },

  // HIP-HOP / RAP family
  { artist: "Run-D.M.C.", title: "It's Tricky", primaryGenreName: "Hip-Hop/Rap", expectedGenreId: "hiphop" },
  { artist: "Kendrick Lamar", title: "HUMBLE.", primaryGenreName: "Hip-Hop/Rap", expectedGenreId: "hiphop" },
  { artist: "Eminem", title: "Lose Yourself", primaryGenreName: "Soundtrack", expectedGenreId: "acoustic" },
  { artist: "Eminem", title: "Without Me", primaryGenreName: "Hip-Hop/Rap", expectedGenreId: "hiphop" },
  { artist: "Snoop Dogg", title: "Snoop Dogg (What's My Name, Pt. 2)", primaryGenreName: "Hip-Hop/Rap", expectedGenreId: "hiphop" },
  { artist: "Bad Bunny", title: "NUEVAYoL", primaryGenreName: "Latin", expectedGenreId: "synth" },
  { artist: "Bad Bunny", title: "LA CANCIÓN", primaryGenreName: "Urbano latino", expectedGenreId: "synth" },

  // REGGAE family
  { artist: "Bob Marley", title: "Three Little Birds", primaryGenreName: "Reggae", expectedGenreId: "reggae" },
  { artist: "Buena Vista Social Club", title: "Chan Chan", primaryGenreName: "Worldwide", expectedGenreId: "acoustic" },

  // JAZZ family
  { artist: "Miles Davis", title: "So What", primaryGenreName: "Jazz", expectedGenreId: "jazz" },
  { artist: "John Coltrane", title: "My Favorite Things", primaryGenreName: "Jazz", expectedGenreId: "jazz" },
  { artist: "Billie Holiday", title: "Strange Fruit", primaryGenreName: "Jazz", expectedGenreId: "jazz" },
  { artist: "Frank Sinatra", title: "My Way", primaryGenreName: "Jazz", expectedGenreId: "jazz" },

  // SOUL / FUNK / R&B family
  { artist: "Aretha Franklin", title: "Respect", primaryGenreName: "R&B/Soul", expectedGenreId: "soul" },
  { artist: "Aretha Franklin", title: "I Say a Little Prayer", primaryGenreName: "Rock", expectedGenreId: "rock" }, // known mislabel
  { artist: "James Brown", title: "I Feel Good", primaryGenreName: "R&B/Soul", expectedGenreId: "soul" },
  { artist: "Amy Winehouse", title: "Rehab", primaryGenreName: "R&B/Soul", expectedGenreId: "soul" },
  { artist: "Amy Winehouse", title: "You Know I'm No Good", primaryGenreName: "Pop", expectedGenreId: "pop" },

  // COUNTRY / FOLK / ACOUSTIC family
  { artist: "Johnny Cash", title: "Ring of Fire", primaryGenreName: "Country", expectedGenreId: "acoustic" },
  { artist: "Bob Dylan", title: "Like a Rolling Stone", primaryGenreName: "Rock", expectedGenreId: "rock" },
  { artist: "Bob Dylan", title: "Tangled Up In Blue", primaryGenreName: "Singer/Songwriter", expectedGenreId: "acoustic" },
  { artist: "Bob Dylan", title: "Blowin' In the Wind", primaryGenreName: "Contemporary Folk", expectedGenreId: "acoustic" },
  { artist: "Neil Young", title: "Heart of Gold", primaryGenreName: "Rock", expectedGenreId: "rock" },

  // CLASSICAL / INSTRUMENTAL / NEW AGE
  { artist: "Mozart", title: "Eine Kleine Nachtmusik", primaryGenreName: "Instrumental", expectedGenreId: "new age" },
  { artist: "Mozart", title: "Turkish March", primaryGenreName: "New Age", expectedGenreId: "new age" },

  // K-POP / WORLD
  { artist: "BTS", title: "Boy With Luv", primaryGenreName: "K-Pop", expectedGenreId: "pop" },
  { artist: "Billie Eilish", title: "Bad Guy", primaryGenreName: "Alternative", expectedGenreId: "grunge" },
  { artist: "Radiohead", title: "Creep", primaryGenreName: "Alternative", expectedGenreId: "grunge" },
];

function makeTrack(tc: TestCase) {
  return {
    wrapperType: "track",
    kind: "song",
    trackId: 1,
    trackName: tc.title,
    artistName: tc.artist,
    collectionName: "Test Album",
    artworkUrl100: "https://example.com/100x100bb.jpg",
    releaseDate: "2000-01-01T00:00:00Z",
    primaryGenreName: tc.primaryGenreName,
  };
}

describe("genre normalization: real iTunes primaryGenreName → GenreId", () => {
  for (const tc of TEST_CASES) {
    it(`${tc.artist} — "${tc.title}" — iTunes: "${tc.primaryGenreName}" → ${tc.expectedGenreId}`, () => {
      const track = makeTrack(tc);
      const song = trackToSong(track);
      expect(song).not.toBeNull();
      expect(song!.genre).toBe(tc.expectedGenreId);
    });
  }
});

describe("normalizeGenre() direct unit tests (edge cases)", () => {
  it("returns null for null/undefined/empty", () => {
    expect(normalizeGenre(null)).toBeNull();
    expect(normalizeGenre(undefined)).toBeNull();
    expect(normalizeGenre("")).toBeNull();
    expect(normalizeGenre("   ")).toBeNull();
  });

  it("case-insensitive and trims whitespace", () => {
    expect(normalizeGenre("  POP  ")).toBe("pop");
    expect(normalizeGenre("Rock")).toBe("rock");
    expect(normalizeGenre("HIP-HOP/RAP")).toBe("hiphop");
  });

  it("unknown genre falls through as lowercase (no fabrication)", () => {
    expect(normalizeGenre("UnknownGenre123")).toBe("unknowngenre123");
    expect(normalizeGenre("Some Weird Genre")).toBe("some weird genre");
  });

  it("newly added aliases resolve correctly", () => {
    expect(normalizeGenre("Country")).toBe("acoustic");
    expect(normalizeGenre("Folk")).toBe("acoustic");
    expect(normalizeGenre("Singer/Songwriter")).toBe("acoustic");
    expect(normalizeGenre("Classical")).toBe("new age");
    expect(normalizeGenre("Instrumental")).toBe("new age");
    expect(normalizeGenre("Holiday")).toBe("new age");
    expect(normalizeGenre("Latin")).toBe("synth");
    expect(normalizeGenre("Urbano latino")).toBe("synth");
    expect(normalizeGenre("K-Pop")).toBe("pop");
    expect(normalizeGenre("World")).toBe("acoustic");
    expect(normalizeGenre("Soundtrack")).toBe("acoustic");
    expect(normalizeGenre("Blues")).toBe("jazz");
    expect(normalizeGenre("Gospel")).toBe("soul");
  });
});