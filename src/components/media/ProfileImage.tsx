/**
 * ProfileImage — current profile image management.
 *
 * v1: the profile has at most one active current profile image. Selecting a
 * new image replaces the current one but does NOT delete the old media (it
 * remains in the user's media library). Removing the current profile image
 * detaches the relationship without deleting the media.
 */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ALLOWED_MIME_TYPES,
  MAX_MEDIA_BYTES,
  attachMediaToProfile,
  detachMediaFromProfile,
  getSignedMediaUrl,
  loadCurrentProfileMedia,
  uploadMedia,
} from "@/lib/supabase/media-remote";
import type { Media } from "@/lib/memory/types";

export function ProfileImage({ userId }: { userId: string }) {
  const [current, setCurrent] = useState<Media | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const m = await loadCurrentProfileMedia(userId);
    setCurrent(m);
    setSignedUrl(m ? await getSignedMediaUrl(userId, m.id) : null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const result = await uploadMedia(userId, file, file.name, file.type, file.size);
    if ("error" in result) {
      setUploading(false);
      setError(result.error);
      return;
    }
    const ok = await attachMediaToProfile(userId, result.data.id);
    setUploading(false);
    if (!ok) {
      setError("Could not set the profile image.");
      return;
    }
    await load();
  }

  async function handleRemove() {
    if (!current) return;
    setRemoving(true);
    const ok = await detachMediaFromProfile(userId, current.id);
    setRemoving(false);
    if (ok) await load();
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Profile image</SectionLabel>
      <div className="flex items-center gap-4">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-muted">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : signedUrl ? (
            <img src={signedUrl} alt="Profile" className="size-full object-cover" />
          ) : (
            <User className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <div className="flex gap-2">
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
              {current ? "Replace" : "Select image"}
            </Button>
            {current && (
              <Button
                onClick={handleRemove}
                size="sm"
                variant="ghost"
                disabled={removing}
                className="gap-1.5"
              >
                {removing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <X className="size-3.5" />
                )}
                Remove
              </Button>
            )}
          </div>
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
          {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}
          <p className="text-[10px] text-muted-foreground">
            Replacing does not delete the previous image. Max{" "}
            {Math.round(MAX_MEDIA_BYTES / (1024 * 1024))} MB · JPEG, PNG, WebP
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}
