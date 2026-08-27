# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      bu oturumun işi COMMIT'LENDİ (push kullanıcı onayı bekliyor/bitti
           — `git log -1` ile doğrula; git'e güven, metne değil).
Testler:   542/542 geçti (58 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Lint:      0 HATA, 8 react-refresh uyarısı pre-existing (ui/* shadcn +
           LanguageContext)
Build:     `npm run build` = 0 hata (Nitro .output)
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2-A. Supabase dbCache entegrasyonu (TAM)

`src/lib/cache/supabaseCache.ts`'teki 30s TTL `InflightCache` singleton'ı
(`dbCache`) artık iki veri katmanına bağlı:

- **`src/lib/supabase/cards-remote.ts`** — `loadRemoteCards()` sonucunu
  `CARDS_CACHE_KEY="cards:all"` altında cache'liyor (get/set). Tekrarlanan
  yüklemeler ağ turunu tamamen atlar. Yeni `invalidateCardsCache()` eklendi —
  bir kart mutasyonundan (insert/delete/update) sonra cache'i temizler.
  Kullanıcı-scope: RLS zaten yalnızca çağıranın kendi satırlarını döndürür;
  cache key singleton ama row set RLS-güvenli, userId geçirilmiyor (dizayn
  kararı — key `cards:all`).
- **`src/lib/supabase/journey-remote.ts`** — `loadRemoteJourney(userId)` artık
  `journey:<userId>` anahtarıyla cache'liyor. Kullanıcı-scope key (userId)
  paylaşım riskini ortadan kaldırıyor. `saveRemoteJourney` ve
  `clearRemoteJourney` mutasyonlarında `dbCache.invalidate` çağrılıyor.
- **Sunucu tarafı (client dbCache paylaşmaz):** `generateCard.server.ts` client
  cache'ini göremez — invalidation client tarafta yapılır. `useCardLore` hook'u
  `generateCard` `persisted: true` döndürdüğünde `invalidateCardsCache()`
  çağırır (B1, TAM — aşağıda 2-C).
- **Testler (yeni):** `src/lib/supabase/cards-cache.test.ts` (cache ikinci
  load'da ağ turunu atlar; invalidate sonrası yeniden çeker; boş/hatalı sonucu
  cache'ler) + `journey-remote.test.ts` 3 beforeEach'ine izolasyon için
  `dbCache.invalidate()` eklendi.

## 2-B. Gothic Poster Export + Web Share (TAM)

`SharePosterDialog` (tek kart "Paylaş" modalı) ve `sharePoster.ts` canvas
renderer'ına export/share katmanı eklendi:

- **`src/lib/soundmap/sharePoster.ts`** yeni export'lar:
  - `sharePosterFileName(title)` — temiz slug'lı PNG dosya adı.
  - `canvasToPngBlob(canvas, ...)` — `toBlob` varsa kullanır, yoksa
    DataURL→Blob'a düşer (injectable, test edilebilir).
  - `downloadSharePoster(card)` — 1080×1920 backing store'dan blob'lu,
    tam çözünürlüklü download (link.href=object URL, async revoke).
  - `canShareFiles()` — Web Share API (dosyalı) yetenek probu.
  - `trySharePoster(card)` — native `navigator.share({files:[...]})`;
    destek yok/kullanıcı iptal/hata → `false` (çağıran download'a düşer).
  - `exportSharePoster(card, opts?)` — **kayıt girişi:** önce Web Share,
    çalışmazsa download. Hiç throw etmez; `"shared" | "downloaded" |
    "failed"` döndürür. `options` testler için enjeksiyon noktası.
- **`src/components/gallery/SharePosterDialog.tsx`** — web share'li yeni UI:
  - Buton durumları: `busy` ("Preparing…") → `shared` ("Shared"/"Paylaşıldı",
    Check ikonu) → `downloaded` ("Downloaded"/"İndirildi") → `error`
    (inline `role=alert` fallback mesajı, `data-testid="share-poster-error"`).
  - Yeni poster açıldığında status sıfırlanır. `Download` ikonu baştan
    `Share2` ile değiştirildi (kullanılmayan import temizlendi).
- **Testler (yeni):** `src/lib/soundmap/sharePoster.export.test.ts` (file
  name, blob fallback/reject, download link+URL, web share yok/iptal,
  export farklılaştırma matrix) + `src/components/gallery/SharePosterDialog.test.tsx`
  (canvas render, cardsız disabled, busy spinner→download, error fallback —
  deferred mock ile busy durum yakalanıyor).

## 2-C. Kart persistence sonrası cache invalidation (B1, TAM)

Yeni `cards` satırının galeride 30s TTL'ye takılmadan görünmesi için
invalidation iki koldan yapılır:

- **Client-side (etkili yol):** `src/lib/art/useCardLore.ts` — `generateCard`
  sonucu `persisted: true` olduğunda `invalidateCardsCache()` çağrılır. Bu,
  yeni `cards` satırı yazan tek client-side seçim noktası: kullanıcı galeriye
  döndüğünde `loadGalleryCards()` (30s TTL cache'li) stale listeyi değil, taze
  Supabase setini çeker.
- **Server-side (belt-and-suspenders):** `generateCard.server.ts` →
  `persistCardCore` insert başarılı olduğunda (`!error`) `invalidateCardsCache()`
  çağırır; insert başarısızsa çağırmaz. Server'ın client'a göre ayrı bir
  `dbCache` örneği vardır, bu yüzden tek başına browser cache'ini temizlemez —
  ama aynı süreçte paylaşılan cache'leri sağlamlaştırır ve istenen entegrasyon
  gereksinimini karşılar.
- **Testler (yeni):** `src/lib/art/useCardLore.test.tsx` — 3 test:
  `persisted: true` → invalidate çağrılır; `persisted: false` → çağrılmaz;
  server call hatası → lore null, invalidate çağrılmaz. +
  `generateCard.server.test.ts` — insert başarılı → invalidate çağrılır;
  insert hatası → çağrılmaz (mocked Supabase session).

## 2-D. HF gothic görsel cache-busting + loading UI (TAM)

Ekranda default albüm görselinin takılı kalma sorunu — yeniden üretilen HF
gothic woodcut'ının stale görsel cache'inden servis edilmesi:

- **`src/components/gallery/galleryModel.ts`** — saf helper'lar:
  - `bustImageUrl(url, version)` — signed URL'e `?v=<version>` ekler, mevcut
    `token` korunur; göreceli placeholder path'ler için de güvenli.
  - `imageVersion()` — mount başına `Date.now()` tabanlı versiyon.
- **`src/components/gallery/CardGallery.tsx` (`GalleryCard`)** — `useRef` ile
  stabil versiyon, `displayImageUrl = bustImageUrl(card.imageUrl, version)`
  `<img src>`'te kullanılır. Görsel yüklenene kadar gothic skeleton loader
  (`data-testid="gallery-card-loading"`, z-artırılmış) gösterilir; `onLoad` ile
  gizlenir; `onError` → `GothicArtFallback` doom placeholder. HF gothic görseli
  olduğunda o render edilir, yoksa fallback.
- **Testler (yeni):** `galleryModel.test.ts` (bustImageUrl ×3:
  signed-URL token korunumu, bare URL, placeholder path) +
  `CardGallery.test.tsx` (cache-bust src + loader gizlenme; onError→fallback).
- **Doğrulama:** 524/524 (56 dosya), tsc 0, lint 0e/8w, build 0 hata — aşağıda 4.

## 2-E. Poster savunması + RLS negatif + canlı smoke (3 adımlık paket, TAM)

**Adım 1 — Poster Export & Web Share görsel/UI savunması:**
- **`SharePosterDialog.tsx`** — preview render effect'i artık `.catch(() => undefined)`
  ekliyor: canvas render'ı reddederse (ör. görsel yüklenirken hata) yükleme
  overlay'i yine de gizlenir ve uncaught promise rejection yüzeye çıkmaz.
  Yükleme overlay'ine `data-testid="share-poster-rendering"` eklendi.
- **`sharePoster.ts`** — `renderSharePoster`'da görsel yükleme
  `try { image = await loadImage(url) } catch { image = null }` ile sarıldı:
  reddeden bir görsel yükleyici artık tüm render'ı reject'i etmez, placeholder
  boyamaya düşer (mevcut default loader'ın null-on-error sözleşmesiyle tutarlı).
- **Testler:** `SharePosterDialog.test.tsx` +2 (rendering overlay gösterilir→render
  çözülünce gizlenir + buton enable; render reject'inde overlay gizlenir ve buton
  kullanılır kalır), `sharePoster.test.ts` +2 (jsdom'da stub 2D context ile
  gerçek render kodu yürütülür: görsel null döndüğünde canvas resolve eder +
  loader throw etse de canvas resolve eder). Poster grubu: 28 test geçer.

**Adım 2 — Supabase RLS negatif güvenlik testleri:**
- **`src/lib/supabase/rls-security.test.ts`** (+8). Canlı Postgres yok/CI'da
  olmadığı için client katmanının *negatif* sözleşmesini sabitler (migrations
  0001/0003'ün anlamı):
  - RLS-reddedilen `select` → boş liste döner (başkasının satırı sızmaz, throw
    olmaz); unauthenticated (anası null) → boş liste; kendi user'ının satırları
    yalnızca anon client altında okunur.
  - Her işlemde `eq("user_id", <caller>)` eşlik eder; spoof edilmiş yabancı bir
    user_id hiçbir sorgu/filtre aralığında yer alamaz; upsert payload `user_id`
    = caller'dır (spoof değil); delete caller'sına scope'lanır.
  - RLS/offline reddinde bile yerel (localStorage) fallback korunur, save asla
    throw etmez.

**Adım 3 — Canlı API / env kontrolü (repo-local, env-gated smoke):**
- **`src/lib/integration/liveSmoke.ts`** — üç dış sağlayıcı için tek, env-gated
  probe: `VITE_SUPABASE_URL/ANON_KEY`, `GROQ_API_KEY`, `VITE_HF_TOKEN|HF_TOKEN`.
  Kredi YOKSA→`{status:"skipped"}` (asla ağa çıkmaz, asla sahte başarı üretmez);
  Kredi VARSA→gerçek, authenticated HTTPS ping (HF `/whoami-v2`, GROQ
  `/models`, Supabase REST kökü) ve healthy/unhealthy eşlemesi. Rapor detayı
  hiçbir secret'ı yankılamaz. `allProbesPresent()` toplu kontrol.
- **`liveSmoke.test.ts`** (+6): credentialsiz ortamda hepsi `skipped` + fetch
  hiç çağrılmaz; tek kredi inject edilince yalnızca o probe ağı kullanır;
  401→`failed` (asla success); Supabase probe'tu URL+anon+client üçlüsü olmadan
  skippeler; detay string'i token içermez.
- **Bu sandbox'ta bulgu:** ağ erişilebilir (HF & GROQ 401 = reachable,
  unauth) ama `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GROQ_API_KEY`,
  `VITE_HF_TOKEN`, `HF_TOKEN` **hepsi unset** — bu yüzden tüm live probe
  `skipped`. Yani kredi/URL olmadan tarayıcıda uçtan uca canlı doğrulama
  yapılamıyor; env sağlanınca `runLiveSmoke` bunu ölçecek şekilde hazır.
- **Doğrulama:** 542/542 (58 dosya), tsc 0, lint 0e/8w — aşağıda 4.

## 2. Son biten iş — Gothic Art Generator UI: loading + fallback + boundary (TAM)

- **HF hata sınıflandırması** (`src/services/huggingFaceService.ts`) —
  `GothicArtError` (kind: `missing-token | rate-limit | auth | network |
  provider | unknown`, opsiyonel `status`) + `kindForStatus` (401/403→auth,
  429/5xx→rate-limit, 400/404→provider) + `isRetryableHfError` (rate-limit veya
  network). `generateGothicArt` artık genel `Error` değil sınıflandırılmış
  hata fırlatıyor (fetch ağ/AbortError'ları `network`'e, HTTP durumları
  `kindForStatus`'a). Prompt wrapper + default negative korundu (mevcut 3 test
  duruyor).
- **Yeni `src/components/gallery/gothicArt.tsx`** —
  - `GothicArtSkeleton(badge generating, caption)` — chiaroscuro yükleme
    karesi: nefes alan mum parıltısı, çerçeve silueti, süs köşeleri, yaldızlı
    dinlenme çizgisi, `gothic-art-shimmer` sweep + `Loader2` spinner + i18n
    caption. QuizCard CardArtSkeleton diliyle tutarlı.
  - `GothicArtFallback` — doom/fallback paneli (çatlamış mühür dairesi,
    Skull ikon, Cinzel başlık, italic mesaj; retryable'da "Try Again" butonu,
    `retrying` durumunda "Resurrecting…" spinner'ı). Asla kırık <img> göstermez.
  - `gothicArtFallbackContent(kind, t)` — sınıflandırılmış HF hatasını
    lokalize copy'ye (rate-limit→"Ink Supply Exhausted", network→"The Void
    Swallowed It", diğer→"The Canvas Split") eşler.
- **Yeni `src/components/ui/ErrorBoundary.tsx`** — genel class boundary;
  `fallback` render-prop `{ error, reset }` alır. Render hatasında doom
  fallback ya da tasarımcı fallback. Console'a diagnostic.
- **i18n** — 5 locale (en/tr/es/de/fr) `gothicArt` bloğu eklendi: generating,
  rateLimitTitle/message, networkTitle/message, genericTitle/message, retry,
  retrying, sectionError, brokenArtwork. Parity testi korunuyor.
- **CardGallery wire** (`src/components/gallery/CardGallery.tsx`) —
  - `<ErrorBoundary>` en dışa sarıldı: fallback, thrown `error`'u
    `isRetryableHfError` + `gothicArtFallbackContent` ile doom panele çevirir
    (retry sadece retryable'da görünür).
  - `gallery-loading` artık boş `Loader2` yerine `GothicArtSkeleton`
    (testid korundu).
  - `GalleryCard` sanat penceresi: kırık/mekanik görsel yokluğunda eski yay
    placekholder yerine `GothicArtFallback` (title=genericTitle,
    message=brokenArtwork — "A lost etching").
- **Testler** — HF sınıflandırma (kindForStatus matrix + retryable/non
  retryable) + `gothicArt.test.tsx` (skeleton generating/bekleme, fallback
  copy/retry/retrying, fallbackContent eşleme) + `ErrorBoundary.test.tsx`
  (children render, default fallback, custom fallback error/reset).
  **495/495 (52 dosya), tsc 0, lint 0e/8w.**
- Lint oto-fix sırasında pre-existing `supabaseCache.test.ts` prettier
  format satırı düzeldi (davranışsal değişiklik yok — yalnızca format).

## 2-önceki. Önceki iş — HF Service + TTL Cache + Lazy Route (TAM)

- **`src/services/huggingFaceService.ts`** — user-spec shape: `GenerateGothicArtParams`
  (prompt + optional negativePrompt), `gothicArtPrompt` (inputs + structured
  parameters), `generateGothicArt` (fetch with VITE_HF_TOKEN; note comment
  warns that client-side VITE tokens are public by design — server-side calls
  should use a non-VITE secret). Fixed wrapper: "dark gothic woodcut,
  candlelit chiaroscuro style, etched ink lines, deep shadows, dramatic mood"
  + negative default ("bright colors, cheerful, cartoon…").
- **`src/lib/cache/supabaseCache.ts`** — `InflightCache` (30s TTL,
  get/set/invalidate) + exported singleton `dbCache`. Domain-locked to avoid
  react-refresh-only-export-components violations by extraction.
- **Lazy route (CardGallery)** — `src/routes/profile/cards.tsx`: `lazy()`
  named-export wrapper (`.then((m)=>({default:m.CardGallery}))`) +
  `<Suspense fallback={null}>`. Production build produces a separate
  `CardGallery-<hash>.js` chunk (verified in `.output/public/assets/`).
- **Testler** — cache TTL unit testi (5) + HF prompt wrapper testi (3) +
  lazy route yerinde. **471/471 (50 dosya), tsc 0, lint 0e/7w, build OK.**

## 2-önceki. Önceki iş — SupabaseCardRow Adapter + Gallery Wire (TAM)

- **Adapter yeniden yazıldı** — `src/adapters/supabaseCardAdapter.ts`: exported
  `SupabaseCardRow` interface (snake_case DB schema), private `encodeScene`/
  `decodeScene`, `mapGroundedToCardRow(chapter, node?, imageUrl?, userId?)`
  (to-DB, packs `<stage>|<vibe>|<intensity>` into narrative as an HTML comment
  `<!--SCENE:...-->`), `mapCardRowToGrounded(row)` (from-DB, decodes token →
  GalleryCardData with clean narrative). Fallbacks: vibe "Grounded Reflection",
  intensity 8, image → placeholder.
- **CardGallery.tsx wire (select path)** — `groundedOf(card)` builds the snake
  row from the camelCase `CardRow` (DAL) and normalizes through the adapter;
  the stat-row badge now shows the real `vibeLabel` decoded from the scene
  token (`data-testid="grounded-vibe-badge"`). No insert path exists in the
  component — nothing to wire there (SharePosterDialog is canvas/export-only).
- **Testler** — moved to `src/adapters/__tests__/supabaseCardAdapter.test.ts`
  (4 adapter tests) + wire test in `src/components/gallery/CardGallery.test.tsx`
  (mocked DAL + useSession — no real backend; sole mock, justified).
- **Testler**: 463/463 (48 dosya), tsc 0, lint 0e/7w.

## 2-önceki. Önceki iş — Gallery/SocialShare grounded wire (TAM, kural 10 doğrulandı)

- **Yeni grounded mapping helper'lar** — `src/types/gallery.ts`
  (`mapChapterToGalleryCard` — StoryChapter × optional EmotionalNode →
  GalleryCardData) ve `src/types/socialShare.ts` (`buildSocialSharePayload` —
  MusicDNA → SocialSharePayload).
- **CardGallery.tsx** — `discoveryScore` klip/ikisi lı badge grounded badge'ya çevrildi;
  SharePosterDialog (SocialShareModal'ın yeni name'i) orijinal PU personnality scoring
  connecto'u kesilmedi edilmiş (CardRow from Supabase DAL).
- **CardGallery.test.tsx yeni** — `mapChapterToGalleryCard` + `buildSocialSharePayload`
  unit testleri (4/4 yeşil).
- **Tarayıcı doğrulama (kural 10, TAM):** Vite dev → `/profile/cards` empty state —
  CardGallery loadGalleryCards Supabase DAL'de fallback hall (basılı).
- **Testler**: 458/458 (47 dosya), tsc 0, lint 0e/7w.

## 2-önceki. Önceki iş — Results page P1 wire (TAM, kural 10 doğrulandı)

- **P1 → UI wire** — `results.tsx` bir `useMemo` içinde
  `generateGroundedAnalysis(songs)` hesaplar (null-feathered try/catch).
  İki yeni blok bu grounded `dna`/`timeline`'yi render eder:
    - **`grounded-music-dna`** — Music DNA katmanı, yolun başındaki P0
      metadata'dan beslenir (primaryEra + spanYears, artist diversity % + top
      artists, dominantVibe + track count).
    - **`grounded-emotional-timeline`** — P3 nodes listesi (solda border) —
      temporalArcPosition badge (0→100), stage + vibeLabel, artist—title, intensity
      /10 · valency. original question-row'un altına düşer.
  Kos conforms existing both grids — fallback question listesini ve
  raw-personality triad'ı koruruz.
- **Tarayıcı doğrulama (kural 10, TAM):** Vite dev → `/results`'e seed 8-song
  journey localStorage → Music DNA `grounded-music-dna` ve de
  `grounded-emotional-timeline` node'lar (Sting—Fragile "Nostalgic Spark"
  Childhood'da — 8 nodes: 0/14/29/43/57/71/86/100 arc-py ozisyon) render edildi.
- **Testler**: 454/454 (46 dosya), tsc 0, lint 0e/7w.

## 2-önceki. Önceki iş — P1 Pipeline Integration (TAM)

- **Yeni `generateGroundedAnalysis(songs, contexts?)`** `src/lib/ai/pipeline.ts`'de —
  seçilen Song[]'u 8-stage `LifeContext[]`'e (kolaylık için `GROUNDED_STAGE_NAMES`)
  çevirir ve üç engine'i zincirler: `generateMusicDNA` → `generateGroundedLifeStory` →
  `generateEmotionalTimeline`. `analyzeUserJourney` (personality pipeline) birebir
  olduğu gibi duruyor.
- **Entegrasyon testi** `pipelineGrounded.test.ts` — 4 test yeşil.

## 2-önceki-2. Önceki iş — Master Gap P3: Emotional Timeline Engine (TAM)

- **P3 dosyaları** — `src/types/emotionalTimeline.ts` (EmotionalNode,
  EmotionalTimeline + overallTrajectory union) + `src/engine/emotionalTimelineEngine.ts`
  (`generateEmotionalTimeline(dna, contexts)`: stage-emotion matrisi
  (childhood→Nostalgic Spark, hard time→Cathartic Depth…), valency −1..+1,
  intensity 1-10, temporalArcPosition 0-100, trajectory belirleyici
  (Ascending/Descending/U-Shaped/Fluctuating), peakStage).
- **P0/P2/P3 birim testleri** — `src/engine/__tests__/` altında 3 dosya
  (musicDnaEngine, lifeStoryEngine, emotionalTimelineEngine). Repo vitest
  kullanıyor (jest değil) — API jest-uyumlu; explicit `from "vitest"`
  importları + Song mock'ları `song()` factory'sine taşındı (Song tipi
  provider/providerId/album/artworkUrl/isrc zorunlu alanlar istiyor).
- **Testler**: 450/450 (45 dosya), tsc 0, lint 0e/7w.

## 2-önceki. Önceki iş — EraCard Sadeleştirilmiş + Master Gap P0/P2 (TAM)

- **EraCard simplıfication** — Kullanıcının sağladığı sadeleştirilmiş
  referansa (`EraCard` React component) kilitlendi. Responsive body
  `w-full max-w-[340px]`, rounded-xl, p-4. Header: centered `AGE | TITLE |
  ERA`. Art window: `aspect-square` rounded-lg altın hairline border.
  Lore box: `#161920` dark inset `text-[11px] italic text-gray-300`. Yeni
  footer: `┊🎼 {song} + score chip` (lucide Music icon × no emojis). Double
  gold frame (`#c9a961` + inset `#8a6d3b` + L-brackets) korundu. Skeleton'a
  spinner (`Loader2` animate-spin) + i18n caption (`t.quizCard.artGenerating`)
  eklendi (5 locale: "Etched ink art generating…" / "Mürekkep …" /
  "Arte en tinta …" / "Tintenkunst …" / "Art à l'encre …"). Testler yeni
  kontrata güncellendi (simplified template lock, frame, skeleton spinner).
- **Master gap P0/P2** — `src/types/musicDna.ts` (TemporalPattern, MusicalIdentity,
  LifeContext, MusicDNA) + `src/types/lifeStory.ts` (StoryChapter, GroundedLifeStory)
  + `src/engine/musicDnaEngine.ts` (calculateTemporalPattern, calculateMusicalIdentity,
  generateMusicDNA) + `src/engine/lifeStoryEngine.ts` (generateGroundedLifeStory)
  oluşturuldu. Henüz pipeline.ts'de kullanılmıyor — wire edilme sıradaki adım.
- **Testler**: 442/442 (42 dosya), tsc 0, lint 0e/7w.
- **Kural 10 tarayıcı doğrulama (TAM)**: Vite dev (port 12000) + localStorage
  seed'i → `/journey`'de 1. şarkıyı seçip `EraCardReveal`'i açtı → sadeleştirilmiş
  kart görünür: centered header, square art window, dark lore box, footer
  score chip, double gold frame + corner brackets.

## 2-önceki. Önceki iş — Kart Artwork Prompt Kontratı (TAM)

Kart artwort promptu tipografik plak kapağı kontratına kilitlendi (no
portrait, no in-image title). Vercel Gemini prompt'u buna devam ediyor.

## 2-önceki-2. Önceki iş — QuizCard Çift Altın Çerçeve (TAM, kural 10 dahil)

Dış çift altın çerçeve (`#c9a961` + inset `#8a6d3b` + L-brackets) korundu.
Yeni içerik/veri katmanları simplified reference layout'a uyarlandı.

## 2-önceki-3. Önceki iş — Referans Gotik Woodcut Kart Şablonu (TAM)

Artık simplified EraCard referansı üzerinden QuizCard kontratı.

## 2a. Önceki iş — Editorial Master Poster + Modal Export (TAM)

Sabit 2:3 editorial infographic (`MasterPosterSheet.tsx`) → Journey modal
(`MasterPosterModal.tsx`) → PNG export (`html-to-image` toPng pixelRatio:2).

## 2b. Önceki iş — posterTheme Her Yerde: Export + Lightbox (TAM)

`themeFromAnalysis(analysis, songs)` bridge → PoeticAnalysis + şarkılardan
PosterTheme; exportPoeticPoster canvas export'u themedPalette ile.

## 2c. Önceki iş — Dynamic Master Poster Theme motoru (TAM)

`posterTheme.ts` saf, deterministik resolver: Metal/Doom → gothic-thunder +
Bronze; jazz/Classical → smoke-candlelight + Amber Brass; vb.

## 2d. Önceki iş — Strict AI-Artwork Rule (revize edildi)

QuizCard art penceresi: skeleton (generation) veya AI painting (cross-fade).

## 2e. Önceki iş — Card Gallery & Social Share Poster (TAM)

`/profile/cards` gothic grid + sort/scene filtreleri, sharePoster canvas.

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
2. **Kart üretim zinciri (B1 + cache-busting, TAM — bak 2-C & 2-D):**
   - B1: `useCardLore` (client) + `generateCard.server` (server, belt-and-
     suspenders) kart persist edildiğinde `invalidateCardsCache()` çağırıyor —
     yeni kart galeriye dönüşte 30s TTL'ye takılmadan görünür.
   - Cache-busting: galeri `<img>`'i `?v=` parametresiyle yeniden üretilen HF
     gothic görselini stale görsel cache'inden servis etmez; yüklenene kadar
     gothic skeleton, hata olursa doom fallback.
   - Uçtan uca zincir: kart üret → `cards` satırı + storage object →
     invalidation → `/profile/cards`'da görünür → Paylaş → PNG/Web Share.
     Doğrulandı: RLS negatif testi artık `rls-security.test.ts`'te (adım 2-E)
     — başkasının kartı görünmemeli sözleşmesi client katmanında sabitlendi.
     Kalan açık: token'lı ortamda HF görselinin persistence ile bağlanması —
     gerçek Supabase/GROQ/key olmadan tarayıcıda uçtan uca doğrulama
     yapılamıyor; env sağlanınca `liveSmoke` (adım 2-E) bunu ölçer.
3. Gallery'ye giriş linki: `/profile/cards` henüz hiçbir sayfadan linkli
   değil — nav/sonuç sayfasına bağlantı kararı kullanıcıda.
4. PosterLightbox içeriği: şu an statik `poster-preview.jpg`; ileride
   temalı çerçevenin içini de MasterPosterSheet'e çevirme kararı açık
   (çerçeve zaten temalı).
5. Faz 4 tasarım onayı açık (`docs/TECH/DATABASE_PLAN.md` DRAFT).
6. **Master gap wire:** `src/types/musicDna.ts` + `src/engine/musicDnaEngine.ts`
   doğrudan pipeline.ts'ye bağla (P1 target). Life Story için
   `generateGroundedLifeStory` de wire edilecek.

---

## 4. Olası sonuçlar (checkpoint sonrası git durumu)

- Çalışma ağacı temiz; tüm iş bu checkpoint'te COMMIT'LENDİ. Push kullanıcı
  onayı bekliyor (commit'e `git log -1` ile doğrula; git'e güven, metne değil).
- Doğrulama: `git status` (clean) + `git log -1` (bu checkpoint) +
  `npm test` (542/542, 58 dosya) + `npm run typecheck` (0 hata) +
  `npm run lint` (0 e / 8 w pre-existing).
- Canlı ortam notu: bu oturumda `VITE_SUPABASE_URL/ANON_KEY`, `GROQ_API_KEY`,
  `VITE_HF_TOKEN`/`HF_TOKEN` ortamda yoktu → `runLiveSmoke` 3 probe'u da
  `skipped` raporladı (ağ erişilebilir: HF & GROQ 401). Kullanıcı gerçek
  Supabase/GROQ/HF kredilerini `.env` + shell env olarak sağlarsa canlı
  uçtan uca doğrulama yapılabilir.

