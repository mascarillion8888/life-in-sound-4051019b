import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import { createChapter, listChapters } from "@/lib/supabase/life-remote";
import type { LifeChapter } from "@/lib/memory/types";

export const Route = createFileRoute("/chapters")({
  head: () => ({
    meta: [
      { title: "Life Chapters — Life in a Sound" },
      {
        name: "description",
        content: "Broader periods and themes in your life — groups of events and memories.",
      },
    ],
  }),
  component: ChaptersPage,
});

type LoadState = "loading" | "ready";

function ChaptersPage() {
  const session = useSession();
  const userId = useUserId(session);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [chapters, setChapters] = useState<LifeChapter[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load(uid: string) {
    setLoadState("loading");
    setChapters(await listChapters(uid));
    setLoadState("ready");
  }

  useEffect(() => {
    if (!userId) return;
    void load(userId);
  }, [userId]);

  if (!userId) {
    return (
      <Shell>
        <p className="py-32 text-center text-sm text-muted-foreground">
          Sign in to see your life chapters.
        </p>
      </Shell>
    );
  }

  if (loadState === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-32 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading chapters…</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Life Chapters
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Broader periods and themes in your life — groups of events and memories.
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} size="sm" className="gap-1.5">
          <Plus className="size-4" /> New chapter
        </Button>
      </header>

      {showCreate && (
        <CreateChapterForm
          userId={userId}
          onCreated={async () => {
            setShowCreate(false);
            await load(userId);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {chapters.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No chapters yet. Create a chapter to group events and memories by period or theme.
        </p>
      ) : (
        <ul className="space-y-3">
          {chapters.map((c) => (
            <li key={c.id}>
              <Link
                to="/chapters/$chapterId"
                params={{ chapterId: c.id }}
                className="block rounded-lg border border-border/40 p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
                    {c.description && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {c.timeLabel ?? chapterTimeLabel(c)}
                  </Badge>
                </div>
                {c.timeLabel && <p className="mt-1 text-xs text-muted-foreground">{c.timeLabel}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function CreateChapterForm({
  userId,
  onCreated,
  onCancel,
}: {
  userId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (title.trim().length === 0) {
      setError("A title is needed.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createChapter(userId, {
      title: title.trim(),
      description: description.trim() || null,
      timeLabel: period.trim() || null,
      timePrecision: "period",
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      onCreated();
    }
  }

  return (
    <div className="mb-8 space-y-4 rounded-lg border border-border/40 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="ch-title">Title</Label>
        <Input
          id="ch-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. University Years"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ch-desc">Description (optional)</Label>
        <Textarea
          id="ch-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A few words about this chapter"
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ch-period">Period (optional)</Label>
        <Input
          id="ch-period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          placeholder="e.g. 2001–2005"
        />
      </div>
      {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} size="sm" disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Create chapter
        </Button>
        <Button onClick={onCancel} size="sm" variant="ghost" className="gap-1.5">
          <X className="size-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function chapterTimeLabel(c: LifeChapter): string {
  if (c.startAt || c.endAt) {
    const f = new Date(c.startAt ?? "").getFullYear();
    const t = new Date(c.endAt ?? c.startAt ?? "").getFullYear();
    if (f && t && f !== t) return `${f}–${t}`;
    if (f) return String(f);
  }
  return c.timePrecision === "unknown" ? "—" : c.timePrecision;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-40" />
      <main className="relative z-10 mx-auto min-h-screen max-w-3xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
