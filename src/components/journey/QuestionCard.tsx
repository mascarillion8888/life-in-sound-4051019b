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

export function QuestionCard({
  number,
  title,
  description,
  answer,
  selected,
  onChoose,
}: {
  number: number;
  title: string;
  description: string;
  /** Title string shown while no structured selection is present (restore case). */
  answer?: string;
  /** Structured Song chosen for this question, when available. */
  selected?: Song | null;
  onChoose: (song: Song) => void;
}) {
  const [open, setOpen] = useState(false);

  const displayName = selected ? `${selected.title} — ${selected.artist}` : answer;

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

      <Button
        onClick={() => setOpen(true)}
        className="mt-8 h-14 w-full gap-3 sm:mt-10 sm:h-16 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]"
      >
        <Music2 className="h-5 w-5" />
        {selected ? "Change Song" : "Choose Song"}
      </Button>

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
          <DialogTitle className="text-xl">Choose a song</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Search for a real song by title and/or artist. Results come from MusicBrainz.
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
                      <span className="block truncate text-xs text-muted-foreground">
                        {song.artist}
                        {song.album ? ` — ${song.album}` : ""}
                      </span>
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
