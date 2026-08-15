import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Archive, Loader2, MessageCircle, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import {
  archiveConversation,
  createConversation,
  listConversations,
  reopenConversation,
} from "@/lib/supabase/companion-remote";
import type { CompanionConversation } from "@/lib/memory/types";

export const Route = createFileRoute("/companion")({
  head: () => ({ meta: [{ title: "Companion — Life in a Sound" }] }),
  component: CompanionPage,
});

function CompanionPage() {
  const session = useSession();
  const userId = useUserId(session);
  const [conversations, setConversations] = useState<CompanionConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const list = await listConversations(userId);
    setConversations(list);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleStart() {
    if (!userId) return;
    setStarting(true);
    const convo = await createConversation(userId);
    setStarting(false);
    if (convo) {
      window.location.href = `/companion/${convo.id}`;
    }
  }

  async function handleArchive(id: string) {
    if (!userId) return;
    await archiveConversation(userId, id);
    await load();
  }

  async function handleReopen(id: string) {
    if (!userId) return;
    await reopenConversation(userId, id);
    await load();
  }

  const active = conversations.filter((c) => c.status === "active");
  const archived = conversations.filter((c) => c.status === "archived");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-40" />
      <main className="relative z-10 mx-auto min-h-screen max-w-2xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Companion
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            A calm space to talk with your Companion about your life in sound.
          </p>
        </header>

        {!userId ? (
          <p className="py-32 text-center text-sm text-muted-foreground">
            Start your journey to begin a conversation.
          </p>
        ) : (
          <div className="space-y-8">
            <Button onClick={handleStart} disabled={starting} className="gap-1.5">
              {starting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              New conversation
            </Button>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : active.length === 0 && archived.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conversations yet. Start one whenever you like.
              </p>
            ) : (
              <div className="space-y-8">
                <ConversationList
                  label="Active"
                  items={active}
                  onArchive={handleArchive}
                  onReopen={handleReopen}
                />
                {archived.length > 0 && (
                  <ConversationList
                    label="Archived"
                    items={archived}
                    onArchive={handleArchive}
                    onReopen={handleReopen}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ConversationList({
  label,
  items,
  onArchive,
  onReopen,
}: {
  label: string;
  items: CompanionConversation[];
  onArchive: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-border/40 p-3 transition-colors hover:bg-accent/30"
          >
            <Link
              to="/companion/$conversationId"
              params={{ conversationId: c.id }}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.title ?? "Untitled conversation"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.lastActivityAt).toLocaleString()}
                </p>
              </div>
            </Link>
            {c.status === "active" ? (
              <button
                onClick={() => onArchive(c.id)}
                className="ml-2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Archive conversation"
              >
                <Archive className="size-4" />
              </button>
            ) : (
              <button
                onClick={() => onReopen(c.id)}
                className="ml-2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Reopen conversation"
              >
                <RotateCcw className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
