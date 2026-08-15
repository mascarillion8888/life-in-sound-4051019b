import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import {
  attachEventToChapter,
  attachMemoryToChapter,
  deleteChapter,
  detachEventFromChapter,
  detachMemoryFromChapter,
  loadChapter,
} from "@/lib/supabase/life-remote";
import { listMemories } from "@/lib/supabase/memory-remote";
import { listEvents } from "@/lib/supabase/life-remote";
import { MediaSection } from "@/components/media/MediaSection";
import type { ChapterDetail, LifeEvent, Memory } from "@/lib/memory/types";

export const Route = createFileRoute("/chapters/$chapterId")({
  head: () => ({
    meta: [{ title: "Life Chapter — Life in a Sound" }],
  }),
  component: ChapterDetailPage,
});

type LoadState = "loading" | "ready" | "notfound";

function ChapterDetailPage() {
  const { chapterId } = Route.useParams();
  const session = useSession();
  const userId = useUserId(session);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);

  async function load(id: string, uid: string) {
    setLoadState("loading");
    const ch = await loadChapter(uid, id);
    setChapter(ch);
    setLoadState(ch ? "ready" : "notfound");
  }

  useEffect(() => {
    if (!userId) return;
    void load(chapterId, userId);
  }, [userId, chapterId]);

  if (!userId || loadState === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-32 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading chapter…</p>
        </div>
      </Shell>
    );
  }

  if (loadState === "notfound" || !chapter) {
    return (
      <Shell>
        <p className="py-32 text-center text-sm text-muted-foreground">Chapter not found.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <ChapterDetailContent
        chapter={chapter}
        userId={userId}
        onChanged={async () => load(chapterId, userId)}
      />
    </Shell>
  );
}

function ChapterDetailContent({
  chapter,
  userId,
  onChanged,
}: {
  chapter: ChapterDetail;
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const [allEvents, setAllEvents] = useState<LifeEvent[]>([]);
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [showAttachEvent, setShowAttachEvent] = useState(false);
  const [showAttachMemory, setShowAttachMemory] = useState(false);

  useEffect(() => {
    void (async () => {
      setAllEvents(await listEvents(userId));
      setAllMemories(await listMemories(userId));
    })();
  }, [userId]);

  const attachedEventIds = useMemo(
    () => new Set(chapter.events.map((e) => e.eventId)),
    [chapter.events],
  );
  const attachedMemoryIds = useMemo(
    () => new Set(chapter.directMemories.map((m) => m.memoryId)),
    [chapter.directMemories],
  );
  const candidateEvents = allEvents.filter((e) => !attachedEventIds.has(e.id));
  const candidateMemories = allMemories.filter((m) => !attachedMemoryIds.has(m.id));

  async function handleAttachEvent(eventId: string) {
    const ok = await attachEventToChapter(userId, chapter.id, eventId, chapter.events.length);
    if (ok) {
      setShowAttachEvent(false);
      await onChanged();
    }
  }

  async function handleAttachMemory(memoryId: string) {
    const ok = await attachMemoryToChapter(
      userId,
      chapter.id,
      memoryId,
      chapter.directMemories.length,
    );
    if (ok) {
      setShowAttachMemory(false);
      await onChanged();
    }
  }

  async function handleDetachEvent(eventId: string) {
    await detachEventFromChapter(userId, chapter.id, eventId);
    await onChanged();
  }

  async function handleDetachMemory(memoryId: string) {
    await detachMemoryFromChapter(userId, chapter.id, memoryId);
    await onChanged();
  }

  async function handleDelete() {
    const ok = await deleteChapter(userId, chapter.id);
    if (ok) window.history.back();
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {chapter.title}
            </h1>
            {chapter.description && (
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {chapter.description}
              </p>
            )}
          </div>
          <Button onClick={handleDelete} size="sm" variant="ghost">
            Delete
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {chapter.timeLabel && <span>{chapter.timeLabel}</span>}
          <Badge variant="outline" className="text-[10px]">
            {chapter.events.length} events
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {chapter.directMemories.length} direct memories
          </Badge>
        </div>
      </header>

      {/* Events */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Events</SectionLabel>
          <Button
            onClick={() => setShowAttachEvent((v) => !v)}
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={candidateEvents.length === 0}
          >
            <Plus className="size-3.5" /> Attach event
          </Button>
        </div>

        {showAttachEvent && (
          <ul className="space-y-1.5 rounded-md border border-border/40 p-2">
            {candidateEvents.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => handleAttachEvent(e.id)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium text-foreground">{e.title}</span>
                  {e.timeLabel && (
                    <span className="ml-2 text-xs text-muted-foreground">{e.timeLabel}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {chapter.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events in this chapter yet.</p>
        ) : (
          <ul className="space-y-2">
            {chapter.events.map((e) => (
              <li
                key={e.eventId}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/40 p-3"
              >
                <Link
                  to="/events/$eventId"
                  params={{ eventId: e.eventId }}
                  className="flex-1 space-y-0.5"
                >
                  <p className="text-sm font-medium text-foreground">{e.title}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {e.timeLabel && <span>{e.timeLabel}</span>}
                    {e.location && <span>· {e.location}</span>}
                    <span>· {e.memoryCount} memories</span>
                  </div>
                </Link>
                <Button onClick={() => handleDetachEvent(e.eventId)} size="sm" variant="ghost">
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Direct Memories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Direct memories</SectionLabel>
          <Button
            onClick={() => setShowAttachMemory((v) => !v)}
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={candidateMemories.length === 0}
          >
            <Plus className="size-3.5" /> Attach memory
          </Button>
        </div>

        {showAttachMemory && (
          <ul className="space-y-1.5 rounded-md border border-border/40 p-2">
            {candidateMemories.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => handleAttachMemory(m.id)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium text-foreground">{memoryTitle(m)}</span>
                  {m.eventTime?.label && (
                    <span className="ml-2 text-xs text-muted-foreground">{m.eventTime.label}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {chapter.directMemories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No direct memories in this chapter yet.</p>
        ) : (
          <ul className="space-y-2">
            {chapter.directMemories.map((m) => (
              <li
                key={m.memoryId}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/40 p-3"
              >
                <Link
                  to="/memory/$memoryId"
                  params={{ memoryId: m.memoryId }}
                  className="flex-1 space-y-0.5"
                >
                  <p className="text-sm font-medium text-foreground">{m.title}</p>
                  {m.excerpt && (
                    <p className="text-xs leading-relaxed text-muted-foreground">{m.excerpt}</p>
                  )}
                  {m.eventTimeLabel && (
                    <p className="text-xs text-muted-foreground">{m.eventTimeLabel}</p>
                  )}
                </Link>
                <Button onClick={() => handleDetachMemory(m.memoryId)} size="sm" variant="ghost">
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* MEDIA */}
      <section className="space-y-3 border-t border-border/40 pt-8">
        <MediaSection
          userId={userId}
          context="chapter"
          contextId={chapter.id}
          onChanged={async () => {}}
        />
      </section>
    </div>
  );
}

function memoryTitle(m: Memory): string {
  const first = m.musicExperiences[0]?.experience;
  return (
    [first?.title, first?.artist].filter((p) => p && p.trim().length > 0).join(" — ") ||
    "Untitled memory"
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-40" />
      <main className="relative z-10 mx-auto min-h-screen max-w-3xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-8">
          <Link
            to="/chapters"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Chapters
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}
