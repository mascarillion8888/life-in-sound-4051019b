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
Testler:   369/369 geçti (34 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Lint:      0 HATA, 9 react-refresh uyarısı pre-existing (ui/* shadcn +
           PosterCanvas + LanguageContext)
Build:     `npm run build` = 0 hata (Nitro .output)
card-studio: kendi içinde `npm install` + `npm run build` TEMİZ (Next.js 14,
           prisma generate dahil; .env yok, runtime denemesi yapılmadı)
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — card-studio zip entegrasyonu BAŞLANGICI (izole çıkarım)

Kullanıcı `/workspace/lifeinsound-app (1).zip` yükledi ve "entegrasyon
adımlarını başlat" dedi. Zip **bağımsız bir Next.js 14 uygulaması** çıktı:
"LifeInSound Kart Üretici" — Google OAuth (NextAuth) ile giriş, Gemini
2.5 flash image ile sunucu-taraflı kart görseli üretimi, Prisma + Vercel
Postgres'te kart kaydı, Vercel Blob'da görsel saklama, kullanıcı başı
20/gün kota, kişisel kart galerisi.

### NEDEN izole çıkarım (port değil)

Zip'in stack'i ana ürünle **doğrudan çelişiyor** ve STATE.md "onay olmadan
büyük karar yok" dediği için port kararı kullanıcıya bırakıldı:

| card-studio (zip)              | Ana ürün (SoundMap)                    |
| ------------------------------ | -------------------------------------- |
| Next.js 14 app router          | TanStack Start + Vite (`src/routes/`)  |
| NextAuth + Google OAuth        | Supabase Auth (anon, RLS)              |
| Prisma + Vercel Postgres       | Supabase Postgres + SQL migration'lar  |
| Vercel Blob                    | (üründe blob storage yok)              |
| Gemini 2.5 flash image direct  | Imagen → Gemini native → HF zinciri    |
| Vercel deploy                  | Node + Nitro + Docker (STATE.md)       |

### Yapılanlar (bu oturum)

1. Zip `/tmp`'e çıkarılıp incelendi, sonra repo kökünde **`card-studio/`**
   dizinine taşındı — ana ürün koduna (`src/`) hiç dokunulmadı.
2. `eslint.config.js` ignore listesine `card-studio` eklendi (yabancı stil
   kurallı ayrı codebase; ana repo lint'ini kirletmesin).
3. **Pre-existing prettier drift düzeltildi:** lockfile prettier 3.9.6
   pin'liyor; fresh `npm install` sonrası `scripts/generate-room-backdrop.mjs`
   ve `src/lib/art/hfImage.server.test.ts`'de 9 prettier hatası çıkıyordu
   (önceki "lint 0" iddiası daha eski prettier sürümüyle yapılmıştı).
   `eslint --fix` ile format-only düzeltildi — davranış değişikliği yok.
4. Ana repo doğrulaması: **369/369 test, tsc 0, lint 0 hata, build 0.**
5. card-studio kendi başına doğrulandı: `npm install` (prisma generate dahil)
   + `npm run build` temiz; route'lar derleniyor (`/`, `/api/auth/[...nextauth]`,
   `/api/cards`, `/api/generate`). Runtime denemesi YAPILMADI — Google OAuth
   + DATABASE_URL + BLOB token + GEMINI_API_KEY gerekiyor (`.env.example`'da
   listeli).
6. card-studio'nun kendi `.gitignore`'u nested olarak `node_modules/` ve
   `.next/`'i hariç tutuyor — repoya sadece kaynak + `package-lock.json`
   girdi.

`369/369, tsc 0, lint 0, build 0 + card-studio standalone build 0.`

---

## 2b. Önceki iş — Hugging Face Inference Artwork Tier (TAM)

Era Card artwork zincirine üçüncü provider: **Imagen → Gemini native image →
HF Inference** (`src/lib/art/hfImage.server.ts`). Server-only
`HUGGINGFACE_API_KEY`, asla throw yok (her hata `null` → gothic placeholder),
stil sabiti suffix'i, binary/JSON content-type disiplini, 503 retryable.
**Kritik canlı düzeltme:** SDXL/FLUX hf-inference kataloğundan kaldırılmış
(410 Gone); default model **`stabilityai/stable-diffusion-3-medium-diffusers`**
— katalogda text-to-image için kalan tek model. Tarayıcıda canlı doğrulandı
(Iron Maiden → HF üretimi gothic painting). 369/369.

## 2c. Önceki iş — Grand Finale: Cosmic Poster Grid (TAM)

`/results` posteri: 8 kart unframing animasyonuyla 4×2 cosmic grid'e
oturur, `CosmicBackdrop` scene-family painterly katmanları screen blend ile
arkada sıralı fade-in. 360/360, tarayıcı kanıtlı.

## 2d. Önceki iş — Painterly Backdrops + Dynamic Atmosphere (TAM)

Generator painterly rewrite (softRect, gaussian ışık, fBm grain; `jitter`
0-255 clamp bugfix'i) + 7 scene family (soul/grunge/hiphop eklendi, decade
ladder). 7 backdrop PNG ~1.0-1.1 MB. 359/359, tarayıcı kanıtlı.

---

## 3. Sıradaki iş adımları

1. **KULLANICI KARARI BEKLENİYOR:** card-studio yönü (§4'teki A/B/C).
2. Karar B (port) çıkarsa sıradaki çalıştırılabilir adım — port planı:
   - NextAuth → Supabase Auth (Faz 5 ile birlikte, anon → email migration)
   - Prisma `Card` modeli → `supabase/migrations/0003_cards.sql` (RLS:
     `auth.uid() = user_id`, service-role yok)
   - Vercel Blob → Supabase Storage bucket (`cards/`)
   - `/api/generate` → TanStack server route; görsel üretimini mevcut
     `cardArtwork.server.ts` zincirine (Imagen → Gemini → HF) bağla,
     Gemini-direct çağrıyı ayrı tutma
   - Günlük kota → DB count + RLS (DAILY_LIMIT=20 referans)
   - Kart galerisi UI → `src/routes/` altında yeni route (Next.js `app/`
     pattern'i ASLA kopyalanmaz)
3. Karar A çıkarsa: card-studio olduğu gibi kalır; çalıştırmak istenirse
   `.env.example`'daki 6 değişken gerekir (Google Cloud OAuth + Vercel
   Postgres + Blob + Gemini key).
4. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
5. HANDOFF tam rewrite + commit `checkpoint: ... — HANDOFF.md güncellendi`.

---

## 4. Olası sonuçlar (card-studio kararı)

- **A) İzole iç araç:** card-studio repo içinde bağımsız kart-tasarım
  stüdyosu olarak kalır; ana ürün etkilenmez. En düşük risk, sıfır port
  maliyeti. (Şu anki durum bu.)
- **B) Ana ürüne port:** kart kalıcılığı + kullanıcı galerisi + kota
  özellikleri Supabase/Nitro stack'ine taşınır (Faz 4/5 kapsamıyla
  örtüşür); card-studio referans implementasyon olarak kullanılıp sonra
  arşivlenir/silinir. Orta maliyet, ürün yol haritasıyla uyumlu.
- **C) Ayrı yaşam:** card-studio ana repodan çıkarılıp ayrı repo/deploy
  (Vercel) olarak yaşar. Ana repo temiz kalır ama iki ürün bakımı gerekir.

---

## 5. Bu oturumda öğrenilen kritik bilgi

- **Prettier sürüm drift'i gerçek:** lockfile 3.9.6 pin'li; eski HANDOFF'ların
  "lint 0" iddiaları daha eski prettier'la yapılmış. Fresh clone'da 9
  pre-existing prettier hatası çıkıyordu — `--fix` ile kalıcı düzeltildi,
  artık her ortamda lint 0.
- card-studio'nun `npm run build`'i env değişkenleri OLMADAN da derleniyor
  (NextAuth/Gemini key'ler runtime'da okunuyor, build-time'da değil).
- Zip'teki `.gitignore` nested çalışıyor; `card-studio/node_modules` ve
  `.next` git'e girmiyor — ayrıca ana `.gitignore`'a eklemeye gerek yok.
- `app/api/generate/route.js`'teki Gemini çağrısı `gemini-2.5-flash-image`
  modelini kullanıyor ve referans görsel (img2img) destekliyor — ana ürünün
  scene-prompt zincirinden farklı bir yaklaşım (port kararında değerlendir).

---

## 6. Yapılmaması gerekenler

- card-studio'dan `app/`, `layout.jsx`, NextAuth, Prisma pattern'lerini
  `src/` içine KOPYALAMA — repo kuralı: file-based routing `src/routes/`,
  Next.js pattern'i yasak.
- Vercel Blob/Postgres bağımlılığını ana ürüne TAŞIMA — deployment hedefi
  Node + Nitro + Docker; storage gerekirse Supabase Storage.
- Ana repoya Prisma ekleme — veri erişimi Supabase SQL migration + RLS ile.
- card-studio'yu kullanıcı kararı (§4) olmadan silme veya ana ürüne bağlama.
- Kaldırılmış companion v1 sistemini geri getirme (arşiv:
  `legacy/companion-v1-2026-08-15`).

---

## 7. Devir kaydı (son 5 commit)

```
git log --oneline -5 çıktısına bak — metne değil, git'e güven.
Son satır bu oturumun checkpoint'i olmalı:
checkpoint: card-studio zip entegrasyonu başlangıcı — HANDOFF.md güncellendi
```
