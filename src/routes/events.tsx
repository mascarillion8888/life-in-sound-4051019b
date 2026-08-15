import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import { createEvent, deleteEvent, listEvents } from "@/lib/supabase/life-remote";
import type { LifeEvent } from "@/lib/memory/types";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Life Events — Life in a Sound" },
      {
        name: "description",
        content: "Meaningful events and periods in your life, organized from your own memories.",
      },
    ],
  }),
  component: EventsPage,
});

type LoadState = "loading" | "ready";

function EventsPage() {
  const session = useSession();
  const userId = useUserId(session);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load(uid: string) {
    setLoadState("loading");
    setEvents(await listEvents(uid));
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
          Sign in to see your life events.
        </p>
      </Shell>
    );
  }

  if (loadState === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-32 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading events…</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Life Events
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Meaningful events and periods in your life. Organize memories into the moments that
            matter to you.
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} size="sm" className="gap-1.5">
          <Plus className="size-4" /> New event
        </Button>
      </header>

      {showCreate && (
        <CreateEventForm
          userId={userId}
          onCreated={async () => {
            setShowCreate(false);
            await load(userId);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {events.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No events yet. Create your first life event to start grouping memories.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                to="/events/$eventId"
                params={{ eventId: e.id }}
                className="block rounded-lg border border-border/40 p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">{e.title}</h3>
                    {e.description && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {e.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {timeLabel(e)}
                  </Badge>
                </div>
                {(e.location || e.timeLabel) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[e.timeLabel, e.location].filter(Boolean).join(" · ")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function CreateEventForm({
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
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (title.trim().length === 0) {
      setError("A title is needed.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createEvent(userId, {
      title: title.trim(),
      description: description.trim() || null,
      timeLabel: when.trim() || null,
      location: where.trim() || null,
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
        <Label htmlFor="ev-title">Title</Label>
        <Input
          id="ev-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 2007 — Moving to Istanbul"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ev-desc">Description (optional)</Label>
        <Textarea
          id="ev-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A few words about this period"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-when">When (optional)</Label>
          <Input
            id="ev-when"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="e.g. late 1990s"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-where">Where (optional)</Label>
          <Input
            id="ev-where"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="e.g. Istanbul"
          />
        </div>
      </div>
      {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} size="sm" disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Create event
        </Button>
        <Button onClick={onCancel} size="sm" variant="ghost" className="gap-1.5">
          <X className="size-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function timeLabel(e: LifeEvent): string {
  if (e.timeLabel) return e.timeLabel;
  if (e.startAt || e.endAt) {
    const f = new Date(e.startAt ?? "").getFullYear();
    const t = new Date(e.endAt ?? e.startAt ?? "").getFullYear();
    if (f && t && f !== t) return `${f}–${t}`;
    if (f) return String(f);
  }
  return e.timePrecision === "unknown" ? "—" : e.timePrecision;
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
