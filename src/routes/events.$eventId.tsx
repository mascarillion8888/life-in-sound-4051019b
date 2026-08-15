import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MapPin, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import {
  attachMemoryToEvent,
  deleteEvent,
  detachMemoryFromEvent,
  loadEvent,
} from "@/lib/supabase/life-remote";
import { listMemories } from "@/lib/supabase/memory-remote";
import { MediaSection } from "@/components/media/MediaSection";
import type { EventDetail, Memory } from "@/lib/memory/types";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({
    meta: [{ title: "Life Event — Life in a Sound" }],
  }),
  component: EventDetailPage,
});

type LoadState = "loading" | "ready" | "notfound";

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const session = useSession();
  const userId = useUserId(session);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [event, setEvent] = useState<EventDetail | null>(null);

  async function load(id: string, uid: string) {
    setLoadState("loading");
    const ev = await loadEvent(uid, id);
    setEvent(ev);
    setLoadState(ev ? "ready" : "notfound");
  }

  useEffect(() => {
    if (!userId) return;
    void load(eventId, userId);
  }, [userId, eventId]);

  if (!userId || loadState === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-32 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading event…</p>
        </div>
      </Shell>
    );
  }

  if (loadState === "notfound" || !event) {
    return (
      <Shell>
        <p className="py-32 text-center text-sm text-muted-foreground">Event not found.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <EventDetailContent
        event={event}
        userId={userId}
        onChanged={async () => load(eventId, userId)}
      />
    </Shell>
  );
}

function EventDetailContent({
  event,
  userId,
  onChanged,
}: {
  event: EventDetail;
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [detaching, setDetaching] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setAllMemories(await listMemories(userId)))();
  }, [userId]);

  const attachedIds = useMemo(
    () => new Set(event.memories.map((m) => m.memoryId)),
    [event.memories],
  );
  const candidates = allMemories.filter((m) => !attachedIds.has(m.id));

  async function handleAttach(memoryId: string) {
    const ok = await attachMemoryToEvent(userId, event.id, memoryId, null, event.memories.length);
    if (ok) {
      setShowAttach(false);
      await onChanged();
    }
  }

  async function handleDetach(memoryId: string) {
    setDetaching(memoryId);
    await detachMemoryFromEvent(userId, event.id, memoryId);
    setDetaching(null);
    await onChanged();
  }

  async function handleDelete() {
    const ok = await deleteEvent(userId, event.id);
    if (ok) window.history.back();
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {event.title}
            </h1>
            {event.description && (
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            )}
          </div>
          <Button onClick={handleDelete} size="sm" variant="ghost">
            Delete
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {event.timeLabel && <span>{event.timeLabel}</span>}
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {event.location}
            </span>
          )}
          <Badge variant="outline" className="text-[10px]">
            {event.memories.length} memories
          </Badge>
        </div>
      </header>

      {event.chapters.length > 0 && (
        <section className="space-y-2">
          <SectionLabel>In chapters</SectionLabel>
          <ul className="flex flex-wrap gap-2">
            {event.chapters.map((c) => (
              <li key={c.chapterId}>
                <Link
                  to="/chapters/$chapterId"
                  params={{ chapterId: c.chapterId }}
                  className="rounded border border-border/40 px-2.5 py-1 text-sm transition-colors hover:bg-accent"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Memories</SectionLabel>
          <Button
            onClick={() => setShowAttach((v) => !v)}
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={candidates.length === 0}
          >
            <Plus className="size-3.5" /> Attach memory
          </Button>
        </div>

        {showAttach && (
          <ul className="space-y-1.5 rounded-md border border-border/40 p-2">
            {candidates.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => handleAttach(m.id)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium text-foreground">{memoryTitle(m)}</span>
                  {m.eventTime?.label && (
                    <span className="ml-2 text-xs text-muted-foreground">{m.eventTime.label}</span>
                  )}
                </button>
              </li>
            ))}
            {candidates.length === 0 && (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                All your memories are already attached.
              </li>
            )}
          </ul>
        )}

        {event.memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No memories attached yet.</p>
        ) : (
          <ul className="space-y-2">
            {event.memories.map((m) => (
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
                <Button
                  onClick={() => handleDetach(m.memoryId)}
                  size="sm"
                  variant="ghost"
                  disabled={detaching === m.memoryId}
                  className="gap-1.5"
                >
                  {detaching === m.memoryId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
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
          context="event"
          contextId={event.id}
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
            to="/events"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Events
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
