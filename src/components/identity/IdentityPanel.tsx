/**
 * IdentityPanel — anonymous → permanent identity continuity UI.
 *
 * Anonymous: "Your soundtrack is growing." + Keep my soundtrack (primary) /
 * Not now (secondary). Conversion uses Supabase's anonymous-user email linking
 * flow (updateUser({ email })) which preserves the SAME user id, so no data is
 * copied or deleted. No fear language, no repeated nagging (dismissal is
 * remembered in localStorage so we only ask once per device).
 *
 * Authenticated: minimal account identity + sign out (sign-out does not delete
 * data; all rows remain owned by the original user id under RLS).
 *
 * Conflict handling: if the email belongs to an existing account we surface an
 * existence-safe message ("We couldn't connect that email. Try another, or
 * sign into your existing account.") that does not disclose whether the account
 * exists.
 */
import { useState } from "react";
import { Loader2, LogOut, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  convertAnonymousToEmail,
  signOutIdentity,
  type ConversionError,
} from "@/lib/supabase/identity-remote";
import type { SessionState } from "@/lib/supabase/use-session";

const DISMISS_KEY = "lis:identity:dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore storage failures
  }
}

function messageForError(code: ConversionError): string {
  switch (code) {
    case "invalid-email":
      return "That doesn't look like a valid email.";
    case "email-already-registered":
      // Existence-safe: same message whether or not the account exists.
      return "We couldn't connect that email. Try another, or sign into your existing account.";
    case "rate-limited":
      return "Too many attempts. Please wait a moment and try again.";
    case "not-anonymous":
      return "Your soundtrack is already connected.";
    case "no-session":
      return "We couldn't reach your session. Please refresh and try again.";
    case "user-id-mismatch":
      return "Something went wrong connecting your identity. Your memories are safe — no changes were made.";
    default:
      return "We couldn't connect that email. Please try again.";
  }
}

export function IdentityPanel({ session }: { session: SessionState }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [dismissed, setDismissed] = useState(() => isDismissed());

  if (session.status !== "anonymous" && session.status !== "authenticated") {
    return null;
  }

  // ---- Authenticated ------------------------------------------------------
  if (session.status === "authenticated") {
    const user = session.user;
    const emailShown = user.email ?? user.phone ?? "Connected account";
    return (
      <section className="space-y-3 border-t border-border/40 pt-8">
        <SectionLabel>Identity</SectionLabel>
        <div className="rounded-lg border border-border/40 p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Your soundtrack is connected.</p>
            <p className="text-xs text-muted-foreground break-all">{emailShown}</p>
          </div>
          <Button
            onClick={async () => {
              setSigningOut(true);
              await signOutIdentity();
              setSigningOut(false);
            }}
            size="sm"
            variant="ghost"
            disabled={signingOut}
            className="gap-1.5"
          >
            {signingOut ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5" />
            )}
            Sign out
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Signing out does not delete your memories — they stay linked to your account.
          </p>
        </div>
      </section>
    );
  }

  // ---- Anonymous ----------------------------------------------------------
  if (dismissed && !busy && !sent) {
    // Respect the dismissal; no nagging.
    return null;
  }

  return (
    <section className="space-y-3 border-t border-border/40 pt-8">
      <SectionLabel>Identity</SectionLabel>
      <div className="rounded-lg border border-border/40 p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Your soundtrack is growing.</p>
          <p className="text-xs text-muted-foreground">
            Keep your memories with you across devices.
          </p>
        </div>

        {sent ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Check your email to confirm and connect your soundtrack. Your memories stay exactly
              where they are.
            </p>
            <Button onClick={() => setSent(false)} size="sm" variant="ghost">
              Use a different email
            </Button>
          </div>
        ) : (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setBusy(true);
              const result = await convertAnonymousToEmail(email);
              setBusy(false);
              if (result.ok) {
                setSent(true);
                setEmail("");
              } else {
                setError(messageForError(result.error));
              }
            }}
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8"
                  required
                  disabled={busy}
                />
              </div>
              <Button type="submit" size="sm" disabled={busy || email.trim().length === 0}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Keep my soundtrack"}
              </Button>
            </div>
            {error && <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p>}
            <button
              type="button"
              onClick={() => {
                dismiss();
                setDismissed(true);
              }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Not now
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}
