import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Upgrades the current anonymous user to a Google account with linkIdentity, so
 * cards and journeys made as a guest stay with the same user id. Requires the
 * Google provider and "Allow manual linking" to be enabled in Supabase Auth.
 */
export function GoogleLinkButton({ isAnonymous }: { isAnonymous: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAnonymous) return null;

  const onClick = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (linkError) setError("Google sign-in is not available right now.");
    } catch {
      setError("Google sign-in is not available right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        data-testid="google-link"
        onClick={onClick}
        disabled={busy}
        className="rounded-full px-6"
      >
        {busy ? "Opening Google…" : "Save my cards with Google"}
      </Button>
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
