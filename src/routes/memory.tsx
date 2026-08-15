import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Music, Plus, Save, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSession, useUserId } from "@/lib/supabase/use-session";
import { createMemory } from "@/lib/supabase/memory-remote";
import { extractMemory } from "@/lib/llm/extractMemory.server";
import type { ExtractedCandidate } from "@/lib/llm/extractMemory";

export const Route = createFileRoute("/memory")({
  head: () => ({
    meta: [
      { title: "Save a Memory — Life in a Sound" },
      {
        name: "description",
        content:
          "Capture a moment when music mattered. Describe it in your own words — we'll help structure it.",
      },
    ],
  }),
  component: MemoryCapturePage,
});

type Phase = "compose" | "extracting" | "review" | "saving" | "saved";

type DraftExperience = {
  artist: string;
  title: string;
  sourceType: "streaming" | "traditional" | "family" | "anonymous" | "unknown_title" | "live";
  aiSuggested: boolean;
};

type DraftState = {
  experiences: DraftExperience[];
  eventTimeGranularity: string;
  eventTimeLabel: string;
  location: string;
  weather: string;
  context: string;
  feeling: string;
  userNote: string;
  originalUserNote: string;
};

const EMPTY_DRAFT = (originalNote: string): DraftState => ({
  experiences: [],
  eventTimeGranularity: "unknown",
  eventTimeLabel: "",
  location: "",
  weather: "",
  context: "",
  feeling: "",
  userNote: originalNote,
  originalUserNote: originalNote,
});

function candidateToDraft(candidate: ExtractedCandidate): DraftState {
  const draft = EMPTY_DRAFT(candidate.originalUserNote);
  draft.experiences = candidate.musicExperiences.map((e) => ({
    artist: e.artist ?? "",
    title: e.title ?? "",
    sourceType: e.sourceType,
    aiSuggested: true,
  }));
  if (candidate.eventTime) {
    draft.eventTimeGranularity = candidate.eventTime.granularity;
    draft.eventTimeLabel = candidate.eventTime.label ?? "";
  }
  draft.location = candidate.location ?? "";
  draft.weather = candidate.weather ?? "";
  draft.context = candidate.context ?? "";
  draft.feeling = candidate.feelingSuggestion ?? "";
  return draft;
}

function MemoryCapturePage() {
  const session = useSession();
  const userId = useUserId(session);

  const [phase, setPhase] = useState<Phase>("compose");
  const [rawNote, setRawNote] = useState("");
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canExtract = rawNote.trim().length > 0 && phase === "compose";

  async function handleExtract() {
    if (!canExtract) return;
    setPhase("extracting");
    setExtractionError(null);
    try {
      const result = await extractMemory({ data: { rawUserNote: rawNote.trim() } });
      if (result.candidate) {
        setDraft(candidateToDraft(result.candidate));
        setPhase("review");
      } else {
        // AI unavailable or unparseable → manual fallback with the note preserved.
        setDraft(EMPTY_DRAFT(rawNote.trim()));
        setExtractionError(
          "We couldn't structure your memory automatically. You can fill in the details manually below — your note is preserved.",
        );
        setPhase("review");
      }
    } catch {
      setDraft(EMPTY_DRAFT(rawNote.trim()));
      setExtractionError(
        "Something went wrong reading your memory. You can fill in the details manually below.",
      );
      setPhase("review");
    }
  }

  function handleManualFallback() {
    setDraft(EMPTY_DRAFT(rawNote.trim()));
    setExtractionError(null);
    setPhase("review");
  }

  async function handleSave() {
    if (!draft || !userId) return;
    if (draft.experiences.length === 0) {
      setSaveError("Add at least one song or music experience before saving.");
      return;
    }
    setPhase("saving");
    setSaveError(null);
    try {
      const capture = {
        musicExperiences: draft.experiences.map((e) => ({
          sourceType: e.sourceType,
          title: e.title.trim() || null,
          artist: e.artist.trim() || null,
        })) as [
          import("@/lib/memory/types").MusicExperience,
          ...import("@/lib/memory/types").MusicExperience[],
        ],
        userNote: draft.userNote.trim() || null,
        feeling: draft.feeling.trim() || null,
        lifeEvent: draft.context.trim() || null,
        location: draft.location.trim() || null,
        weather: draft.weather.trim() || null,
        eventTime: {
          granularity: draft.eventTimeGranularity as
            "exact" | "day" | "month" | "year" | "season" | "period" | "unknown",
          label: draft.eventTimeLabel.trim() || null,
        },
      };
      const result = await createMemory(userId, capture);
      if ("memoryId" in result) {
        setPhase("saved");
      } else {
        setSaveError(`Could not save your memory: ${result.error}`);
        setPhase("review");
      }
    } catch {
      setSaveError("Something went wrong saving your memory. Please try again.");
      setPhase("review");
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-60" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Home
          </Link>
          <Badge variant="secondary" className="gap-1">
            <Music className="size-3" /> Memory
          </Badge>
        </div>

        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Save a Memory
          </h1>
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            Capture a moment when music mattered. Describe it in your own words — we'll help
            structure it. You stay in control of every detail.
          </p>
        </header>

        {phase === "compose" && (
          <ComposePhase
            rawNote={rawNote}
            setRawNote={setRawNote}
            canExtract={canExtract}
            onExtract={handleExtract}
            onManualFallback={handleManualFallback}
            authUnavailable={!userId}
          />
        )}

        {phase === "extracting" && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Reading your memory…</p>
          </div>
        )}

        {(phase === "review" || phase === "saving") && draft && (
          <ReviewPhase
            draft={draft}
            setDraft={setDraft}
            extractionError={extractionError}
            saveError={saveError}
            isSaving={phase === "saving"}
            onSave={handleSave}
            onCancel={() => {
              setDraft(null);
              setPhase("compose");
            }}
          />
        )}

        {phase === "saved" && (
          <SavedPhase
            onAnother={() => {
              setRawNote("");
              setDraft(null);
              setExtractionError(null);
              setSaveError(null);
              setPhase("compose");
            }}
          />
        )}
      </main>
    </div>
  );
}

function ComposePhase({
  rawNote,
  setRawNote,
  canExtract,
  onExtract,
  onManualFallback,
  authUnavailable,
}: {
  rawNote: string;
  setRawNote: (v: string) => void;
  canExtract: boolean;
  onExtract: () => void;
  onManualFallback: () => void;
  authUnavailable: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="rawNote" className="text-sm font-medium text-foreground">
          Your memory
        </Label>
        <Textarea
          id="rawNote"
          value={rawNote}
          onChange={(e) => setRawNote(e.target.value)}
          placeholder="Today on the train I heard Pink Floyd and immediately thought about university in 2004. It was raining and I suddenly missed those days."
          className="min-h-40 resize-y text-base leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">
          Write freely. We'll suggest structure — you confirm or edit every field.
        </p>
      </div>

      {authUnavailable && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          Sign-in is unavailable, so memories can't be saved to your account right now. You can
          still draft.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={onExtract}
          disabled={!canExtract || authUnavailable}
          className="gap-2"
          size="lg"
        >
          <Sparkles className="size-4" /> Structure my memory
        </Button>
        <Button onClick={onManualFallback} variant="outline" disabled={authUnavailable} size="lg">
          Enter details manually
        </Button>
      </div>
    </div>
  );
}

function ReviewPhase({
  draft,
  setDraft,
  extractionError,
  saveError,
  isSaving,
  onSave,
  onCancel,
}: {
  draft: DraftState;
  setDraft: (d: DraftState) => void;
  extractionError: string | null;
  saveError: string | null;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const hasExperiences = draft.experiences.length > 0;

  function patch(p: Partial<DraftState>) {
    setDraft({ ...draft, ...p });
  }

  function updateExperience(idx: number, p: Partial<DraftExperience>) {
    const next = draft.experiences.map((e, i) => (i === idx ? { ...e, ...p } : e));
    patch({ experiences: next });
  }

  function removeExperience(idx: number) {
    patch({ experiences: draft.experiences.filter((_, i) => i !== idx) });
  }

  function addExperience() {
    patch({
      experiences: [
        ...draft.experiences,
        { artist: "", title: "", sourceType: "streaming", aiSuggested: false },
      ],
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Review your memory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {extractionError
            ? "We couldn't read this automatically — fill in the details you want below."
            : "We suggested these details from your note. Edit or remove anything before saving."}
        </p>
      </div>

      {extractionError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {extractionError}
        </div>
      )}
      {saveError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* Original note — read-only, preserved verbatim */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Your original note</Label>
        <div className="rounded-lg border border-border/60 bg-card/60 p-4 text-sm leading-relaxed text-foreground/80">
          {draft.originalUserNote}
        </div>
      </div>

      {/* Music experiences */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">Music</Label>
          <Button onClick={addExperience} variant="outline" size="sm" className="gap-1">
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
        {draft.experiences.map((exp, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 p-3"
          >
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={exp.title}
                onChange={(e) => updateExperience(idx, { title: e.target.value })}
                placeholder="Song title (optional for unknown music)"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Artist</Label>
              <Input
                value={exp.artist}
                onChange={(e) => updateExperience(idx, { artist: e.target.value })}
                placeholder="Artist"
              />
            </div>
            <Button
              onClick={() => removeExperience(idx)}
              variant="ghost"
              size="icon"
              aria-label="Remove"
            >
              <Trash2 className="size-4" />
            </Button>
            {exp.aiSuggested && (
              <Badge variant="outline" className="text-[10px]">
                AI
              </Badge>
            )}
          </div>
        ))}
        {!hasExperiences && (
          <p className="text-sm text-muted-foreground">
            Add at least one song or music experience.
          </p>
        )}
      </div>

      {/* Context fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">When</Label>
          <Input
            value={draft.eventTimeLabel}
            onChange={(e) => patch({ eventTimeLabel: e.target.value })}
            placeholder="e.g. summer of 2004"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Location</Label>
          <Input
            value={draft.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="e.g. on the train"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Weather</Label>
          <Input
            value={draft.weather}
            onChange={(e) => patch({ weather: e.target.value })}
            placeholder="e.g. raining"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium text-foreground">Context</Label>
          <Input
            value={draft.context}
            onChange={(e) => patch({ context: e.target.value })}
            placeholder="e.g. university"
          />
        </div>
      </div>

      {/* Feeling — always marked as AI suggestion if present */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-foreground">Feeling</Label>
          <Badge variant="outline" className="text-[10px]">
            AI interpretation
          </Badge>
        </div>
        <Input
          value={draft.feeling}
          onChange={(e) => patch({ feeling: e.target.value })}
          placeholder="e.g. nostalgia"
        />
      </div>

      {/* Editable current note (original remains preserved) */}
      <div className="space-y-1">
        <Label className="text-sm font-medium text-foreground">Note (editable)</Label>
        <Textarea
          value={draft.userNote}
          onChange={(e) => patch({ userNote: e.target.value })}
          className="min-h-20 resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Your original note is preserved separately and cannot be overwritten.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onSave} disabled={isSaving || !hasExperiences} className="gap-2" size="lg">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSaving ? "Saving…" : "Save Memory"}
        </Button>
        <Button onClick={onCancel} variant="outline" size="lg" disabled={isSaving}>
          <X className="size-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function SavedPhase({ onAnother }: { onAnother: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <Save className="size-7 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground">Memory saved</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Your memory is part of your timeline now. Come back any time a song and a moment belong
        together.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onAnother} className="gap-2">
          <Plus className="size-4" /> Save another memory
        </Button>
        <Link to="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="size-4" /> Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
