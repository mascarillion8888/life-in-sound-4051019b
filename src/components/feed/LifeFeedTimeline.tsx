import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Check, Disc3, Pencil, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { groupFeedEntries, type LifeFeedEntry } from "@/lib/life-feed";

function formatAddedAt(iso: string): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, "d MMM yyyy") : "Undated";
}

function MomentCard({
  entry,
  onDelete,
  onEditNote,
}: {
  entry: LifeFeedEntry;
  onDelete: (id: string) => void;
  onEditNote: (id: string, note: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.note ?? "");

  const saveNote = () => {
    const trimmed = draft.trim();
    onEditNote(entry.id, trimmed.length > 0 ? trimmed : null);
    setEditing(false);
  };

  return (
    <article
      aria-label={`Life Feed entry: ${entry.song.title}`}
      className="flex gap-4 rounded-3xl border border-border/50 bg-card/50 p-4 backdrop-blur-xl sm:p-5"
    >
      {/* Cover art (or disc fallback) */}
      {entry.song.artworkUrl ? (
        <img
          src={entry.song.artworkUrl}
          alt={`${entry.song.title} cover art`}
          className="h-16 w-16 shrink-0 rounded-2xl border border-border/40 object-cover sm:h-20 sm:w-20"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border/40 bg-gradient-to-br from-primary/20 to-violet/20 sm:h-20 sm:w-20">
          <Disc3 className="h-6 w-6 text-primary" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground sm:text-base">
              {entry.song.title}
            </p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {entry.song.artist || "Manual entry"} · {formatAddedAt(entry.addedAt)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(entry.note ?? "");
                setEditing((v) => !v);
              }}
              aria-label={`Edit note for ${entry.song.title}`}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              aria-label={`Delete ${entry.song.title}`}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="mt-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Notu düzenle"
              className="min-h-16 rounded-xl border-border/50 bg-background/60 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={saveNote} className="h-8 rounded-full px-4">
                <Check className="mr-1 h-3.5 w-3.5" />
                Kaydet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
                className="h-8 rounded-full px-4"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Vazgeç
              </Button>
            </div>
          </div>
        ) : entry.note ? (
          <p className="mt-2 text-sm leading-relaxed text-foreground/75">“{entry.note}”</p>
        ) : null}

        {entry.insight ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm italic leading-relaxed text-primary/90">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {entry.insight}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Infinite Life Feed timeline: moment cards grouped into dynamic weekly or
 * monthly chapters (see groupFeedEntries). Editing a note or deleting an
 * entry flows back through life-feed state, which re-derives the emotional
 * curve on the poster automatically.
 */
export function LifeFeedTimeline({
  entries,
  onDelete,
  onEditNote,
}: {
  entries: LifeFeedEntry[];
  onDelete: (id: string) => void;
  onEditNote: (id: string, note: string | null) => void;
}) {
  const chapters = groupFeedEntries(entries);

  if (entries.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        The map is listening. Add the first song of your next chapter.
      </p>
    );
  }

  return (
    <ol className="space-y-8">
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {chapter.label}
            <span className="ml-2 normal-case tracking-normal text-muted-foreground/60">
              · {chapter.entries.length} {chapter.entries.length === 1 ? "moment" : "moments"}
            </span>
          </h4>
          <ol className="mt-3 space-y-3 border-l border-border/60 pl-4 sm:pl-5">
            {chapter.entries.map((entry) => (
              <li key={entry.id}>
                <MomentCard entry={entry} onDelete={onDelete} onEditNote={onEditNote} />
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
