import { useState } from "react";
import { Check, Loader2, Music2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchSongs } from "@/lib/song/searchSong.server";
import type { Song } from "@/lib/song/types";

type SearchStatus = "idle" | "loading" | "ready" | "empty" | "error";

// "artist — album" for a song, never a leading or trailing dash when one part
// is missing. Mirrors displayName's contract so the result list and the
// selected chip read consistently.
function metaLine(song: Song): string {
  const parts = [song.artist, song.album].filter((p): p is string => Boolean(p));
  return parts.join(" — ");
}

// Build a manual Song (provider: "manual") from free text. The typed string
// becomes the title; no artist/album/artwork is inferred. This is the primary
// path — MusicBrainz is optional and only enriches artwork/metadata.
function manualSong(text: string): Song {
  return {
    provider: "manual",
    providerId: crypto.randomUUID(),
    title: text,
    artist: "",
    album: null,
    artworkUrl: null,
    isrc: null,
  };
}

// "title — artist" for prefilling the text box after an optional MusicBrainz
// selection, or the title alone when the artist is empty (manual entries).
function songDisplay(song: Song): string {
  return song.artist ? `${song.title} — ${song.artist}` : song.title;
}

export function QuestionCard({
  number,
  title,
  description,
  answer,
  selected,
  draft,
  onDraftChange,
  onChoose,
}: {
  number: number;
  title: string;
  description: string;
  /** Title string shown while no structured selection is present (restore case). */
  answer?: string;
  /** Structured Song chosen for this question, when available. */
  selected?: Song | null;
  /** Current text in the primary free-text box (owned by the parent). */
  draft: string;
  /** Update the primary free-text box. */
  onDraftChange: (text: string) => void;
  onChoose: (song: Song) => void;
}) {
  const [open, setOpen] = useState(false);

  const displayName = selected
    ? selected.artist
      ? `${selected.title} — ${selected.artist}`
      : selected.title
    : answer;
  const canConfirm = draft.trim().length > 0;

  return (
    <div className="w-full rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
      <div className="space-y-4">
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">
          Question {number}
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h2>
        <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">{description}</p>
      </div>

      {/* PRIMARY path: free-text entry, no search/validation required. */}
      <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-stretch">
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canConfirm) {
              e.preventDefault();
              onChoose(manualSong(draft.trim()));
            }
          }}
          placeholder="örn. Bad - Michael Jackson"
          aria-label="Şarkı ve sanatçı adını yaz"
          className="h-14 flex-1 rounded-2xl border-border/50 bg-background/60 text-base sm:h-16"
        />
        <Button
          onClick={() => onChoose(manualSong(draft.trim()))}
          disabled={!canConfirm}
          className="h-14 gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98] sm:h-16 sm:w-auto"
        >
          <Check className="h-5 w-5" />
          Onayla
        </Button>
      </div>

      {/* SECONDARY/optional: MusicBrainz search for artwork/metadata. Not required. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <Search className="h-3.5 w-3.5" />
        Kapak görseli için ara (opsiyonel)
      </button>

      {displayName ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Check className="h-4 w-4" />
          {displayName}
        </p>
      ) : null}

      <SongPickerDialog
        open={open}
        onOpenChange={setOpen}
        onChoose={(song) => {
          onChoose(song);
          onDraftChange(songDisplay(song));
          setOpen(false);
        }}
      />
    </div>
  );
}

function SongPickerDialog({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (song: Song) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<Song[]>([]);

  async function runSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setStatus("idle");
      setResults([]);
      return;
    }
    setStatus("loading");
    try {
      const { results: songs } = await searchSongs({ data: { query: trimmed } });
      setResults(songs);
      setStatus(songs.length > 0 ? "ready" : "empty");
    } catch {
      setResults([]);
      setStatus("error");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          // Reset on close so reopening starts fresh.
          setQuery("");
          setResults([]);
          setStatus("idle");
        }
      }}
    >
      <DialogContent className="border-border/50 bg-card/95 text-foreground sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Kapak görseli için ara</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Opsiyoneldir — seçmek başlık, sanatçı ve kapak görselini doldurur. Sonuçlar MusicBrainz'den gelir
            (tüketici arama motoru değildir; aradığınız kayıt üstte çıkmayabilir).
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a song or artist…"
              className="pl-9"
              aria-label="Search for a song"
            />
          </div>
          <Button type="submit" disabled={status === "loading" || query.trim().length < 2}>
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        <div className="max-h-[40vh] overflow-y-auto">
          {status === "ready" ? (
            <ul className="divide-y divide-border/40">
              {results.map((song) => (
                <li key={`${song.provider}:${song.providerId}`}>
                  <button
                    type="button"
                    onClick={() => onChoose(song)}
                    className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-primary/5"
                  >
                    {song.artworkUrl ? (
                      <img
                        src={song.artworkUrl}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10">
                        <Music2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {song.title}
                      </span>
                      {metaLine(song) ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {metaLine(song)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <SearchState status={status} />
          )}
        </div>

        <DialogFooter className="text-xs text-muted-foreground sm:justify-start">
          Artwork, when available, is provided by the Cover Art Archive. A song stays selectable
          even without artwork.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SearchState({ status }: { status: SearchStatus }) {
  if (status === "loading") {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Searching…
      </p>
    );
  }
  if (status === "empty") {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No results. Try another search.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Search is unavailable right now. Please try again.
      </p>
    );
  }
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Type a song or artist and press Search.
    </p>
  );
}
