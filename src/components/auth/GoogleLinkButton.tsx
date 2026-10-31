import { useState } from "react";
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
    <div>
      <button type="button" data-testid="google-link" onClick={onClick} disabled={busy}>
        {busy ? "Opening Google…" : "Save my cards with Google"}
      </button>
      {error && (
        <div role="alert" style={{ color: "#c0392b", fontSize: 14 }}>
          {error}
        </div>
      )}
    </div>
  );
}
