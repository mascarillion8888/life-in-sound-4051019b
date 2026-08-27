/**
 * Card Gallery — the user's persisted Era Cards in a gothic grid.
 *
 * Data comes from `loadGalleryCards()` (Supabase `cards` table, RLS-scoped
 * to the caller; paintings via signed URLs from the private bucket). Cards
 * render in the same dark-gothic frame language as the journey's QuizCard:
 * gem-tone border, candlelit art frame, italic lore, stat row. Sorting and
 * scene filtering are pure (`galleryModel.ts`).
 *
 * Every failure path (no Supabase, no session, network error) resolves to
 * the empty state with a link back to /journey — the gallery never breaks.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Music, Share2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { eraCaption } from "@/lib/soundmap/sharePoster";
import { loadGalleryCards, type CardRow } from "@/lib/supabase/cards-remote";
import { useSession } from "@/lib/supabase/use-session";

import {
  applyGalleryView,
  availableScenes,
  SORTS,
  type GalleryFilter,
  type GallerySort,
} from "./galleryModel";
import { SharePosterDialog } from "./SharePosterDialog";

const TONE_BORDERS = ["#d8a65a", "#a78bfa", "#c0c8d8"] as const;

function toneFor(index: number): string {
  return TONE_BORDERS[index % TONE_BORDERS.length];
}

function GalleryCard({
  card,
  index,
  onShare,
}: {
  card: CardRow;
  index: number;
  onShare: (card: CardRow) => void;
}) {
  const gem = toneFor(index);
  const caption = eraCaption(card);
  const [errored, setErrored] = useState(false);
  const imageUrl = errored ? null : (card.imageUrl ?? null);

  return (
    <article
      data-testid="gallery-card"
      className="flex flex-col rounded-xl border bg-[#14100c] p-3 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]"
      style={{ borderColor: `${gem}55` }}
    >
      {/* Art frame — painting or candlelit gothic placeholder. */}
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-lg border border-[#3a2f26] bg-[#0b0908]"
        style={{ boxShadow: `inset 0 0 40px rgba(0,0,0,0.8), 0 0 24px ${gem}22` }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${card.title} — ${card.artist}`}
            className="h-full w-full object-cover"
            style={{ filter: "saturate(0.82) contrast(1.08) brightness(0.94) sepia(0.18)" }}
            onError={() => setErrored(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span
              aria-hidden
              className="block h-1/2 w-2/3 rounded-t-full border-t-2"
              style={{ borderColor: `${gem}66`, boxShadow: `0 -18px 50px -10px ${gem}44` }}
            />
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(7,5,5,0.55) 100%)",
          }}
        />
      </div>

      {/* Eyebrow + title */}
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d8a65a]">
        {card.scene}
      </p>
      <h3
        className="mt-1 truncate text-base font-bold tracking-wide text-[#ece2c8]"
        style={{ fontFamily: "'Cinzel', Georgia, serif" }}
      >
        {card.title}
      </h3>
      <p className="truncate text-xs italic text-[#b8a890]">{card.artist || "—"}</p>

      {/* Stat row — grounded badge (no personality/discovery scoring). */}
      <div className="mt-2 flex items-center justify-between border-t border-[#3a2f26] pt-2 text-[10px] uppercase tracking-wider text-[#8f8168]">
        <span>{caption || "—"}</span>
        <span style={{ color: gem }}>grounded</span>
      </div>

      {/* Lore */}
      {card.lore ? (
        <p className="mt-2 line-clamp-3 text-[11px] italic leading-relaxed text-[#b8a890]">
          {card.lore}
        </p>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onShare(card)}
        className="mt-3 border-[#5c4a3e] bg-transparent text-[#d8a65a] hover:bg-[#d8a65a]/10 hover:text-[#e5b76b]"
      >
        <Share2 className="mr-2 h-3.5 w-3.5" aria-hidden />
        Paylaş
      </Button>
    </article>
  );
}

function EmptyState() {
  const { language } = useLanguage();
  return (
    <div
      data-testid="gallery-empty"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-[#3a2f26] bg-[#14100c] px-8 py-14 text-center"
    >
      <Sparkles className="h-8 w-8 text-[#d8a65a]" aria-hidden />
      <p className="text-lg font-semibold text-[#ece2c8]" style={{ fontFamily: "'Cinzel', serif" }}>
        {language === "tr"
          ? "Henüz keşfedilmiş bir müzik anın yok"
          : "No discovered music memories yet"}
      </p>
      <p className="text-sm italic text-[#b8a890]">
        {language === "tr"
          ? "Yolculuğa çık, şarkılarını seç — her dönemin kartı burada birikecek."
          : "Start the journey, pick your songs — each era's card will gather here."}
      </p>
      <Button asChild className="bg-[#d8a65a] font-semibold text-[#1a140e] hover:bg-[#e5b76b]">
        <Link to="/journey" search={{ fresh: true }}>
          <Music className="mr-2 h-4 w-4" aria-hidden />
          {language === "tr" ? "Yolculuğa Başla" : "Start the Journey"}
        </Link>
      </Button>
    </div>
  );
}

export function CardGallery() {
  const { language } = useLanguage();
  const session = useSession();
  const [cards, setCards] = useState<CardRow[] | null>(null);
  const [sort, setSort] = useState<GallerySort>("newest");
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [shareTarget, setShareTarget] = useState<CardRow | null>(null);

  useEffect(() => {
    if (session.status === "loading") return;
    let active = true;
    void loadGalleryCards().then((loaded) => {
      if (active) setCards(loaded);
    });
    return () => {
      active = false;
    };
  }, [session.status]);

  const scenes = useMemo(() => availableScenes(cards ?? []), [cards]);
  const visible = useMemo(() => applyGalleryView(cards ?? [], sort, filter), [cards, sort, filter]);

  const sortLabels: Record<GallerySort, string> =
    language === "tr"
      ? { newest: "En Yeni", oldest: "En Eski", era: "Dönem Yılı", age: "Yaş" }
      : { newest: "Newest", oldest: "Oldest", era: "Era Year", age: "Age" };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#d8a65a]">
          LifeInSound
        </p>
        <h1
          className="mt-2 text-3xl font-bold tracking-wide text-[#ece2c8]"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          {language === "tr" ? "Kart Koleksiyonun" : "Your Card Collection"}
        </h1>
      </header>

      {cards === null || session.status === "loading" ? (
        <div className="flex justify-center py-20" data-testid="gallery-loading">
          <Loader2 className="h-8 w-8 animate-spin text-[#d8a65a]" aria-hidden />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Controls */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            {SORTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                data-testid={`sort-${s}`}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                  sort === s
                    ? "border-[#d8a65a] bg-[#d8a65a]/15 text-[#e5b76b]"
                    : "border-[#3a2f26] text-[#8f8168] hover:border-[#5c4a3e]"
                }`}
              >
                {sortLabels[s]}
              </button>
            ))}
            <span aria-hidden className="mx-1 h-4 w-px bg-[#3a2f26]" />
            <button
              type="button"
              onClick={() => setFilter("all")}
              data-testid="filter-all"
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                filter === "all"
                  ? "border-[#d8a65a] bg-[#d8a65a]/15 text-[#e5b76b]"
                  : "border-[#3a2f26] text-[#8f8168] hover:border-[#5c4a3e]"
              }`}
            >
              {language === "tr" ? "Tümü" : "All"}
            </button>
            {scenes.map((scene) => (
              <button
                key={scene}
                type="button"
                onClick={() => setFilter(scene)}
                data-testid={`filter-${scene}`}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                  filter === scene
                    ? "border-[#d8a65a] bg-[#d8a65a]/15 text-[#e5b76b]"
                    : "border-[#3a2f26] text-[#8f8168] hover:border-[#5c4a3e]"
                }`}
              >
                {scene}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((card, i) => (
              <GalleryCard key={card.id} card={card} index={i} onShare={setShareTarget} />
            ))}
          </div>
        </>
      )}

      <SharePosterDialog
        card={shareTarget}
        open={shareTarget !== null}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null);
        }}
      />
    </section>
  );
}
