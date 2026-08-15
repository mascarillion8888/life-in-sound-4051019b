/**
 * MediaSection — shared UI for attaching/detaching images to a context.
 *
 * Used by Memory Detail, Event Detail, and Chapter Detail. Keeps the media
 * interaction minimal: show attached images (signed URLs), add an image
 * (upload → create record → attach → display), detach (does NOT delete the
 * media object). Existing page design language is preserved.
 *
 * Security: the file input accepts only the v1 image allowlist; final MIME/size
 * validation happens in media-remote (server-side, never client-only). Signed
 * URLs are generated only after ownership verification in media-remote.
 */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ALLOWED_MIME_TYPES,
  MAX_MEDIA_BYTES,
  attachMediaToChapter,
  attachMediaToEvent,
  attachMediaToMemory,
  detachMediaFromChapter,
  detachMediaFromEvent,
  detachMediaFromMemory,
  listChapterMedia,
  listEventMedia,
  listMemoryMedia,
  uploadMedia,
} from "@/lib/supabase/media-remote";
import type { MediaWithUrl } from "@/lib/memory/types";

type MediaContext = "memory" | "event" | "chapter";

export function MediaSection({
  userId,
  context,
  contextId,
  onChanged,
}: {
  userId: string;
  context: MediaContext;
  contextId: string;
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<MediaWithUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detaching, setDetaching] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const list =
      context === "memory"
        ? await listMemoryMedia(userId, contextId)
        : context === "event"
          ? await listEventMedia(userId, contextId)
          : await listChapterMedia(userId, contextId);
    setItems(list);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, contextId]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const result = await uploadMedia(userId, file, file.name, file.type, file.size);
    if ("error" in result) {
      setUploading(false);
      setError(result.error);
      return;
    }
    const ok = await attach(result.data.id);
    setUploading(false);
    if (!ok) {
      setError("Could not attach the image.");
      return;
    }
    await load();
    await onChanged();
  }

  async function attach(mediaId: string): Promise<boolean> {
    if (context === "memory") return attachMediaToMemory(userId, mediaId, contextId, items.length);
    if (context === "event") return attachMediaToEvent(userId, mediaId, contextId, items.length);
    return attachMediaToChapter(userId, mediaId, contextId, items.length);
  }

  async function handleDetach(mediaId: string) {
    setDetaching(mediaId);
    const ok =
      context === "memory"
        ? await detachMediaFromMemory(userId, mediaId, contextId)
        : context === "event"
          ? await detachMediaFromEvent(userId, mediaId, contextId)
          : await detachMediaFromChapter(userId, mediaId, contextId);
    setDetaching(null);
    if (ok) {
      await load();
      await onChanged();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Images</SectionLabel>
        <Button
          onClick={() => inputRef.current?.click()}
          size="sm"
          variant="ghost"
          className="gap-1.5"
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ImagePlus className="size-3.5" />
          )}
          {uploading ? "Uploading…" : "Add image"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading images…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images attached yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((m) => (
            <li
              key={m.id}
              className="group relative overflow-hidden rounded-md border border-border/40"
            >
              {m.signedUrl ? (
                <img
                  src={m.signedUrl}
                  alt={m.originalFilename ?? "image"}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  Unavailable
                </div>
              )}
              <button
                onClick={() => handleDetach(m.id)}
                disabled={detaching === m.id}
                className="absolute right-1 top-1 rounded bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Detach image"
              >
                {detaching === m.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <X className="size-3" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        Max {Math.round(MAX_MEDIA_BYTES / (1024 * 1024))} MB · JPEG, PNG, WebP
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}
