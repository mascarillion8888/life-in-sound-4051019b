import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Cloud,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Music,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import {
  addReflection,
  createConnection,
  deleteConnection,
  findRelatedMemories,
  listConnectionsForMemory,
  listMemories,
  listReflections,
  loadMemory,
} from "@/lib/supabase/memory-remote";
import { reflectOnMemory } from "@/lib/llm/reflectOnMemory.server";
import { suggestConnection } from "@/lib/llm/suggestConnection.server";
import { listPatterns } from "@/lib/supabase/patterns-remote";
import { MediaSection } from "@/components/media/MediaSection";
import type { Memory, Pattern, RelatedMemory, Reflection } from "@/lib/memory/types";

export const Route = createFileRoute("/memory/$memoryId")({
  head: () => ({
    meta: [{ title: "Memory — Life in a Sound" }],
  }),
  component: MemoryDetailPage,
});

type LoadState = "loading" | "ready" | "notfound";

function MemoryDetailPage() {
  const { memoryId } = Route.useParams();
  const session = useSession();
  const userId = useUserId(session);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [memory, setMemory] = useState<Memory | null>(null);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [related, setRelated] = useState<RelatedMemory[]>([]);
  const [patternCount, setPatternCount] = useState(0);

  async function loadAll(id: string, uid: string) {
    setLoadState("loading");
    const mem = await loadMemory(uid, id);
    if (!mem) {
      setLoadState("notfound");
      return;
    }
    setMemory(mem);
    const refs = await listReflections(uid, id);
    setReflections(refs);
    const rel = await findRelatedMemories(uid, id);
    setRelated(rel);
    // Lightweight: just the count of existing patterns for a preview link.
    // Does NOT run a pattern scan on every render.
    const pats = await listPatterns(uid, false);
    setPatternCount(pats.length);
    setLoadState("ready");
  }

  useEffect(() => {
    if (!userId) return;
    void loadAll(memoryId, userId);
  }, [memoryId, userId]);

  if (loadState === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-32 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your memory…</p>
        </div>
      </Shell>
    );
  }

  // notfound also covers cross-user: loadMemory returns null when the memory
  // is absent OR not owned by the user (RLS / .eq("user_id", userId)).
  if (loadState === "notfound" || !memory) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-32 text-center">
          <h1 className="text-xl font-semibold text-foreground">This memory isn't available</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            It may have been deleted, or it doesn't belong to this account.
          </p>
          <div className="flex gap-3">
            <Link to="/memory">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="size-4" /> Memories
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost">Home</Button>
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <MemoryDetailContent
        memory={memory}
        reflections={reflections}
        related={related}
        patternCount={patternCount}
        userId={userId}
        onReflectionsChanged={async () => {
          if (userId) setReflections(await listReflections(userId, memoryId));
        }}
        onConnectionsChanged={async () => {
          if (userId) setRelated(await findRelatedMemories(userId, memoryId));
        }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-40" />
      <main className="relative z-10 mx-auto min-h-screen max-w-3xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-8">
          <Link
            to="/memory"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Memories
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}

function MemoryDetailContent({
  memory,
  reflections,
  related,
  patternCount,
  userId,
  onReflectionsChanged,
  onConnectionsChanged,
}: {
  memory: Memory;
  reflections: Reflection[];
  related: RelatedMemory[];
  patternCount: number;
  userId: string | null;
  onReflectionsChanged: () => Promise<void>;
  onConnectionsChanged: () => Promise<void>;
}) {
  const music = memory.musicExperiences.slice().sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-12">
      {/* MEMORY HEADER */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Music className="size-3.5" /> Music memory
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {memoryTitle(memory)}
        </h1>
        <ContextChips memory={memory} />
      </header>

      {/* MUSIC */}
      <section className="space-y-2">
        <SectionLabel>Music</SectionLabel>
        <ul className="space-y-1.5">
          {music.map((e) => {
            const label =
              [e.experience.title, e.experience.artist]
                .filter((p) => p && p.trim().length > 0)
                .join(" — ") || "Unnamed music";
            return (
              <li key={e.musicExperienceId} className="text-base text-foreground/90">
                {label}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ORIGINAL MEMORY */}
      <section className="space-y-2">
        <SectionLabel>Original memory</SectionLabel>
        <blockquote className="border-l-2 border-border pl-4 text-base leading-relaxed text-foreground/80">
          {memory.originalUserNote ?? memory.userNote ?? "(no original note)"}
        </blockquote>
        {memory.userNote && memory.userNote !== memory.originalUserNote && (
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current note
            </p>
            <p className="text-sm leading-relaxed text-foreground/70">{memory.userNote}</p>
          </div>
        )}
      </section>

      {/* REFLECTIONS */}
      <section className="space-y-4">
        <SectionLabel>Reflections</SectionLabel>
        {reflections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reflections yet. Come back any time.</p>
        ) : (
          <ul className="space-y-5">
            {reflections.map((r) => (
              <ReflectionItem key={r.id} reflection={r} />
            ))}
          </ul>
        )}
      </section>

      {/* RELATED MEMORIES */}
      <RelatedMemories
        memory={memory}
        related={related}
        userId={userId}
        onConnectionsChanged={onConnectionsChanged}
      />

      {/* PATTERN PREVIEW (lightweight: count only, no scan on render) */}
      {patternCount > 0 && (
        <section className="space-y-2 border-t border-border/40 pt-8">
          <SectionLabel>I noticed something</SectionLabel>
          <Link
            to="/patterns"
            className="flex items-center justify-between rounded-lg border border-border/40 p-3 transition-colors hover:bg-accent"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {patternCount} {patternCount === 1 ? "pattern" : "patterns"} across your memories
              </p>
              <p className="text-xs text-muted-foreground">
                Grounded in your own recorded evidence.
              </p>
            </div>
            <Sparkles className="size-4 text-muted-foreground" />
          </Link>
        </section>
      )}

      {/* ADD REFLECTION */}
      <AddReflection memory={memory} userId={userId} onSaved={onReflectionsChanged} />

      {/* MEDIA */}
      {userId && (
        <section className="space-y-3 border-t border-border/40 pt-8">
          <MediaSection
            userId={userId}
            context="memory"
            contextId={memory.id}
            onChanged={async () => {}}
          />
        </section>
      )}
    </div>
  );
}

function memoryTitle(memory: Memory): string {
  const first = memory.musicExperiences[0]?.experience;
  if (first?.title) return first.title;
  if (first?.artist) return first.artist;
  if (memory.musicExperiences.length > 1) return "A few songs";
  return "A memory in sound";
}

function ContextChips({ memory }: { memory: Memory }) {
  const chips: Array<{ icon: typeof Calendar; label: string }> = [];
  if (memory.eventTime?.label) {
    chips.push({ icon: Calendar, label: memory.eventTime.label });
  }
  if (memory.location) chips.push({ icon: MapPin, label: memory.location });
  if (memory.weather) chips.push({ icon: Cloud, label: memory.weather });
  if (memory.lifeEvent) chips.push({ icon: MessageCircle, label: memory.lifeEvent });

  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground"
        >
          <c.icon className="size-3" /> {c.label}
        </span>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

function ReflectionItem({ reflection }: { reflection: Reflection }) {
  const isCompanion = reflection.author === "companion";
  const date = formatDate(reflection.reflectedAt);
  return (
    <li className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={isCompanion ? "secondary" : "outline"} className="text-[10px]">
          {isCompanion ? "Companion" : "You"}
        </Badge>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <p
        className={
          isCompanion
            ? "text-sm italic leading-relaxed text-foreground/60"
            : "text-sm leading-relaxed text-foreground/80"
        }
      >
        {reflection.body}
      </p>
    </li>
  );
}

function AddReflection({
  memory,
  userId,
  onSaved,
}: {
  memory: Memory;
  userId: string | null;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Companion assist state
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  async function handleSaveUser() {
    if (!userId || !text.trim()) return;
    setSaving(true);
    setError(null);
    const result = await addReflection(userId, {
      memoryId: memory.id,
      author: "user",
      body: text.trim(),
    });
    setSaving(false);
    if ("reflectionId" in result) {
      setText("");
      await onSaved();
    } else {
      setError("Could not save your reflection. Please try again.");
    }
  }

  async function handleSuggest() {
    if (!userId) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestion(null);
    try {
      const result = await reflectOnMemory({
        data: {
          memory: {
            originalUserNote: memory.originalUserNote,
            userNote: memory.userNote,
            feeling: memory.feeling,
            lifeEvent: memory.lifeEvent,
            location: memory.location,
            weather: memory.weather,
            eventTime: memory.eventTime,
            musicExperiences: memory.musicExperiences,
            recordedAt: memory.recordedAt,
          },
        },
      });
      if (result.reflection) {
        setSuggestion(result.reflection);
      } else {
        setSuggestError(
          "The Companion couldn't help right now. You can still write your own reflection below.",
        );
      }
    } catch {
      setSuggestError("Something went wrong. You can still write your own reflection below.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSaveCompanion() {
    if (!userId || !suggestion) return;
    setSaving(true);
    setError(null);
    const result = await addReflection(userId, {
      memoryId: memory.id,
      author: "companion",
      body: suggestion,
      sourceContext: { savedFrom: "companion_assist" },
    });
    setSaving(false);
    if ("reflectionId" in result) {
      setSuggestion(null);
      await onSaved();
    } else {
      setError("Could not save the Companion reflection. Please try again.");
    }
  }

  return (
    <section className="space-y-4 border-t border-border/40 pt-8">
      <SectionLabel>Add a reflection</SectionLabel>

      {/* Companion assist — suggestion is NOT auto-saved */}
      <div className="space-y-3 rounded-lg border border-border/50 bg-card/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Want help reflecting on this?</p>
          <Button
            onClick={handleSuggest}
            variant="ghost"
            size="sm"
            disabled={!userId || suggesting}
            className="gap-1.5"
          >
            {suggesting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Help me reflect
          </Button>
        </div>

        {suggestError && (
          <p className="text-xs text-amber-600 dark:text-amber-500">{suggestError}</p>
        )}

        {suggestion && (
          <div className="space-y-3">
            <div className="rounded-md bg-secondary/40 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  Companion suggestion
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  AI interpretation — not saved yet
                </span>
              </div>
              <p className="text-sm italic leading-relaxed text-foreground/70">{suggestion}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveCompanion} size="sm" disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save as a reflection
              </Button>
              <Button
                onClick={() => setSuggestion(null)}
                size="sm"
                variant="ghost"
                className="gap-1.5"
              >
                <X className="size-3.5" /> Discard
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User reflection input */}
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="How do you remember this moment today?"
          className="min-h-24 resize-y text-base leading-relaxed"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Your reflection is added to history — the original memory stays intact.
          </p>
          <Button
            onClick={handleSaveUser}
            disabled={!userId || saving || !text.trim()}
            size="sm"
            className="gap-1.5"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Save reflection
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {!userId && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Sign-in is unavailable, so reflections can't be saved right now.
        </p>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function RelatedMemories({
  memory,
  related,
  userId,
  onConnectionsChanged,
}: {
  memory: Memory;
  related: RelatedMemory[];
  userId: string | null;
  onConnectionsChanged: () => Promise<void>;
}) {
  const [showLinker, setShowLinker] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    candidateMemoryId: string;
    reason: string;
    confidence: number;
  } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherMemories, setOtherMemories] = useState<Memory[]>([]);

  async function loadOthers() {
    if (!userId) return;
    const all = await listMemories(userId);
    setOtherMemories(all.filter((m) => m.id !== memory.id));
  }

  async function handleLink(targetMemoryId: string) {
    if (!userId) return;
    setLinking(true);
    setError(null);
    const result = await createConnection(userId, {
      sourceMemoryId: memory.id,
      targetMemoryId,
      connectionType: "user_linked",
      source: "user",
    });
    setLinking(false);
    if ("connectionId" in result) {
      setShowLinker(false);
      await onConnectionsChanged();
    } else {
      setError(result.error === "connection already exists" ? "Already linked." : result.error);
    }
  }

  async function handleDelete(connectionId: string) {
    if (!userId) return;
    const ok = await deleteConnection(userId, connectionId);
    if (ok) await onConnectionsChanged();
  }

  async function handleSuggest() {
    if (!userId) return;
    setSuggesting(true);
    setError(null);
    setAiSuggestion(null);
    try {
      // Use the user's other memories as a small candidate set.
      if (otherMemories.length === 0) await loadOthers();
      const candidates = otherMemories.slice(0, 8).map((m) => ({
        id: m.id,
        originalUserNote: m.originalUserNote,
        userNote: m.userNote,
        feeling: m.feeling,
        lifeEvent: m.lifeEvent,
        location: m.location,
        weather: m.weather,
        eventTime: m.eventTime,
        musicExperiences: m.musicExperiences,
      }));
      const result = await suggestConnection({
        data: {
          memory: {
            id: memory.id,
            originalUserNote: memory.originalUserNote,
            userNote: memory.userNote,
            feeling: memory.feeling,
            lifeEvent: memory.lifeEvent,
            location: memory.location,
            weather: memory.weather,
            eventTime: memory.eventTime,
            musicExperiences: memory.musicExperiences,
          },
          candidates,
        },
      });
      if (result.suggestion) {
        setAiSuggestion(result.suggestion);
      } else {
        setError("No grounded connection was found. You can still link a memory manually.");
      }
    } catch {
      setError("The Companion couldn't help right now. You can still link a memory manually.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleAcceptSuggestion() {
    if (!userId || !aiSuggestion) return;
    setLinking(true);
    setError(null);
    const result = await createConnection(userId, {
      sourceMemoryId: memory.id,
      targetMemoryId: aiSuggestion.candidateMemoryId,
      connectionType: "user_linked",
      source: "ai_suggested",
      confidence: aiSuggestion.confidence,
      reason: aiSuggestion.reason,
      metadata: { savedFrom: "ai_suggested" },
    });
    setLinking(false);
    if ("connectionId" in result) {
      setAiSuggestion(null);
      await onConnectionsChanged();
    } else {
      setError(result.error === "connection already exists" ? "Already linked." : result.error);
    }
  }

  return (
    <section className="space-y-4 border-t border-border/40 pt-8">
      <div className="flex items-center justify-between">
        <SectionLabel>Related memories</SectionLabel>
        <Button
          onClick={() => {
            setShowLinker((v) => !v);
            if (!showLinker && otherMemories.length === 0) void loadOthers();
          }}
          variant="ghost"
          size="sm"
          className="gap-1.5"
        >
          <Link2 className="size-3.5" /> Link another memory
        </Button>
      </div>

      {related.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No related memories yet. Link one, or ask the Companion to suggest a connection.
        </p>
      ) : (
        <ul className="space-y-3">
          {related.map((r) => (
            <li
              key={r.connectionId}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/40 p-3"
            >
              <Link
                to="/memory/$memoryId"
                params={{ memoryId: r.memoryId }}
                className="min-w-0 flex-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{r.title}</span>
                  <Badge
                    variant={r.connectionSource === "ai_suggested" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {r.reason}
                  </Badge>
                  {r.connectionSource === "ai_suggested" && (
                    <span className="text-[10px] text-muted-foreground">AI suggestion</span>
                  )}
                </div>
                {r.excerpt && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{r.excerpt}</p>
                )}
                {r.eventTimeLabel && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{r.eventTimeLabel}</p>
                )}
              </Link>
              <Button
                onClick={() => handleDelete(r.connectionId)}
                variant="ghost"
                size="icon"
                aria-label="Remove link"
                className="shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showLinker && (
        <div className="space-y-2 rounded-lg border border-border/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Pick a memory to link</p>
            <Button
              onClick={handleSuggest}
              variant="ghost"
              size="sm"
              disabled={!userId || suggesting}
              className="gap-1.5"
            >
              {suggesting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Suggest a connection
            </Button>
          </div>
          {otherMemories.length === 0 ? (
            <p className="text-xs text-muted-foreground">No other memories yet.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-auto">
              {otherMemories.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => handleLink(m.id)}
                    disabled={linking}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className="truncate text-foreground">{memoryTitle(m)}</span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {m.eventTime?.label ?? formatDate(m.recordedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aiSuggestion && (
        <div className="space-y-3 rounded-md border border-border/40 bg-secondary/30 p-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              AI suggestion
            </Badge>
            <span className="text-[10px] text-muted-foreground">Not saved yet</span>
          </div>
          <p className="text-sm italic leading-relaxed text-foreground/70">{aiSuggestion.reason}</p>
          <div className="flex gap-2">
            <Button
              onClick={handleAcceptSuggestion}
              size="sm"
              disabled={linking}
              className="gap-1.5"
            >
              {linking && <Loader2 className="size-3.5 animate-spin" />}
              Accept
            </Button>
            <Button
              onClick={() => setAiSuggestion(null)}
              size="sm"
              variant="ghost"
              className="gap-1.5"
            >
              <X className="size-3.5" /> Dismiss
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}
    </section>
  );
}
