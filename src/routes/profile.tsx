import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { useSession, useUserId, useAccessToken } from "@/lib/supabase/use-session";
import { ProfileImage } from "@/components/media/ProfileImage";
import { IdentityPanel } from "@/components/identity/IdentityPanel";
import { CompanionMemoriesPanel } from "@/components/identity/CompanionMemoriesPanel";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile — Life in a Sound" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const session = useSession();
  const userId = useUserId(session);
  const accessToken = useAccessToken(session);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-40" />
      <main className="relative z-10 mx-auto min-h-screen max-w-2xl px-5 py-16 sm:px-6 md:py-24">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Profile</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Your profile image and identity. The same library is shared across your memories,
            events, and chapters.
          </p>
        </header>

        {userId ? (
          <div className="space-y-8">
            <ProfileImage userId={userId} />
            <IdentityPanel session={session} />
            {accessToken && <CompanionMemoriesPanel accessToken={accessToken} />}
          </div>
        ) : (
          <p className="py-32 text-center text-sm text-muted-foreground">
            Sign in to manage your profile image.
          </p>
        )}
      </main>
    </div>
  );
}
