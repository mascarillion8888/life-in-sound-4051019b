/**
 * CompanionMemoriesPanel — management UI for the durable Companion Memory layer.
 *
 * Renders the user's Companion Memories (active by default; toggle to include
 * archived). Each memory shows its content, kind, status, created date, and an
 * optional related Memory/Event/Chapter badge. Actions: Archive / Restore /
 * Delete + a user-only Edit. The "Why?" affordance opens an inline provenance
 * drawer that traces the memory back to its source conversation + original user
 * turn, so the user can see: "This memory exists because you explicitly
 * confirmed it."
 *
 * The UI clearly distinguishes "Companion Memory" from "AI interpretation" and
 * "Conversation history" — these are different things. Companion Memories are
 * user-approved, durable, reversible.
 *
 * Security: identity is server-derived via the access token; the browser never
 * supplies a userId. No LLM call; no provider keys. All mutations go through
 * server functions (companionMemory.server.ts) which are owner-scoped + RLS.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveCompanionMemoryFn,
  deleteCompanionMemoryFn,
  listCompanionMemoriesFn,
  loadCompanionMemoryProvenanceFn,
  restoreCompanionMemoryFn,
  updateCompanionMemoryFn,
} from "@/lib/llm/companionMemory.server";
import type {
  CompanionMemory,
  CompanionMemoryKind,
  CompanionMemoryProvenance,
} from "@/lib/memory/types";

const KIND_LABEL: Record<CompanionMemoryKind, string> = {
  directive: "Directive",
  preference: "Preference",
  confirmed_context: "Confirmed context",
  boundary: "Boundary",
  decision: "Decision",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function relatedBadge(m: CompanionMemory): string | null {
  if (m.relatedMemoryId) return "Memory";
  if (m.relatedEventId) return "Event";
  if (m.relatedChapterId) return "Chapter";
  return null;
}

export function CompanionMemoriesPanel({ accessToken }: { accessToken: string }) {
  const [memories, setMemories] = useState<CompanionMemory[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [provenanceId, setProvenanceId] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<CompanionMemoryProvenance | null>(null);
  const [provenanceLoading, setProvenanceLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const res = await listCompanionMemoriesFn({
      data: { accessToken, includeArchived },
    });
    setMemories(res.memories as CompanionMemory[]);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(id: string) {
    await run(id, () => archiveCompanionMemoryFn({ data: { accessToken, companionMemoryId: id } }));
  }
  async function handleRestore(id: string) {
    await run(id, () => restoreCompanionMemoryFn({ data: { accessToken, companionMemoryId: id } }));
  }
  async function handleDelete(id: string) {
    if (!confirm("Delete this Companion Memory permanently? This cannot be undone.")) return;
    await run(id, () => deleteCompanionMemoryFn({ data: { accessToken, companionMemoryId: id } }));
  }

  function startEdit(m: CompanionMemory) {
    setEditingId(m.id);
    setEditText(m.content);
  }
  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const res = await updateCompanionMemoryFn({
        data: { accessToken, companionMemoryId: id, content: editText },
      });
      if (res.ok) {
        setEditingId(null);
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggleWhy(id: string) {
    if (provenanceId === id) {
      setProvenanceId(null);
      setProvenance(null);
      return;
    }
    setProvenanceId(id);
    setProvenance(null);
    setProvenanceLoading(true);
    const res = await loadCompanionMemoryProvenanceFn({
      data: { accessToken, companionMemoryId: id },
    });
    setProvenance(res.provenance);
    setProvenanceLoading(false);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Companion Memories</h2>
          <p className="text-xs text-muted-foreground">
            Things you explicitly asked the Companion to remember. These are your approved records —
            not AI interpretation and not conversation history.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="accent-foreground"
          />
          Include archived
        </label>
      </header>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 size-4 animate-spin" /> Loading…
        </p>
      ) : memories.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No Companion Memories yet. When you tell the Companion to remember something in a
          conversation, it will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {memories.map((m) => (
            <li key={m.id} className="rounded-xl border border-border/50 bg-background/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editingId === m.id ? (
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-16 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-foreground">{m.content}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">{KIND_LABEL[m.kind]}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {m.status === "archived" ? "Archived" : "Active"}
                    </span>
                    <span>Created {formatDate(m.createdAt)}</span>
                    {relatedBadge(m) && (
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        Linked {relatedBadge(m)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {editingId === m.id ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void saveEdit(m.id)}
                      disabled={busyId === m.id}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      disabled={busyId === m.id}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(m)}
                      disabled={busyId === m.id}
                    >
                      Edit
                    </Button>
                    {m.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleArchive(m.id)}
                        disabled={busyId === m.id}
                      >
                        Archive
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRestore(m.id)}
                        disabled={busyId === m.id}
                      >
                        Restore
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void handleDelete(m.id)}
                      disabled={busyId === m.id}
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void toggleWhy(m.id)}
                      disabled={busyId === m.id}
                    >
                      {provenanceId === m.id ? "Hide source" : "Why?"}
                    </Button>
                  </>
                )}
              </div>

              {provenanceId === m.id && (
                <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3 text-xs text-muted-foreground">
                  {provenanceLoading ? (
                    <span>
                      <Loader2 className="mr-1 inline size-3 animate-spin" /> Loading source…
                    </span>
                  ) : provenance ? (
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        This memory exists because you explicitly confirmed it.
                      </p>
                      <p>
                        Source: conversation {provenance.conversationTitle ?? "untitled"} ·
                        confirmed {formatDate(provenance.confirmedAt)} · remembered{" "}
                        {formatDate(provenance.promotedAt)}.
                      </p>
                      <p className="italic">Your original message: “{provenance.turnContent}”</p>
                    </div>
                  ) : (
                    <p>Source details are unavailable.</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
