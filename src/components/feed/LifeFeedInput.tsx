import { useEffect, useMemo, useState } from "react";
import { Check, CornerDownLeft, Disc3, Music, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Song } from "@/lib/song/types";
import { suggestSongs } from "@/lib/song/searchSong.server";

/** A suggestion provider, injectable for tests. Defaults to iTunes via the server boundary. */
export type SongSuggester = (query: string) => Promise<Song[]>;

const defaultSuggester: SongSuggester = (query) =>
  suggestSongs({ data: { query } })
    .then((r) => r?.results ?? [])
    .catch(() => []);

function manualSong(title: string): Song {
  return {
    provider: "manual",
    providerId: crypto.randomUUID(),
    title: title.trim(),
    artist: "",
    album: null,
    artworkUrl: null,
    releaseYear: null,
    isrc: null,
  };
}

/**
 * Life Feed Quick Entry Bar.
 *
 * Minimal song picker (iTunes suggestions ranked by Fuse.js through the
 * existing `suggestSongs` server function; free text always falls back to a
 * manual Song — exactly like the journey's QuestionCard) plus an optional
 * memory/mood note. Submitting hands the pair to the feed owner; the instant
 * insight is the owner's concern, not this component's.
 */
export function LifeFeedInput({
  onAdd,
  pending = false,
  suggester = defaultSuggester,
  debounceMs = 250,
}: {
  onAdd: (input: { song: Song; note: string | null }) => void;
  pending?: boolean;
  suggester?: SongSuggester;
  debounceMs?: number;
}) {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Song | null>(null);
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    if (selected || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const current = setTimeout(() => {
      suggester(query.trim())
        .then((songs) => {
          if (active) setSuggestions(songs);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        });
    }, debounceMs);
    return () => {
      clearTimeout(current);
      active = false;
    };
  }, [query, selected, suggester, debounceMs]);

  const canAdd = useMemo(() => selected !== null || query.trim().length > 0, [selected, query]);

  const choose = (song: Song) => {
    setSelected(song);
    setQuery("");
    setSuggestions([]);
    setListOpen(false);
  };

  const submit = () => {
    if (!canAdd || pending) return;
    const song = selected ?? manualSong(query);
    const trimmed = note.trim();
    onAdd({ song, note: trimmed.length > 0 ? trimmed : null });
    setQuery("");
    setNote("");
    setSelected(null);
    setListOpen(false);
  };

  return (
    <div className="rounded-[2rem] border border-border/50 bg-card/60 p-5 backdrop-blur-xl sm:p-8">
      <label
        htmlFor="life-feed-note"
        className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground"
      >
        Quick entry
      </label>

      {/* Memory / mood note. The prompt is the product's voice — a friend asking. */}
      <Textarea
        id="life-feed-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Bugün seni hangi şarkı anlatıyor?"
        aria-label="Bellek notu (optional)"
        className="mt-3 min-h-20 rounded-2xl border-border/50 bg-background/60 text-base"
      />

      {selected ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
          <Disc3 className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {selected.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {selected.artist || "Manual entry"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Seçimi kaldır"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions[0]) {
                e.preventDefault();
                choose(suggestions[0]);
              } else if (e.key === "Enter" && canAdd) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Şarkı veya sanatçı ara…"
            aria-label="Şarkı ara"
            className="h-12 rounded-2xl border-border/50 bg-background/60 pl-11 text-base"
          />
          {listOpen && suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border/60 bg-popover/95 shadow-xl backdrop-blur-xl">
              {suggestions.map((song) => (
                <li key={song.providerId}>
                  <button
                    type="button"
                    onClick={() => choose(song)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-primary/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {song.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {song.artist}
                      </span>
                    </span>
                    <CornerDownLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={!canAdd || pending}
        className="mt-4 h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Music className="mr-2 h-4 w-4" />
        {pending ? "Ekleniyor…" : "Haritaya Ekle"}
        {!pending && canAdd ? <Check className="ml-2 h-4 w-4" /> : null}
      </Button>
    </div>
  );
}
