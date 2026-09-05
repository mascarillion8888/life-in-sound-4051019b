import { Disc3 } from "lucide-react";

import type { Song } from "@/lib/song/types";
import { eraStyleFor } from "@/lib/soundmap/eraStyle";

import { OrganicArtwork } from "./OrganicArtwork";

interface SongUniverseCardProps {
  song: Song;
  index: number; // 0-7 —— journey position matches the era mount fallback table
}

/**
 * SongUniverseCard — one song, one universe.
 *
 * The card architecture stays consistent across all eight songs（kural 04）;
 * the real album artwork（ song.artworkUrl）is the visual anchor, embedded via
 * OrganicArtwork（kural 03）—— a missing cover renders a graceful disc
 * placeholder, never a fabricated image.The dynamic song information
 *（ title / artist / album? / releaseYear?）comes only from the verified Song fields.

 * Deterministic: identical Song always renders identically.
 */
export function SongUniverseCard({ song, index }: SongUniverseCardProps) {
  const style = eraStyleFor(song, index);
  const hasArtwork = Boolean(song.artworkUrl);

  return (
    <article
      aria-label={`${song.title} universe`}
      className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/60 backdrop-blur-xl"
      data-testid="song-universe-card"
      data-card-index={index}
    >
      {/* World —— the era-styled scene behind the artifact: real artwork (or disc placeholder). */}
      <div className="relative aspect-square overflow-hidden">
        {hasArtwork ? (
          <OrganicArtwork song={song} style={style} />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom, ${style.palette.backdrop[0]}, ${style.palette.backdrop[1]})`,
            }}
          >
            <Disc3 className="h-16 w-16 text-primary/60" />
          </div>
        )}

        {/* Track number —— small universe index badge */}
        <span className="absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card/80 text-xs font-semibold text-foreground/80 backdrop-blur-md">
          {index + 1}
        </span>
      </div>

      {/* Artifact —— the song identity layer（ kural 02： identity≠emotion） */}
      <div className="space-y-1 p-5">
        <p className="truncate text-base font-semibold text-foreground" title={song.title}>
          {song.title}
        </p>
        {song.artist ? (
          <p className="truncate text-sm text-muted-foreground" title={song.artist}>
            {song.artist}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          {song.album ? (
            <span className="truncate max-w-full" title={song.album}>
              {song.album}
            </span>
          ) : null}
          {typeof song.releaseYear === "number" ? <span>{song.releaseYear}</span> : null}
        </div>
      </div>
    </article>
  );
}

export default SongUniverseCard;
