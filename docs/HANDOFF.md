# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      bu oturumun işi COMMIT'LENDİ ve PUSH TAMAM
           (literal SHA `git log -1` ile doğrulanır; git'e güven, metne değil).
Testler:   413/413 geçti (39 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Lint:      0 HATA, 9 react-refresh uyarısı pre-existing (ui/* shadcn +
           PosterCanvas + LanguageContext)
Build:     `npm run build` = 0 hata (Nitro .output)
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Card Gallery & Social Share Poster (TAM)

### Card Gallery (`/profile/cards`)

- **`src/lib/supabase/cards-remote.ts`** (yeni): `cards` tablosunun okuma
  yolu. `toCardRow` — snake_case → camelCase doğrulama (id/title/track_key
  zorunlu; bozuk alanlar null'a düşer, satır asla crash ettirmez).
  `loadRemoteCards` (created_at desc) + `resolveCardImageUrls` (private
  `card-artworks` bucket'tan 1 saatlik signed URL; nesne bazlı hata →
  imageUrl null → gothic placeholder). Tüm başarısızlıklar `[]` döner.
  RLS: anon key + `auth.uid() = user_id` policy'leri (migration 0003) —
  başkasının kartına bu modülden erişmek veritabanı seviyesinde imkânsız.
- **`src/components/gallery/galleryModel.ts`** (yeni, saf): sort
  (newest/oldest/era/age — bilinmeyenler sona, stable) + scene filtresi +
  `availableScenes`. Mutasyon yok.
- **`src/components/gallery/CardGallery.tsx`** (yeni): gothic grid —
  QuizCard görsel dili (gem-tone border, candlelit art frame, italic lore,
  stat row: era caption + deterministik discovery score). Kontroller:
  4 sort + "Tümü/All" + scene chip'leri (kartlarda var olan sahneler).
  Boş durum: "Henüz keşfedilmiş bir müzik anın yok" + `/journey?fresh=true`
  linki. TR/EN dil desteği (useLanguage).
- **`src/routes/profile/cards.tsx`** (yeni route): session loading →
  spinner; Supabase yoksa/boşsa empty state.

### Social Share Poster (1080×1920 Instagram Story)

- **`src/lib/soundmap/sharePoster.ts`** (yeni): canvas-only renderer
  (DOM rasterizasyonu yok — poeticPoster ile aynı güven modeli). Layout:
  gothic vignette → scene eyebrow → Cinzel başlık + italic artist →
  çift çerçeveli painting (yoksa elle çizilmiş mum ışığı placeholder,
  ASLA kırık img yok) → era caption + DISCOVERY nn/100 → italic Playfair
  lore (greedy wrap, 4 satır cap + ellipsis) → "LIFEINSOUND — MULTIVERSE
  SOUNDTRACK" watermark. `document.fonts.ready` await'lenir → webfontlar
  export'a taşınır. Saf helper'lar export'lu: `discoveryScore` (track-key
  seeded 40–99), `eraCaption`, `wrapText`, `POSTER_W/H`.
- **`src/components/gallery/SharePosterDialog.tsx`** (yeni): "Paylaş"
  modalı — canlı canvas önizleme (1080×1920 backing store, CSS-ölçekli)
  + tek tık PNG indirme (`İndir / Hikâyede Paylaş`).
  **Önemli düzeltme:** Radix Dialog portal'ı lazy-mount eder; `useRef` +
  effect yarışı canvas'ı boş bırakıyordu → callback-ref + state
  (`setCanvasEl`) ile çözüldü. Bu deseni portal içi canvas'ta tekrar kullan.

### Test & Kanıt

- Yeni testler: `cards-remote.test.ts` (3), `sharePoster.test.ts` (7 —
  `wrapText` boş-girdi overflow bug'ı yakalandı ve düzeltildi),
  `galleryModel.test.ts` (10) → **413/413**, tsc 0, lint 0, build 0.
- **Tarayıcı kanıtı (STATE.md kural 10), dev 12000:** `/profile/cards`
  empty state (linkli) ✓; geçici `/dev-poster` route'uyla modal + poster
  render canlı doğrulandı (fontlar, oran, lore, watermark — screenshot
  alındı) → geçici route silindi, tree regen edildi.
- **RLS doğrulaması:** bu ortamda Supabase projesi yok → policy'ler canlı
  test edilemedi; kural SQL'de (0003: 4 tablo policy + 4 storage policy,
  path namespace = auth.uid). Key'li ortamda doğrulanacaklar listesinde.

`413/413, tsc 0, lint 0, build 0.`

---

## 2b. Önceki iş — Option B: Multidimensional Dynamic Card Engine (TAM)

card-studio portu: `0003_cards.sql` (cards + RLS + card-artworks bucket),
`cardBlueprint.ts` (birthYear+encounterAge→era, genre→oda/ışık, 3-cümle
blueprint), `generateCard.server.ts` (lore summarizer + deterministic
fallback, painting promptOverride, persist caller-token RLS + 20/gün kota),
`useCardLore` + QuizCard lore/shimmer. card-studio/ kaldırıldı. 393/393'tü.

## 2c. Önceki işler (TAM)

HF artwork tier (SD3-medium) · Cosmic Poster Grid · Painterly Backdrops.
Detaylar git history'de — bu dosya günlük değildir.

---

## 3. Sıradaki iş adımları

1. **KULLANICI AKSİYONU (hâlâ açık):** `0003_cards.sql`'i Supabase'e
   uygula — uygulanmadan gallery hep empty state gösterir, persist skip'ler.
2. Key'li ortamda uçtan uca zincir: kart üret → `cards` satırı + storage
   object → `/profile/cards`'da görünür → Paylaş → PNG iner. RLS negatif
   testi: ikinci bir anon tarayıcıyla başkasının kartı görünmemeli.
3. Gallery'ye giriş linki: `/profile/cards` henüz hiçbir sayfadan linkli
   değil — nav/sonuç sayfasına bağlantı kararı kullanıcıda.
4. Faz 4 tasarım onayı açık (`docs/TECH/DATABASE_PLAN.md` DRAFT).
5. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
6. HANDOFF tam rewrite + commit `checkpoint: ... — HANDOFF.md güncellendi`.

---

## 4. Olası tuzaklar

- **Portal içi canvas:** Radix Dialog/Sheet içinde canvas render ederken
  `useRef`+effect yarışına GİRME — callback ref + state desenini kullan
  (SharePosterDialog'daki gibi). Aksi hâlde canvas sessizce boş kalır.
- **Signed URL TTL 1 saat:** uzun açık kalan gallery oturumunda painting'ler
  expire olur; sayfa yenileme yeniler. Kalıcı public URL bilinçli olarak
  YOK (bucket private).
- **Lore cache:** `useCardLore` track-key bazlı; gallery kartı server'daki
  saklı lore'u gösterir (yeniden üretim yok) — iki yol bilinçli ayrık.
- **routeTree.gen.ts:** yeni route ekleyince build/dev regen eder; tsc
  hatası görürsen önce bir kez build çalıştır.
- Prettier drift dersi: lockfile 3.9.6 pin'li — `npm run lint`'i her zaman
  çalıştır.

---

## 5. Bu oturumda öğrenilen kritik bilgi

- Canvas poster export'ta `document.fonts.ready` await'lemek webfont
  (Cinzel/Playfair) sadakatini garantiler — await'lenmezse sistem serif'e
  düşer.
- `wrapText` gibi greedy wrapper'larda overflow dalı yalnız
  `lines.length === maxLines` iken çalışmalı; boş girdi sessizce
  `[undefined, …, "…"]` üretebilir — testle yakalandı.
- Gallery, QuizCard'ı yeniden kullanmak YERİNE aynı görsel dili taşıyan
  hafif GalleryCard kullanır: QuizCard'ın artwork/lore hook'ları server
  çağrısı tetiklerdi; gallery satırı zaten her şeyi taşıyor.
- jsdom testlerinde canvas render yok — renderer'ın saf parçalarını
  (wrap/score/caption) export edip onları test et; render'ın kendisini
  tarayıcıda doğrula.

---

## 6. Yapılmaması gerekenler

- `card-artworks` bucket'ını public yapma — signed URL + RLS kural.
- Gallery'de service-role kullanma — anon + RLS yeterli ve kural.
- Poster export'a DOM rasterizasyon (html-to-image vb.) ekleme — canvas
  renderer bilinçli tercih (font/CORS/perf güvenliği).
- Kaldırılmış companion v1 sistemini geri getirme (arşiv:
  `legacy/companion-v1-2026-08-15`).
- Faz 4'e kullanıcı onayı olmadan geçme.

---

## 7. Devir kaydı (son 5 commit)

```
git log --oneline -5 çıktısına bak — metne değil, git'e güven.
Son satır bu oturumun checkpoint'i olmalı:
checkpoint: card gallery + social share poster — HANDOFF.md güncellendi
```
