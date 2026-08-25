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
Testler:   355/355 geçti (33 dosya; onError-artwork + backdrop-image testleri yeni)
tsc:       temiz (`npm run typecheck` = 0 hata)
Build:     `npm run build` = 0 hata (Nitro + postbuild-vercel-spa OK)
Lint:      `npm run lint` = 0 HATA (exit 0). Kalan 9 react-refresh uyarısı
           (ui/* shadcn + PosterCanvas.tsx + LanguageContext.tsx)
           pre-existing, kabul edilebilir.
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Rendered Room Backdrop + Artwork Hard-Guard (TAM)

Kullanıcı root-cause override'ı: canlı UI hâlâ flat 2D DOM/CSS vektörlü oda
(cyan lamba şekli, vektör kitap blokları) render ediyor; kart artwork'ü ise
boş kutu / bare-icon MusicNote alanına düşüyordu. İki düzeltme:

### Oda: build-time render edilmiş gerçek görsel (DOM vektörü YOK)

- **`src/components/scene/scenePalettes.ts` (YENİ):** tema paletleri
  React'siz modül; 4 tema (gothic/reggae/synth/jazz) — hem component hem
  generator okur.
- **`scripts/generate-room-backdrop.mjs` (YENİ):** `pngjs` + deterministik
  value-noise/fBm ile 1600×900 raster oda render'ı: panelli raf arkası,
  hub-banded/altın başlıklı kitap sırtları (tone/gutter/edge ışığı),
  oyma çerçeve, fener gölgesi lamba + yayılım, güneş ışığı köprüsü, masada
  bevelighted kutular, yatay ahşap masa damarları, vignette. Her tema için
  `src/assets/room-backdrop-<theme>.png` üretir. Çalıştırma:
  `npm run gen:room` (Node `--experimental-strip-types` ile `.ts` içerden
  import).
- **`src/components/scene/SceneRoom.tsx` (REWRITE):** runtime'da hiçbir
  DOM vektör mobilyası YOK. Katmanlar: tema `wall` gradient fallback +
  `data-testid="scene-backdrop-<theme>"` dış span'e `background-image:
  url(backdropPng)` (cover, center) + tema `glow` ambient wash (screen
  blend). Çocuk zone korunuyor.
- **Test güncellemesi:** her tema backdrop URL'sini taşıyor; DOM vektör
  sayısı ≤4 div'li hiç değil; gradient fallback hâlâ tema paletinden.

### Kart artwork: asla broken/empty img, asla bare Music ikonu

- **`QuizCard.tsx`:** cover URL her durumda (painterly graded) render
  eder; `onError` → `erroredCover` state'ine düşürülür ve **CardArtSkeleton**
  (stylized gothic frame) immatizesi geçer. Song null ise de skeleton.
  AI painting (ready) `fade-in` üst katmanı yapısı korunuyor.
- **CardArtSkeleton:** bare `<Music>` icon (MusicNote) KALDIRILDI; yerine
  breathing candle-glow + portre çerçevesi + oyma köşe işaretleri + gilded
  resting line (deterministik). Başlık/alt text/attachment — bare-icon
  kutusu hiçbir durumda yok.
- **Test yeni:** `fireEvent.error(img)` → skeleton takip eder; seasons
  korunuyor.

### Tur (browser kanıtı)

`npm run dev` 12000 → `/journey?fresh=1` → Q1 "Jammin Bob Marley" commit →
EraCardReveal: reggae oda (ikinci/lambalı sıcak raft texture) ANINDA kapak
paint filter'li + '70s rozet + "DISCOVERY &..." + 8/10 INNOCENCE. Q2
Nicky Romero EDC '21 → gothic oda + kapak AYNINDA (yeni commit'lenen
kapak URL'si). Q3 MJ "Bad" → synth oda (indigo-cyan poci, magenta kutular)
+ kapak (resolving ghost text) — bare kutucuk/bare ikon yok, kitap raf
texture gerçek.

`355/355, tsc 0, lint 0 (9 pre-existing uyarı), build 0.`

---

## 2a. Önceki iş — Hybrid Fallback Restore + Oda Derinlik Pass (TAM, eski)

- Hybrid fallback GERİ (kullanıcı kararı): painterly-graded kapak ANINDA,
  AI cross-fade, kapaksız şarkılarda skeleton. Oda derinlik pass'i:
  multi-stop gradient sırtlar + hub bandları + raf arkası panel derzleri.
  354/354.

## 2b. Önceki iş — STRICT NO-PHOTO FIX + Oda Zenginleştirme (TAM, eski)

- Raw cover fallback KALDIRILDI (STRICT): QuizCard provider fotoğrafı
  göstermiyordu. Sonraki oturumda kullanıcı direktifiyle hybrid restore.

## 2c. Önceki iş — Global Card Design + Hybrid Fallback + Dynamic Copy

SceneRoom + client scene mirror + dynamicCardText + çok boyutlu prompt +
hybrid fallback + sans-serif unification.

## 2d. Önceki iş — User & Genre-Adaptive Dynamic AI Artwork

4 sahne ailesi + sinyal önceliği + word-boundary keyword + cache disiplini.

## 2e. Önceki iş — Organic Art Style Transfer (Sting Kuralı)

feTurbulence warp + paper tooth + palette-accent multiply wash.

---

## 3. Sıradaki iş adımları

1. `npm run gen:room` (backdrop'ları yeniden üret) — tema paleti değişirse.
2. Dokunmatik deneyim: AI painting layer resolution (GEM
   keyless sandbox'ta skeleton kalır; Vercel'de prod.
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
4. HANDOFF tam rewrite + commit `checkpoint: ... — HANDOFF.md güncellendi`.

---

## 4. Olası tuzaklar

- **SceneRoom runtime'da hiçbir DOM/CSS vektör nesne vermez;** o
  testleri `[aria-hidden]` sayısını <5'e düşürür.
- Kapaksız (manual) şarkılar skeleton alır; bu BİLİNÇLİ (Sting Rule).
- `pngjs` yalnız generator için (devDependency); unspecific Node'lar seans
  `--experimental-strip-types` gerekir (gen:room `.ts` import ediyor).
