import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Archive, Loader2, RotateCcw, Send, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession, useUserId, useAccessToken } from "@/lib/supabase/use-session";
import { archiveConversation, listTurns, loadConversation } from "@/lib/supabase/companion-remote";
import { companionConversation } from "@/lib/llm/companionConversation.server";
import { companionOpening } from "@/lib/llm/companionOpening";
import {
  confirmSignificantInteractionFn,
  dismissSignificantInteractionFn,
} from "@/lib/llm/confirmSignificantInteraction.server";
import { promoteSignificantInteraction } from "@/lib/llm/promoteSignificantInteraction.server";
import { submitFeedback, type FeedbackRating } from "@/lib/feedback";
import { track, PRODUCT_EVENTS } from "@/lib/telemetry";
import { ReliabilityMessage } from "@/lib/reliability";
import type {
  CompanionConversation,
  CompanionTurn,
  SignificantInteraction,
} from "@/lib/memory/types";

export const Route = createFileRoute("/companion/$conversationId")({
  head: () => ({ meta: [{ title: "Conversation — Life in a Sound" }] }),
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { conversationId } = Route.useParams();
  const session = useSession();
  const userId = useUserId(session);
  const accessToken = useAccessToken(session);

  const [turns, setTurns] = useState<CompanionTurn[]>([]);
  const [conversation, setConversation] = useState<CompanionConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Id of the user turn awaiting a Companion reply (retry anchor). */
  const [pendingUserTurnId, setPendingUserTurnId] = useState<string | null>(null);
  /** A pending significant-interaction candidate surfaced from a user turn. */
  const [candidate, setCandidate] = useState<SignificantInteraction | null>(null);
  const [candidateBusy, setCandidateBusy] = useState(false);
  /** "Remembered" confirmation shown after successful confirm+promote. */
  const [remembered, setRemembered] = useState(false);
  /** Whether the post-first-companion-turn feedback prompt was answered. */
  const [companionFeedbackSubmitted, setCompanionFeedbackSubmitted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isArchived = conversation?.status === "archived";
  const isEmpty = !loading && turns.length === 0 && !isArchived;
  // A calm, deterministic opener for the empty-conversation state. Grounded
  // hints are not available without a retrieval call; the opener stays general
  // and never pretends to know something not supplied.
  const opening = isEmpty ? companionOpening(conversationId) : null;

  async function load() {
    if (!userId) return;
    setLoading(true);
    const [convo, list] = await Promise.all([
      loadConversation(userId, conversationId),
      listTurns(userId, conversationId),
    ]);
    setLoading(false);
    if (!convo) {
      setError("This conversation is not available.");
      return;
    }
    setConversation(convo);
    setTurns(list);
    // If the last turn is a user turn with no assistant reply, mark it pending
    // so the retry path reuses it instead of duplicating.
    const last = list[list.length - 1];
    setPendingUserTurnId(last && last.role === "user" ? last.id : null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function handleSend(retry = false) {
    if (!userId || !accessToken) return;
    setError(null);
    setSending(true);

    // On retry, do not re-send a new user message; reuse the pending turn.
    const message = retry ? "" : input.trim();
    if (!retry && message.length === 0) {
      setSending(false);
      return;
    }

    const result = await companionConversation({
      data: {
        accessToken,
        conversationId,
        message,
        existingUserTurnId: retry ? (pendingUserTurnId ?? undefined) : undefined,
      },
    });

    setSending(false);

    if (!result.ok || !result.assistantTurn) {
      if (result.userTurn) {
        // Persist the user turn locally even if the Companion didn't reply.
        setTurns((prev) => {
          if (prev.some((t) => t.id === result.userTurn!.id)) return prev;
          return [...prev, result.userTurn! as CompanionTurn];
        });
        setPendingUserTurnId(result.userTurn.id);
      }
      setError(ReliabilityMessage.companionUnavailable);
      // Content-free telemetry: outcome only, never the message/response text.
      track({
        event: PRODUCT_EVENTS.companionTurn,
        timestamp: new Date().toISOString(),
        userId: userId ?? undefined,
        result: "failed",
        fallback: true,
      });
      if (!retry) setInput("");
      return;
    }

    // Append/refresh turns from the server to preserve exact content + order.
    const refreshed = await listTurns(userId, conversationId);
    setTurns(refreshed);
    setPendingUserTurnId(null);
    setInput("");

    // Content-free telemetry: outcome only, never the message/response text.
    track({
      event: PRODUCT_EVENTS.companionTurn,
      timestamp: new Date().toISOString(),
      userId: userId ?? undefined,
      result: "ok",
    });

    // Surface a candidate if the significance machinery produced one. Do NOT
    // interrupt the conversation; the advisory block is shown below the input.
    if (result.candidate) {
      setCandidate(result.candidate as SignificantInteraction);
      setRemembered(false);
    }
  }

  async function handleCandidateAction(confirm: boolean) {
    if (!candidate || !accessToken) return;
    setCandidateBusy(true);
    try {
      if (confirm) {
        // [Remember this] → confirm the Significant Interaction → promote to a
        // durable Companion Memory → show "Remembered". If confirmation succeeds
        // but promotion fails, the interaction stays confirmed and the user can
        // retry; the UI does NOT silently report complete success.
        const confirmRes = await confirmSignificantInteractionFn({
          data: { accessToken, candidateId: candidate.id },
        });
        if (confirmRes.ok && confirmRes.interaction) {
          const promoRes = await promoteSignificantInteraction({
            data: { accessToken, significantInteractionId: candidate.id },
          });
          if (promoRes.ok && promoRes.companionMemory) {
            setRemembered(true);
            setCandidate(null);
            track({
              event: PRODUCT_EVENTS.companionMemoryConfirmed,
              timestamp: new Date().toISOString(),
              userId: userId ?? undefined,
              result: "ok",
            });
          }
          // else: promotion failed; the interaction is still confirmed. The
          // advisory stays so it is clear it was NOT fully remembered; the user
          // can retry from the management UI without creating a duplicate.
        }
      } else {
        // [Not now] — explicit dismissal.
        const res = await dismissSignificantInteractionFn({
          data: { accessToken, candidateId: candidate.id },
        });
        if (res.ok && res.interaction) {
          setCandidate(null);
        }
      }
    } finally {
      setCandidateBusy(false);
    }
  }

  async function handleArchive() {
    if (!userId) return;
    await archiveConversation(userId, conversationId);
    window.location.href = "/companion";
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-30" />
      <header className="relative z-10 flex items-center justify-between border-b border-border/40 px-5 py-3">
        <Link
          to="/companion"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Conversations
        </Link>
        {!isArchived && (
          <Button onClick={handleArchive} size="sm" variant="ghost" className="text-xs">
            Archive
          </Button>
        )}
      </header>

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {loading ? (
            <p className="py-32 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-4 animate-spin" /> Loading conversation…
            </p>
          ) : isEmpty && opening ? (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-foreground">
                {opening}
              </div>
            </div>
          ) : isArchived ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-500">
                <Archive className="size-4" /> This conversation is archived
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                It's read-only. You can reopen it from the Companion page if you'd like to continue.
              </p>
            </div>
          ) : (
            turns.map((t) => <TurnBubble key={t.id} turn={t} />)
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 border-t border-border/40 px-5 py-3">
        <div className="mx-auto max-w-2xl">
          {candidate && (
            <div className="mb-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                I noticed something you may want me to remember.
              </p>
              <p className="mt-1 text-sm text-foreground">{candidate.candidateContent}</p>
              <p className="mt-1 text-[11px] italic text-muted-foreground">Not saved yet</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCandidateAction(true)}
                  disabled={candidateBusy}
                >
                  Remember this
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCandidateAction(false)}
                  disabled={candidateBusy}
                >
                  Not now
                </Button>
              </div>
            </div>
          )}
          {remembered && (
            <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Got it. I'll remember that.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Saved to your Companion Memories. You can review or remove it on your profile.
              </p>
            </div>
          )}
          {error && <p className="mb-2 text-xs text-amber-600 dark:text-amber-500">{error}</p>}
          {turns.length >= 2 && !companionFeedbackSubmitted && !error ? (
            <div className="mb-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3">
              <p className="text-xs font-medium text-foreground">Was this helpful?</p>
              <div className="mt-2 flex gap-2">
                {(
                  [
                    ["yes", "Yes"],
                    ["not_really", "Not really"],
                  ] as [FeedbackRating, string][]
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      submitFeedback("first_companion", value, userId ?? undefined);
                      setCompanionFeedbackSubmitted(true);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {companionFeedbackSubmitted ? (
            <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 text-primary" /> Thanks — that helps us shape the beta.
            </p>
          ) : null}
          {pendingUserTurnId && !sending && (
            <Button onClick={() => handleSend(true)} size="sm" variant="outline" className="mb-2">
              Retry
            </Button>
          )}
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending && !isArchived && input.trim().length > 0) void handleSend(false);
                }
              }}
              placeholder={
                isArchived ? "This conversation is archived." : "Write to your Companion…"
              }
              rows={1}
              className="min-h-[44px] resize-none"
              disabled={sending || loading || isArchived}
            />
            <Button
              onClick={() => handleSend(false)}
              disabled={sending || input.trim().length === 0 || isArchived}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnBubble({ turn }: { turn: CompanionTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        }`}
      >
        {turn.content}
      </div>
    </div>
  );
}
