import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import {
  createPattern,
  deletePattern,
  dismissPattern,
  discoverPatternCandidates,
  listPatterns,
  loadPatternRelatedMemories,
} from "@/lib/supabase/patterns-remote";
import { interpretPattern } from "@/lib/llm/interpretPattern.server";
import type { Pattern, PatternCandidate, PatternRelatedMemory } from "@/lib/memory/types";

export const Route = createFileRoute("/patterns")({
  head: () => ({
    meta: [
      { title: "Patterns — Life in a Sound" },
      {
        name: "description",
        content:
          "I noticed something — patterns across your music memories, grounded in your own recorded evidence.",
      },
    ],
  }),
  component: PatternsPage,
});

type LoadState = "loading" | "ready";

function PatternsPage() {
  const session = useSession();
  const userId = useUserId(session);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [candidates, setCandidates] = useState<PatternCandidate[]>([]);

  async function loadAll(uid: string) {
    setLoadState("loading");
    const [persisted, discovered] = await Promise.all([
      listPatterns(uid, false),
      discoverPatternCandidates(uid),
    ]);
    setPatterns(persisted);
    setCandidates(discovered);
    setLoadState("ready");
  }

  useEffect(() => {
    if (!userId) return;
    void loadAll(userId);
  }, [userId]);

  if (!userId) {
    return (
      <Shell>
        <p className="py-32 text-center text-sm text-muted-foreground">
          Sign in to see your patterns.
        </p>
      </Shell>
    );
  }

  if (loadState === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-32 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Looking for patterns…</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-10 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          I noticed something
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Patterns are computed from your own recorded memories — never guesses about who you are.
          Each one lists the evidence it's based on.
        </p>
      </header>

      {patterns.length === 0 && candidates.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No patterns yet. As you record more memories, repeats and relationships will appear here.
        </p>
      ) : null}

      {/* Persisted patterns */}
      {patterns.length > 0 && (
        <section className="space-y-4">
          <SectionLabel>Your patterns</SectionLabel>
          <ul className="space-y-4">
            {patterns.map((p) => (
              <PatternCard
                key={p.id}
                pattern={p}
                userId={userId}
                onChanged={async () => {
                  setPatterns(await listPatterns(userId, false));
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Discovered candidates not yet persisted */}
      {candidates.length > 0 && (
        <section className="space-y-4 border-t border-border/40 pt-8">
          <SectionLabel>Noticed just now</SectionLabel>
          <ul className="space-y-4">
            {candidates.map((c, i) => (
              <CandidateCard
                key={`${c.fingerprint}-${i}`}
                candidate={c}
                userId={userId}
                onSaved={async () => {
                  setPatterns(await listPatterns(userId, false));
                  setCandidates(await discoverPatternCandidates(userId));
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

function PatternCard({
  pattern,
  userId,
  onChanged,
}: {
  pattern: Pattern;
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const [related, setRelated] = useState<PatternRelatedMemory[]>([]);
  const [showMemories, setShowMemories] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRelated() {
    const rel = await loadPatternRelatedMemories(userId, pattern.id);
    setRelated(rel);
  }

  async function handleExplore() {
    setInterpreting(true);
    setError(null);
    try {
      const result = await interpretPattern({ data: { userId, patternId: pattern.id } });
      if (!result.interpretation) {
        setError("The Companion couldn't help right now.");
      } else {
        await onChanged();
      }
    } catch {
      setError("The Companion couldn't help right now.");
    } finally {
      setInterpreting(false);
    }
  }

  async function handleDismiss() {
    const ok = await dismissPattern(userId, pattern.id);
    if (ok) await onChanged();
  }

  return (
    <li className="space-y-3 rounded-lg border border-border/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{pattern.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{pattern.summary}</p>
          <p className="text-xs text-muted-foreground">
            Based on {pattern.evidenceCount} of your memories
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {deterministicLabel(pattern.patternType)}
        </Badge>
      </div>

      {(pattern.observedFrom || pattern.observedTo) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3" />
          {formatRange(pattern.observedFrom, pattern.observedTo)}
        </p>
      )}

      {/* Related memories */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setShowMemories((v) => !v);
            if (!showMemories && related.length === 0) void loadRelated();
          }}
        >
          {showMemories ? "Hide memories" : "View memories"}
        </Button>
        {showMemories && (
          <ul className="mt-2 space-y-1.5">
            {related.map((m) => (
              <li key={m.memoryId}>
                <Link
                  to="/memory/$memoryId"
                  params={{ memoryId: m.memoryId }}
                  className="block rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium text-foreground">{m.title}</span>
                  {m.excerpt && (
                    <span className="ml-2 text-xs text-muted-foreground">{m.excerpt}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI interpretation (optional, separate layer) */}
      {pattern.interpretation && (
        <div className="rounded-md bg-secondary/30 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              AI interpretation
            </Badge>
            <span className="text-[10px] text-muted-foreground">Advisory — not a fact</span>
          </div>
          <p className="text-sm italic leading-relaxed text-foreground/70">
            {pattern.interpretation}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!pattern.interpretation && (
          <Button onClick={handleExplore} size="sm" disabled={interpreting} className="gap-1.5">
            {interpreting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Explore
          </Button>
        )}
        <Button onClick={handleDismiss} size="sm" variant="ghost" className="gap-1.5">
          <X className="size-3.5" /> Dismiss
        </Button>
        <Button
          onClick={async () => {
            await deletePattern(userId, pattern.id);
            await onChanged();
          }}
          size="sm"
          variant="ghost"
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

function CandidateCard({
  candidate,
  userId,
  onSaved,
}: {
  candidate: PatternCandidate;
  userId: string;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createPattern(userId, candidate);
    setSaving(false);
    if ("error" in result) {
      setError(result.error === "pattern already exists" ? "Already saved." : result.error);
    } else {
      await onSaved();
    }
  }

  return (
    <li className="space-y-2 rounded-lg border border-border/40 bg-secondary/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{candidate.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{candidate.summary}</p>
          <p className="text-xs text-muted-foreground">
            Based on {candidate.evidenceCount} of your memories
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {deterministicLabel(candidate.patternType)}
        </Badge>
      </div>
      {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} size="sm" disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save pattern
        </Button>
        <Button onClick={() => onSaved()} size="sm" variant="ghost" className="gap-1.5">
          <X className="size-3.5" /> Skip
        </Button>
      </div>
    </li>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

function deterministicLabel(type: Pattern["patternType"]): string {
  const labels: Record<Pattern["patternType"], string> = {
    repeated_music: "Repeated music",
    repeated_location: "Repeated location",
    recurring_time_context: "Recurring time",
    revisited_memory: "Revisited memory",
    recurring_weather_context: "Recurring weather",
    recurring_user_emotion: "Recurring feeling",
  };
  return labels[type];
}

function formatRange(from: string | null, to: string | null): string {
  const f = formatDate(from);
  const t = formatDate(to);
  if (f && t) return `${f} — ${t}`;
  if (f) return `from ${f}`;
  if (t) return `until ${t}`;
  return "";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
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
