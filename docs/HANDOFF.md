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
Testler:   393/393 geçti (36 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Lint:      0 HATA, 9 react-refresh uyarısı pre-existing (ui/* shadcn +
           PosterCanvas + LanguageContext)
Build:     `npm run build` = 0 hata (Nitro .output)
card-studio: PORT TAMAMLANDI, dizin repodan KALDIRILDI
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Option B: Multidimensional Dynamic Card Engine (TAM)

Kullanıcı kararı B çıktı: card-studio'nun özellikleri ana stack'e portlandı
(NextAuth/Prisma/Vercel → Supabase Auth/SQL/Storage + Nitro server fn),
ardından `card-studio/` dizini repodan kaldırıldı.

### DB Migration & Storage Port

- **`supabase/migrations/0003_cards.sql`** (yeni): `public.cards` tablosu —
  Prisma `Card` modelinin Supabase karşılığı + multidimensional alanlar
  (`birth_year`, `encounter_age`, `era_year` generated column, `genre`,
  `user_memory`, `scene`, `lore`, `image_path`). RLS: 4 owner policy
  (`auth.uid() = user_id`), 0001 ile aynı desen. **Storage:** private
  `card-artworks` bucket + 4 storage policy (ilk path segmenti =
  `auth.uid()`). NextAuth session → Supabase Auth `auth.uid()` eşlemesi.
- **Vercel Blob → Supabase Storage:** painting byte'ları
  `<user_id>/<card_uuid>.png` olarak private bucket'a; tablo `image_path`
  tutar.

### Multidimensional Prompt Engine

- **`src/lib/art/cardBlueprint.ts`** (yeni, saf/deterministik):
  - `historicalEraYear`: birthYear + encounterAge → encounter yılı (ör. 1987).
  - `buildMultidimensionalPrompt`: blueprint'in 3 sabit cümlesi —
    Subject ("A silhouette of a child (aged N) … over-ear headphones,
    deeply absorbed in music"), Framing ("a small framed fine-art portrait
    of [artist] … dark gothic woodcut chiaroscuro"), Atmosphere ("Dark
    gothic woodcut engraving style, candlelit chiaroscuro, etched ink
    textures, nostalgic [decade] room elements"). Genre → oda/ışık/nesne
    korelasyonu (7 aile, gothic default). `userMemory` sahneye dokunur.
  - `cardArtworkSceneForGenre`: mevcut scene ladder'ın aynası (keyword
    aileleri → decade ladder → gothic null fallback).
  - `deterministicLore`: track-seeded 2-cümlelik poetic snippet (4 opener ×
    4 closer; LLM yoksa lore kutusu asla boş kalmaz).
- **`src/lib/art/generateCard.server.ts`** (yeni server fn `generateCard`):
  lore (Orchestra `summarizer` + deterministic fallback) + painting
  (`generateCardArtworkCore` + `promptOverride`) paralel; persist
  (`persistCardCore`): kullanıcının KENDİ access token'ıyla anon-key
  Supabase client → RLS altında storage upload + `cards` insert;
  günlük 20 kart kotası (card-studio DAILY_LIMIT portu). Asla throw yok:
  lore→deterministic, image→null (gothic placeholder), persist→skip.
- **`cardArtwork.server.ts`:** `CardArtworkInput.promptOverride` eklendi —
  blueprint brief'i internal brief'in yerine geçer; scene hâlâ cache
  identity'sini besler. Validator 2000 char cap ile geçirir.

### Client Wiring

- **`src/lib/art/useCardLore.ts`** (yeni hook): lore + persist tetikleyicisi;
  session token'ı client'tan alıp server'a iletir; module-level lore cache
  (track başına bir kez). Hata → null → kart deterministik narrative'de
  kalır.
- **`QuizCard.tsx`:** lore önceliği `lore ?? copy?.body ?? card.narrative`;
  shimmer sweep (`card-shimmer` keyframes, `src/styles.css`) skeleton'a
  eklendi — kapaksız şarkıda painting üretilirken altın tarama çerçeve
  üstünden geçer.
- **iTunes 30s audio + reveal:** zaten vardı, dokunulmadı —
  `useAudioPreview` (singleton fade, previewUrl iTunes'tan) +
  `EraCardReveal` (autoPlayPreview) + skeleton→fade-in (`animate-in
  fade-in duration-1000`).

### Test & Kanıt

- Yeni testler: `cardBlueprint.test.ts` (18: era yılı, decade label,
  blueprint cümleleri, genre korelasyonu, scene ladder, lore determinizmi)
  + `generateCard.server.test.ts` (6: LLM lore başarı/degenerate/fail
  fallback'leri, persist skip yolları) → **393/393**, tsc 0, lint 0, build 0.
- **Tarayıcı kanıtı (STATE.md kural 10), dev server 12000, `/journey?fresh=1`:**
  1. **Fragile / Sting (1987)** seçildi → EraCardReveal açıldı, `'80s`
     rozeti, audio preview butonu aktif, kart gövdesinde YENİ lore:
     "The house is quiet; only the headphones glow with sound… Some doors,
     once opened by a melody, never fully close again." Screenshot alındı.
  2. **Manuel kapaksız şarkı** ("Zzqxw Nonexistentsong") → shimmer'lı
     gothic skeleton canlı görüldü + farklı track-seeded lore ("A door
     closes, a record spins…"). Screenshot alındı.
- **Not:** Bu ortamda GEMINI/HF/GROQ key'leri yok → painting zinciri
  placeholder'a düşer (tasarım gereği), lore deterministik servis eder.
  Supabase env yok → persist sessizce atlanır. Key'li ortamda tüm zincir
  aynı kod yolundan akar.

`393/393, tsc 0, lint 0, build 0.`

---

## 2b. Önceki iş — card-studio zip entegrasyonu başlangıcı (TAM, üstüne inşa edildi)

Zip → `card-studio/` izole çıkarımı + stack analizi + prettier drift fix
(lockfile 3.9.6; 2 dosyada 9 pre-existing prettier hatası `--fix`'lendi).
Karar B ile dizin kaldırıldı; `.env.example`'a `GROQ_API_KEY` belgelendi.

## 2c. Önceki iş — Hugging Face Inference Artwork Tier (TAM)

Üçüncü provider: Imagen → Gemini native → HF Inference. Default model
`stabilityai/stable-diffusion-3-medium-diffusers` (SDXL/FLUX 410 Gone).
Tarayıcıda canlı doğrulandı. 369/369.

## 2d. Önceki iş — Grand Finale: Cosmic Poster Grid (TAM)

`/results` 4×2 cosmic grid + unframing animasyonu + CosmicBackdrop.
360/360, tarayıcı kanıtlı.

## 2e. Önceki iş — Painterly Backdrops + Dynamic Atmosphere (TAM)

Generator painterly rewrite + 7 scene family + decade ladder.
359/359, tarayıcı kanıtlı.

---

## 3. Sıradaki iş adımları

1. **KULLANICI AKSİYONU:** `supabase/migrations/0003_cards.sql`'i Supabase
   projesine uygula (SQL editor veya `supabase db push`) — cards tablosu +
   card-artworks bucket + policy'ler ancak o zaman canlı olur. Uygulanmadan
   persist katmanı sessizce skip'ler (ürün kırılmaz).
2. Key'li ortamda uçtan uca doğrulama: `GEMINI_API_KEY` veya
   `HUGGINGFACE_API_KEY` + `GROQ_API_KEY` + Supabase env → bir kart
   üretiminde painting + LLM lore + `cards` satırı + storage object
   birlikte görülmeli.
3. Faz 4 tasarım onayı hâlâ açık (`docs/TECH/DATABASE_PLAN.md` DRAFT) —
   `cards` tablosu artık onun ilk somut parçası; Music Memory modeliyle
   ilişkilendirme kararı tasarım onayında.
4. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
5. HANDOFF tam rewrite + commit `checkpoint: ... — HANDOFF.md güncellendi`.

---

## 4. Olası tuzaklar

- **Migration uygulanmadan persist test edilemez:** `persistCardCore` env
  yoksa/token yoksa `false` döner, UI bunu yüzeye çıkarmaz. "Kartlar
  kaydedilmiyor" şikâyeti = önce §3.1'i kontrol et.
- **Lore cache anahtarı track key:** aynı şarkı farklı sorularda AYNI
  lore'u alır (deterministic seed de track key). Farklı yaş bağlamı istenen
  senaryo için seed'e cardIndex eklemek gerekir — bilinçli karar: şarkının
  kartı tek olsun.
- **`promptOverride` cache identity'yi değiştirmez:** scene aynıysa aynı
  track için process cache eski painting'i döndürebilir — blueprint
  encounter'a göre değişse bile. Şu an blueprint yalnız `generateCard`
  üzerinden akıyor ve trackKey'e `::card` suffix'i ekliyor; klasik akışla
  çakışma yok.
- **Daily limit sayımı server-side:** `cards` tablosu boşken (migration
  öncesi) kota hiç devreye girmez; 20 limiti yalnız persist aktifken bağlar.
- **`era_year` generated column:** Supabase/Postgres 12+ gerektirir
  (managed Supabase'de sorun yok).
- Prettier drift dersi: lockfile 3.9.6 pin'li — fresh install'da eski
  "lint 0" iddialarına güvenme, `npm run lint`'i her zaman çalıştır.

---

## 5. Bu oturumda öğrenilen kritik bilgi

- card-studio'nun değerli kısmı stack'i değil **blueprint'iymiş**: subject/
  framing/atmosphere cümleleri + birthYear+encounterAge korelasyonu. Port
  bu yüzden "dosya taşıma" değil "motor yeniden yazımı" oldu — 3 küçük
  modül (blueprint, server fn, lore hook) tüm özelliği taşıdı.
- Persist için service-role GEREKMEZ: client'ın access token'ını server
  fn'a iletip anon-key client + Authorization header ile kullanmak RLS'i
  tam korur (PostgREST + Storage policy'leri aynı JWT'yi görür).
- `generated always as … stored` kolonu RLS policy'lerinde kullanılabilir
  ama burada sadece sorgu kolaylığı — policy'ler `user_id` üstünde.
- jsdom testlerinde `vi.stubEnv("GROQ_API_KEY", "")` orchestra'nın
  `getApiKey` kontrolünü fallback'e düşürür — LLM yolu fetchImpl mock'uyla
  izole test edilir, ağ yok.

---

## 6. Yapılmaması gerekenler

- NextAuth/Prisma/Vercel Blob pattern'lerini geri getirme — port tamamlandı,
  referans implementasyon silindi (git history'de: `git log --all --
  card-studio/`).
- `cards` tablosuna service-role ile yazma — anon + RLS yeterli ve kural.
- Lore'u client'ta uydurma — tek kaynak server (`generateCard`); client
  fallback'i bile server'ın deterministic çıktısı.
- Kaldırılmış companion v1 sistemini geri getirme (arşiv:
  `legacy/companion-v1-2026-08-15`).
- Faz 4'e kullanıcı onayı olmadan geçme.

---

## 7. Devir kaydı (son 5 commit)

```
git log --oneline -5 çıktısına bak — metne değil, git'e güven.
Son satır bu oturumun checkpoint'i olmalı:
checkpoint: Option B — multidimensional card engine portu — HANDOFF.md güncellendi
```
