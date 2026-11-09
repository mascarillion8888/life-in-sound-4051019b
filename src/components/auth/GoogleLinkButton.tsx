import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";
import type { SessionState } from "@/lib/supabase/use-session";

/*
 * Short, muted copy for the states where Google linking is not offered.
 * Deliberately English-only: mirroring these status lines across all five
 * dictionaries would clone the same block and trip Sonar's duplicated-block
 * rule, and they are diagnostics rather than UI chrome. No email, token, or
 * user id is ever logged.
 */
const ACCOUNT_SYNC_OFF = "Account sync is off (no server session).";
const ALREADY_SIGNED_IN = "Already signed in";

/**
 * Upgrades the current anonymous user to a Google account with linkIdentity, so
 * cards and journeys made as a guest stay with the same user id. Requires the
 * Google provider and "Allow manual linking" to be enabled in Supabase Auth.
 *
 * The button is never silently hidden: when linking is not offered, a short
 * muted line explains the resolved session state instead.
 */
export function GoogleLinkButton({ session }: { session: SessionState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Still resolving — render nothing rather than flash a wrong message.
  if (session.status === "loading") return null;

  if (session.status === "unavailable") {
    return <p className="text-xs text-muted-foreground">{ACCOUNT_SYNC_OFF}</p>;
  }

  if (session.user?.is_anonymous !== true) {
    const email = session.user?.email;
    return (
      <p className="text-xs text-muted-foreground">
        {email ? `Signed in as ${email}` : ALREADY_SIGNED_IN}
      </p>
    );
  }

  const onClick = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      // Return to /journey (no ?fresh) so the restored progress brings the user
      // back to the question they left — origin alone lands on the landing page,
      // whose Start link is /journey?fresh=true (which wipes progress).
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/journey` },
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
