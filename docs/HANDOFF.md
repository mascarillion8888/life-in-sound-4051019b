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
Testler:   438/438 geçti (42 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Lint:      0 HATA, 7 react-refresh uyarısı pre-existing (ui/* shadcn +
           LanguageContext)
Build:     `npm run build` = 0 hata (Nitro .output)
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — posterTheme Her Yerde: Export + Lightbox (TAM)

Bir önceki "sıradaki iş" listesinin 4. maddesi kapandı: posterTheme artık
üç renderer'da da tek kaynak (sheet / lightbox / yüksek çözünürlüklü PNG).

- **`themeFromAnalysis(analysis, songs)`** (`posterTheme.ts` sonuna bridge):
  PoeticAnalysis + journey Song listesinden `resolvePosterTheme` girdisini
  kurar. Genre sinyali: `visual.themeId` (en güçlü) + chapter title'ları +
  şarkı başlık/sanatçı metni. Mood sinyali: manifesto + chapter mood'ları +
  song insight'ları + coreDuality alanları. Duygu şiddeti: emotionalCurve
  ortalaması. Era: `Song.releaseYear`. `null` analysis → Gold default
  (null-safe). **Aynı analiz her yerde aynı temayı üretir** — üç consumer
  bu bridge'den geçer, palet sürüklenemez.
- **`exportPoeticPoster` (poeticPoster.ts) temaya bağlandı:** `renderMap`
  tema çözümünü TEK kez yapar (ölçüm + final geçiş aynı tema), `drawMap`
  imzasına `theme: PosterTheme` eklendi. Yeni exported pure helper
  **`themedPalette(palette, theme)`** — üç yüzey rolünü yeniden döker
  (background → `primaryBg`, primary → `metalColor`, accent →
  `metalHighlight`), `text` dahil diğer roller dokunulmaz. Extras
  override'ları: `texture` = atmosphere→TEXTURE_BY_ATMOSPHERE
  (gothic→nebula, candlelight→smoke, neon→grid, parchment→paper),
  `auraGlow` = metalHighlight, `waveGradient` = [metalColor,
  metalHighlight] — DOM sheet'in BackgroundSceneLayer/waveform gradientiyle
  birebir uyum.
- **`PosterLightbox` temalı çerçeve:** yeni `theme?: PosterTheme` prop'u
  (yoksa Gold default). Çerçeve div'i (`data-testid="lightbox-frame"`):
  border → metalColor, zemin → `primaryBg`→siyah gradient, glow →
  metalColor %25. Kapatma butonu da temalı (border metalColor, zemin
  primaryBg, X ikonu metalHighlight). İçerik jpg'i hâlâ statik preview —
  bilinçli; sadece çerçeve temaya kayıyor.
- **`results.tsx` wiring:** ResultsPage'de `posterTheme = useMemo` ile
  `themeFromAnalysis(deterministicPoeticAnalysis(profile, titles), songs)`
  — DynamicMusicMap'in fallback'iyle aynı kaynak, lightbox çerçevesi
  sheet'le aynı paleti boyar. Profil yoksa `undefined` → Gold.
- **Test:** posterTheme.test.ts +themeFromAnalysis bloğu (3 test: metal
  pipeline fixture → Bronze #a97142/#d09a68; keyword-siz + 80'ler release
  yılları → era fallback Neon Magenta #ff2fb3; null → Gold), export
  tarafında `themedPalette` bloğu (2 test), **yeni
  `PosterLightbox.test.tsx`** (3 test: Bronze frame, Neon Magenta frame,
  Gold fallback). **438/438 (42 dosya), tsc 0, lint 0e/7w, build 0.**
- **Tarayıcı kanıtı (kural 10), dev 12000:** geçici `public/__seed.html`
  ile 8 metal şarkılı journey localStorage'a yazılıp /results açıldı —
  Master Poster sheet Bronze/gothic-thunder; Cinematic Poster bölümünden
  Maximize ile açılan **lightbox çerçevesi Bronze (#a97142) border + koyu
  gradient zemin + temalı kapat butonu** canlı doğrulandı, screenshot
  alındı. Seed dosyası commit'ten önce silindi (git status temiz).

`438/438, tsc 0, lint 0, build 0.`

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

## 2b. Önceki iş — Dynamic Master Poster Theme motoru (TAM)

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

## 2c. Önceki iş — Strict AI-Artwork Rule (raw cover YASAK) (TAM)

QuizCard art penceresi artık tam olarak iki şey gösterir: gothic woodcut
skeleton (generation sürerken shimmer'lı) veya hazır AI painting cross-
fade'i. `song.artworkUrl` art penceresinde bilinçli okunmuyor.

## 2d. Önceki iş — Card Gallery & Social Share Poster (TAM)

`/profile/cards` gothic grid + sort/scene filtreleri (galleryModel),
`cards-remote.ts` (RLS-safe okuma, signed URL), `sharePoster.ts`
(canvas-only 1080×1920 story render) + SharePosterDialog. Radix Dialog
portal canvas'ı için callback-ref deseni: portal içi canvas'ta tekrar
kullan.

## 2e. Önceki işler (TAM)

Option B kart motoru (cardBlueprint + generateCard.server + useCardLore) ·
HF artwork tier · Cosmic Poster Grid · Painterly Backdrops. Detaylar git
history'de — bu dosya günlük değildir.

---

## 3. Sıradaki iş adımları

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
  `npm test` (438/438).
