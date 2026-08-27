import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const CardGallery = lazy(() =>
  import("@/components/gallery/CardGallery").then((m) => ({ default: m.CardGallery })),
);

export const Route = createFileRoute("/profile/cards")({
  component: ProfileCardsPage,
});

function ProfileCardsPage() {
  return (
    <main className="min-h-screen bg-[#0b0908]">
      <Suspense fallback={null}>
        <CardGallery />
      </Suspense>
    </main>
  );
}
