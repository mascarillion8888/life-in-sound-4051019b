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
Testler:   442/442 geçti (42 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Lint:      0 HATA, 7 react-refresh uyarısı pre-existing (ui/* shadcn +
           LanguageContext)
Build:     `npm run build` = 0 hata (Nitro .output)
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Kart Artwork Prompt Kontratı: Tipografik Plak Kapağı (TAM)

- **NEDEN:** AI painting'lerde iki sorun vardı: (1) prompt "framed painted
  portrait of {artist}" istediği için model gerçek/tanınabilir sanatçı
  yüzleri çiziyordu; (2) model kart başlığını ("9 YAŞ", "İLK KIVILCIM" gibi)
  görselin İÇİNE çizmeye çalışıyordu — oysa bu metinler zaten QuizCard'ın
  HTML header katmanında.
- **NASIL:** İki prompt yolu da (`cardBlueprint.ts` `framing` cümlesi +
  `cardArtwork.server.ts` 7 sahne spec'i + `Integration` satırı) tek
  kontrata kilitlendi: çocuk silüeti artık **tipografik plak kapağına**
  bakıyor — "pure abstract typographic design — stylized unreadable glyphs
  and geometric shapes (light rays, circles, angular forms) on a flat muted
  background, evoking {artist}'s aesthetic". Negatif kurallar prompt'a
  açıkça yazıldı: "Absolutely no photographic face, portrait or human
  figure on the sleeve, and no painted artist portrait anywhere in the
  scene. Render only the scene — never draw card titles, headings or any
  readable text into the image." Her sahne spec'i kendi dönem estetiğinde
  tipografik kapağa çevrildi (brass-age glyphs, neon J-card, sun-ray
  glyphs…). Reddedilen alternatif: sadece Integration satırını değiştirip
  spec'leri bırakmak — spec'ler de portre istiyordu, yarım kalırdı.
- **Test:** iki dosyada da yeni negatif-kural kontrat testleri
  (`not.toContain("framed painted portrait")`, `toContain("no photographic
  face…")`, `toContain("never draw card titles")`) + mevcut assertion'lar
  yeni cümlelere güncellendi. **442/442 (42 dosya), tsc 0, lint 0e/7w.**
- **Not:** Prompt değiştiği için cache kimliği de değişti — mevcut AI
  painting'ler ilk reveal'da yeniden üretilecek (deterministik, beklenen).
  Vercel'de `GEMINI_API_KEY` mevcut; bu ortamda görsel üretimi yapılamadı
  (key yok) — prompt metni kod yolundan birebir doğrulandı.

## 2-önceki. QuizCard Çift Altın Çerçeve (TAM, kural 10 dahil)

- **QuizCard.tsx'e katman 0 eklendi — dış çift altın çerçeve:** dış `border-2`
  `#c9a961` (eski `border-4 #8b7355` kaldırıldı), içte 7px inset `#8a6d3b`
  hairline (`data-testid="card-frame-inset"`, rounded-[10px], z-30,
  pointer-events-none) ve 4 köşede 20×20 L-braket (`FrameCorner`,
  `data-testid="card-frame-corner-{top|bottom}-{left|right}"`, 2px `#c9a961`,
  içe bakan iki kenar 0px). İçerik/veri katmanları (header, pencere, banner,
  parchment, rozet, credit) birebir aynı.
- **Test:** `borderColor` assertion'ı `#c9a961`'e güncellendi + yeni test
  "wraps the whole card in a double gold frame with four corner brackets"
  (inset hairline + 4 braketin kenar-görünürlük matrisi). **440/440 (42
  dosya), tsc 0, lint 0e/7w.**
- **Kural 10 görsel doğrulama (TAM):** Vite dev (port 12000) + localStorage
  seed'i (`soundmap.journey.v1`: 7 metal cevabı, current=8) → `/journey`'de
  8. soruya "Dio Holy Diver" yazılıp canlı öneri tıklandı → EraCardReveal'de
  QuizCard çift çerçeveyle ekran görüntülendi: dış altın çizgi + inset
  hairline + 4 köşe L-braket görünür; header `NOW | ACCEPTANCE & EMB… |
  35/100`, iTunes cover siyah pencerede, banner/parchment/sekizgen rozet/
  credit yerinde.

## 2-önceki-2. Referans Gotik Woodcut Kart Şablonu (TAM)

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
- **Tarayıcı kanıtı:** §2'deki çerçeve işiyle birlikte tamamlandı (kural 10).

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

0. **Bağlam notu:** `lifeinsound-app` Next.js prototipi kullanıcı kararıyla
   tamamen silindi (klasör + zip'ler + dev server; GitHub'a hiç
   push'lanmamıştı). Tek odak bu repo.
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
  `npm test` (442/442).
