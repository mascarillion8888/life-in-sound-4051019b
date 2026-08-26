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
Testler:   439/439 geçti (42 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Lint:      0 HATA, 7 react-refresh uyarısı pre-existing (ui/* shadcn +
           LanguageContext)
Build:     `npm run build` = 0 hata (Nitro .output)
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Referans Gotik Woodcut Kart Şablonu (TAM)

- **QuizCard.tsx referans şablona kilitlendi** (6 katman): (1) **Engraved
  header plaque** — aged gold/bronze gradient, tek satır `AGE | DİNAMİK
  BAŞLIK | ERA ADI` + sağda oval sekans rozeti (`n/100`,
  `data-testid="card-header"` / `"card-sequence"`). (2) **Ana pencere** —
  siyah iç çerçeve (`#060504`, derin inset gölge) + 4 köşede scrollwork
  oval; içine **iTunes cover artık doğrudan gömülüyor**
  (`data-testid="card-art-cover"`, painterly grading: sepia/contrast/
  brightness), AI painting hazır olunca üzerine cross-fade, coversız şarkı
  gothic woodcut skeleton'a düşer. (3) **Orta banner** — `Legendary Life
  Era — ERA ADI` + sağda Shield amblemi (`data-testid="card-banner"`).
  (4) **Lore & footer kutusu** — distressed parchment zemin (#e9dcbd→
  #cbb684), italic serif lore, ornamental divider (iki çizgi + karo),
  `♪ Artist — Title (Year)` imza satırı (`data-testid="card-lore-box"`).
  (5) **Sekizgen skor rozeti** — clip-path octagon, bronze gradient, lore
  kutusunun sağ altına taşan `n/10 ETİKET` (`data-testid="card-score-
  badge"`). (6) **Footer credit** — ortalı `TM & © 2026 LifeInSound |
  Illus. R. Swanland` (`data-testid="card-credit"`).
- **Artwork kontratı güncellendi:** iTunes cover anında görünür (styled),
  AI painting üstüne cross-fade — skeleton sadece coversız şarkılarda.
  (Önceki "raw cover asla" kuralının kullanıcı onaylı revizyonu: cover
  artık grading'li olarak pencerede.)
- **Test:** QuizCard.test.tsx yeni kontrata yeniden yazıldı (10 test:
  şablon katmanları, cover embed, AI cross-fade, cover yokken skeleton,
  yıllı imza, mount attribute, songsuz fallback, çerçeve/lucide, preview
  toggle). EraCardReveal.test imza regex'i `Artist — Title`'a güncellendi.
  **439/439 (42 dosya), tsc 0, lint 0e/7w.**
- **Tarayıcı kanıtı:** dev server + metal journey seed'i ile görsel
  doğrulama bir SONRAKİ oturumda tamamlanacak (kullanıcı Next.js bağlamına
  geçti) — açık iş olarak §3'e eklendi.

`439/439, tsc 0, lint 0.`

---

## 2a. Önceki iş — Editorial Master Poster + Modal Export (TAM)

- **Sabit 2:3 editorial infographic** (`MasterPosterSheet.tsx`) — Header
  (kural çizgisi + başlık + 6 yaş rozeti) → Orta 3 kolon (Early Spark /
  Master Frame / Peak Identity) → Alt 3 kolon (Emotional Waveform SVG +
  1-11 numaralı Tracklist + Circular Seal). Orta çerçevede 4 gotik geçiş
  portali. `aspect-ratio: 2/3` kilitli.
- **Journey sonu modalı** (`MasterPosterModal.tsx`) — 8. kart reveal'ından
  sonra tam ekran açılır, kapanınca `/results`'a gider.
- **PNG export** — `html-to-image` (`toPng`, `pixelRatio: 2`) → 2048×3072.
- **Paylaşılan içerik** (`masterPosterContent.ts`) — pure builder; iki
  renderer da buradan beslenir.
- Commit `07dcfb7`, origin/main'e push'landı (Lovable sync). 430/430'tü.

## 2b. Önceki iş — posterTheme Her Yerde: Export + Lightbox (TAM)

`themeFromAnalysis(analysis, songs)` bridge'i (posterTheme.ts) → PoeticAnalysis
+ şarkılardan PosterTheme; `exportPoeticPoster` canvas export'u `themedPalette`
ile (background→primaryBg, primary→metalColor, accent→metalHighlight; texture/
aura/waveform temadan); PosterLightbox `theme` prop'u ile temalı çerçeve.
Commit `14f113c`. 438/438'di.

## 2c. Önceki iş — Dynamic Master Poster Theme motoru (TAM)

`src/lib/soundmap/posterTheme.ts` saf, deterministik resolver: Metal/Doom →
gothic-thunder + Bronze; Jazz/Classical → smoke-candlelight + Amber Brass;
80s Pop/Synth (keyword VEYA release year'ların ≥50%'si 1978-1992) →
retro-grid-neon + Neon Magenta; Rock/Folk → distressed-parchment + Copper;
sinyal yoksa → Gold. Background scene: intensity ≥0.5 veya fiery/angry →
stormy; düşük/peaceful → starry. `MasterPosterCanvas` buna bağlandı
(`data-metal`/`data-atmosphere`/`data-scene` attribute'ları testlerde
kilitli). Substring guard: "Metallica" ≠ "metal" tag — ama artık
themeFromAnalysis `visual.themeId`'yi de beslediğinden pipeline'ın
metal-gothic id'si Bronze'a yine ulaşır.

## 2d. Önceki iş — Strict AI-Artwork Rule (TAM, revize edildi — bkz. §2)

QuizCard art penceresi artık tam olarak iki şey gösterir: gothic woodcut
skeleton (generation sürerken shimmer'lı) veya hazır AI painting cross-
fade'i. `song.artworkUrl` art penceresinde bilinçli okunmuyor.

## 2e. Önceki iş — Card Gallery & Social Share Poster (TAM)

`/profile/cards` gothic grid + sort/scene filtreleri (galleryModel),
`cards-remote.ts` (RLS-safe okuma, signed URL), `sharePoster.ts`
(canvas-only 1080×1920 story render) + SharePosterDialog. Radix Dialog
portal canvas'ı için callback-ref deseni: portal içi canvas'ta tekrar
kullan.

## 2f. Önceki işler (TAM)

Option B kart motoru (cardBlueprint + generateCard.server + useCardLore) ·
HF artwork tier · Cosmic Poster Grid · Painterly Backdrops. Detaylar git
history'de — bu dosya günlük değildir.

---

## 3. Sıradaki iş adımları

0. **QuizCard görsel doğrulama (kural 10, açık):** dev 12000'de seed'li
   journey ile yeni woodcut şablonun (header/window/parchment/octagon)
   ekran görüntüsü alınacak.
0b. **Yeni bağlam:** kullanıcı `lifeinsound-app` adlı Next.js (App Router)
   projesini yükledi (/workspace/lifeinsound-app). Kural: mevcut kart
   tasarımı/layout AYNEN korunur; sadece spesifik talepler uygulanır.
1. **KULLANICI AKSİYONU (hâlâ açık):** `0003_cards.sql`'i Supabase'e
   uygula — uygulanmadan gallery hep empty state gösterir, persist skip'ler.
2. Key'li ortamda uçtan uca zincir: kart üret → `cards` satırı + storage
   object → `/profile/cards`'da görünür → Paylaş → PNG iner. RLS negatif
   testi: ikinci bir anon tarayıcıyla başkasının kartı görünmemeli.
3. Gallery'ye giriş linki: `/profile/cards` henüz hiçbir sayfadan linkli
   değil — nav/sonuç sayfasına bağlantı kararı kullanıcıda.
4. PosterLightbox içeriği: şu an statik `poster-preview.jpg`; ileride
   temalı çerçevenin içini de MasterPosterSheet'e çevirme kararı açık
   (çerçeve zaten temalı).
5. Faz 4 tasarım onayı açık (`docs/TECH/DATABASE_PLAN.md` DRAFT).

---

## 4. Olası sonuçlar (checkpoint sonrası git durumu)

- Çalışma ağacı temiz; tüm iş origin/main'de.
- Doğrulama: `git status` (clean) + `git log -1` (bu checkpoint) +
  `npm test` (439/439).
