import { createFileRoute } from "@tanstack/react-router";

import { CardGallery } from "@/components/gallery/CardGallery";

export const Route = createFileRoute("/profile/cards")({
  component: ProfileCardsPage,
});

function ProfileCardsPage() {
  return (
    <main className="min-h-screen bg-[#0b0908]">
      <CardGallery />
    </main>
  );
}
