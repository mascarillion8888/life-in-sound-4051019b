/**
 * OrganicArtwork — embeds a song's real album cover natively into the card
 * scene instead of pasting it as a square thumbnail.
 *
 * The EraStyle's mount decides the presentation:
 *   - vinyl-sleeve:    sleeve with the record sliding out (grooved disc).
 *   - cassette-desk:   cassette J-card on a desk, spool window, neon underglow.
 *   - vintage-poster:  aged gig poster with fold lines and paper tint.
 *   - framed-portrait: matted gallery frame under a picture light.
 *
 * Every mount shares the scene's ambient lighting: the backdrop gradient is
 * the room, a screen-blend light wash + the era's color grading make the
 * cover feel lit by the same environment as the card around it. Only the
 * song's real artworkUrl is ever rendered — a missing cover is the caller's
 * placeholder concern, never a fabricated image.
 */
import type { EraStyle } from "@/lib/soundmap/eraStyle";
import type { Song } from "@/lib/song/types";

function SceneLight({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(ellipse at 50% 18%, ${color}2e 0%, transparent 62%)`,
        mixBlendMode: "screen",
      }}
    />
  );
}

function FloorShadow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-[6%] left-1/2 h-[7%] w-3/4 -translate-x-1/2 rounded-full"
      style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)" }}
    />
  );
}

function ArtworkImg({
  song,
  grading,
  className,
}: {
  song: Song;
  grading: string;
  className?: string;
}) {
  return (
    <img
      src={song.artworkUrl ?? undefined}
      alt={`${song.title} — ${song.artist}`}
      loading="lazy"
      className={className}
      style={{ filter: grading }}
    />
  );
}

/** Vinyl sleeve with the record sliding out to the right. */
function VinylSleeve({ song, style }: { song: Song; style: EraStyle }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* The record — grooved disc peeking out behind the sleeve. */}
      <span
        aria-hidden
        className="absolute left-[52%] top-1/2 aspect-square w-[62%] -translate-y-1/2 rounded-full border border-black/80"
        style={{
          background: `repeating-radial-gradient(circle at center, #0a0a0a 0px, #0a0a0a 2px, #1c1c1c 3px, #0a0a0a 4px)`,
          boxShadow: `0 4px 14px rgba(0,0,0,0.6), inset 0 0 0 1px ${style.palette.accent}22`,
        }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${style.palette.accent} 0%, #0a0a0a 96%)` }}
        />
      </span>
      {/* The sleeve itself. */}
      <span
        className="absolute left-[8%] top-1/2 aspect-square w-[62%] -translate-y-1/2 -rotate-1 overflow-hidden rounded-[3px] border border-[#2a2015]"
        style={{ boxShadow: `0 6px 18px rgba(0,0,0,0.65), 0 0 10px ${style.palette.accent}33` }}
      >
        <ArtworkImg song={song} grading={style.grading} className="h-full w-full object-cover" />
      </span>
      <FloorShadow />
    </div>
  );
}

/** Cassette J-card on a desk, spool window and neon underglow. */
function CassetteDesk({ song, style }: { song: Song; style: EraStyle }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span
        className="relative aspect-square w-[70%] -rotate-3 overflow-hidden rounded-[4px] border-[3px] border-[#e8e4da]/90"
        style={{
          boxShadow: `0 8px 20px rgba(0,0,0,0.6), 0 0 16px ${style.palette.accent}55, 0 0 34px ${style.palette.accent}22`,
        }}
      >
        <ArtworkImg song={song} grading={style.grading} className="h-full w-full object-cover" />
        {/* Tape window with the two spools, along the bottom edge. */}
        <span
          aria-hidden
          className="absolute bottom-[6%] left-1/2 flex h-[16%] w-[64%] -translate-x-1/2 items-center justify-between rounded-sm bg-black/70 px-[12%]"
        >
          {([0, 1] as const).map((i) => (
            <span
              key={i}
              aria-hidden
              className="aspect-square w-[22%] rounded-full border border-white/25"
              style={{
                background: `radial-gradient(circle, #d8d8d8 0%, #d8d8d8 28%, #3a3a3a 32%, #111 100%)`,
              }}
            />
          ))}
        </span>
      </span>
      <FloorShadow />
    </div>
  );
}

/** Aged gig poster: full-bleed artwork, fold lines, paper tint, pin shadow. */
function VintagePoster({ song, style }: { song: Song; style: EraStyle }) {
  return (
    <div className="absolute inset-[6%] overflow-hidden rounded-[2px]">
      <ArtworkImg song={song} grading={style.grading} className="h-full w-full object-cover" />
      {/* Aged paper tint. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ background: `linear-gradient(160deg, ${style.palette.accent}30, #3a2c18aa)` }}
      />
      {/* Fold lines — one horizontal, one vertical crease. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 49.4%, rgba(0,0,0,0.28) 50%, rgba(255,255,255,0.08) 50.6%, transparent 51.4%)," +
            "linear-gradient(to right, transparent 49.4%, rgba(0,0,0,0.22) 50%, rgba(255,255,255,0.07) 50.6%, transparent 51.4%)",
        }}
      />
      {/* Pin at the top + its shadow. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[2.5%] h-[3.5%] w-[3.5%] -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 35%, #fff9, ${style.palette.accent})`,
          boxShadow: "0 2px 4px rgba(0,0,0,0.7)",
        }}
      />
      {/* Worn edges. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(10,8,5,0.6) 100%)",
        }}
      />
    </div>
  );
}

/** Matted gallery frame on a wall, lit by a picture light. */
function FramedPortrait({ song, style }: { song: Song; style: EraStyle }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Picture light cone from above. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{
          background: `linear-gradient(to bottom, ${style.palette.light}26, transparent 75%)`,
          mixBlendMode: "screen",
        }}
      />
      <span
        className="relative aspect-square w-[74%] border-[6px] p-[6%]"
        style={{
          borderColor: "#2b2119",
          background: "#e6ddc8",
          boxShadow: `0 10px 24px rgba(0,0,0,0.7), inset 0 0 0 1px ${style.palette.accent}44, 0 0 12px ${style.palette.accent}22`,
        }}
      >
        <span
          className="block h-full w-full overflow-hidden"
          style={{ boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)" }}
        >
          <ArtworkImg song={song} grading={style.grading} className="h-full w-full object-cover" />
        </span>
      </span>
      <FloorShadow />
    </div>
  );
}

const SCENE_BY_MOUNT = {
  "vinyl-sleeve": VinylSleeve,
  "cassette-desk": CassetteDesk,
  "vintage-poster": VintagePoster,
  "framed-portrait": FramedPortrait,
} as const;

export function OrganicArtwork({ song, style }: { song: Song; style: EraStyle }) {
  const Scene = SCENE_BY_MOUNT[style.mount];
  return (
    <div
      data-testid="organic-artwork"
      data-mount={style.mount}
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `linear-gradient(to bottom, ${style.palette.backdrop[0]}, ${style.palette.backdrop[1]})`,
      }}
    >
      <Scene song={song} style={style} />
      <SceneLight color={style.palette.light} />
    </div>
  );
}
