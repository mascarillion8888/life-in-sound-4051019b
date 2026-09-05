# SoundMap Roadmap

> Long-term product vision (lifelong music-memory companion, unlimited
> memory logging, pattern discovery) is documented in
> `docs/PRODUCT/PRODUCT_VISION.md` and `docs/PRODUCT/MUSIC_MEMORY.md`. That
> vision is **not yet reflected below** and must not be built until the
> validation gate after Phase 3 is passed — see note there.

## Phase 1 - Foundation

- Landing Page ✅
- Journey Wizard ✅
- Results Page ✅
- Responsive Design ✅

## Phase 2 - Experience

- Journey Persistence ✅
- Results Polish ✅
- Timeline Improvements ✅

## Phase 3 - Intelligence

- AI Story Engine
- Music DNA Engine
- Poster Engine

## Validation Gate (required before Phase 4)

- Show the Phase 1–3 flow (journey → results, deterministic + AI story) to
  at least 10 real people outside the project.
- Collect honest feedback: would they use this again, would they pay for a
  poster, would they come back to add another memory.
- Only after this gate is passed does work on Phase 4/6 begin. This gate
  exists because an earlier branch (`main`, checkpoint `7070c45`) built the
  full lifelong-companion system (Phase 6 below) before this validation
  happened, and that work was set aside as a result. Do not repeat that.

> **Pre-gate UI decision (no phase number):** MusicBrainz entegrasyonu UI'dan
> tamamen kaldırıldı (kullanıcı kararı, 2026-08-19) — tekrar tekrar tutarsız/
> alakasız sonuçlar üretmesi nedeniyle ("Sting - Fragile" aratınca obscure
> cover'lar üstte çıkıyordu). Karar: MusicBrainz bir metadata DB'sidir, tüketici
> arama motoru değil. Journey artık tek akış: serbest metin kutusu + "Onayla"
> butonu. Backend modülleri (`searchSong.server.ts`,
> `musicbrainz-mapping.ts`) arşivde duruyor — hiçbir UI bileşeni çağırmıyor;
> gelecekte gerçek bir kapak-görseli ihtiyacı çıkarsa farklı bir API ile
> yeniden değerlendirilebilir (ayrı ve gelecekteki bir karar, şimdi değil).
> Bug fix değil, ürün kararı; Validation Gate yine Phase 4 önkoşulu.

## Phase 4 - Platform

- User Accounts
- Cloud Storage
- Sharing

## Phase 5 - Launch

- Public Beta
- Product Hunt
- Mobile Apps

## Phase 6 - Lifelong Companion (design-only, not started)

- Unlimited, anytime memory logging (see `docs/PRODUCT/MUSIC_MEMORY.md`)
- Pattern discovery across memories
- Companion conversation / narrative voice over the full timeline
- Design exists; no schema or code in this branch. Requires the Validation
  Gate above to be passed first.
