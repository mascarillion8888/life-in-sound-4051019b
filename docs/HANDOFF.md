# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**
>
> Yerel klonunuz `git pull` ile güncellenmemiş olabilir — her oturum
> başında **önce `git fetch` + `git pull origin main`** yapın, sonra
> commit'lere güvenin (bkz. §9).

---

## 1. Doğrulanabilir gerçek

```
Aktif ortam: Windows yerel (C:\Users\frontoffice\life-in-sound-new\life-in-sound-4051019b)
Dal:        main
HEAD:       3892330 — "refactor(visual): split gothic into dark + acoustic families (roots/classical), neutralize eraThemeFor year-guess"
            origin/main ile SENKRON (push edildi 2026-09-20; rev-list 0 0)
            Son commit zinciri (FAZ 0 → 4b + cleanups):
              88f6648  chore(scene): orphan generate-room-backdrop.mjs + gen:room silindi; stale doc iddiaları düzeltildi (push 2026-09-20)
              e07b87f  FAZ 4b — exactAssetRef→URL çözümü resolver backdrop adımında; palette wiring FAZ 4c'ye ertelendi (push 2026-09-20)
              6413994  checkpoint: FAZ 4b exactAssetRef çözümü kaydı — HANDOFF.md güncellendi (handoff-check green)
              c201413  checkpoint: FAZ 4a resolver bağlama kaydı — HANDOFF.md güncellendi (handoff-check green)
              94e4d57  FAZ 4a — SceneRoom → resolveSceneVisualSpec bağlandı; resolver artık orphan değil (push 2026-09-20)
              8d62d24  docs(handoff): Poster/Music Map life-stage sistem kararı (System B) kaydı
              704200e  docs(handoff): §1 HEAD 4b0e1cc'ye güncellendi
              4b0e1cc  docs(handoff): HF runtime kapatma (P2) açık iş olarak kaydedildi (§5 madde 8; push 2026-09-20)
              12942cb  FAZ 3.2 — multi-axis backdrop entegrasyonu: moodBackdropUrl(mood,genre,decade) fallback zinciri + SceneRoom/EraCardReveal bağlama (push 2026-09-19)
              c886a12  18 Eylül KANONİK — Visual Resolver girdisi = interaktif Song{mood,genre,decade} (LOCKED, STATE KARARLAR)
              2883f9a  FAZ 3 — deterministik scene visual contract: src/types/visualSpec.ts +
                        src/lib/visual/visualResolver.ts + visualSpec.test.ts (10 test)
              ea84a6e  FAZ 3.1 — exact-match asset registry: SCENE_ASSET_REGISTRY + resolveExactAsset
                        (pilot 1980s×Pop×9 mood) + SceneVisualResolution.exactAssetRef + 3 test
Testler:    70 dosya, 664 passed / 2 skipped (666) — vitest v4.1.11, `npm test` exit 0 (2026-09-19)
            visualSpec testleri 13/13 (10 önceki + 3 exact-match)
tsc:        temiz (`npm run typecheck` = 0 hata)
Lint:       0 hata, ~9 uyarı (baseline: react-refresh ui/* + LanguageContext + bir exhaustive-deps;
            yeni uyarı YOK). `npx eslint src scripts --rule 'prettier/prettier: off'`.
Build:      `npm run build` exit 0 (Vercel SPA path; Nitro .output). Doğrulandı 2026-09-17.
Worktree:   temiz (staging sonrası) — yalnızca `.claude/` untracked (Claude Code yerel config;
            bilerek commit'lenmedi). Asset'ler: 9× `mood-backdrop-*.png` (mood standardı).
```

Doğrula: `git pull origin main && npm test && npm run typecheck && npx eslint src scripts --rule 'prettier/prettier: off'`.

---

## 2. Son Biten İş: FAZ 3 (Visual Contract + deterministik Resolver, 18 Eylül) ve FAZ 3.1 (exact-match Asset Registry, 19 Eylül)

### 2a. FAZ 3 (commit `c886a12` + `2883f9a`, 18 Eylül) — kanonik kontrat + resolver
- **NEDEN:** Görsel kararın tek eksen (mood) olmaması gerektiği netleşti; 18 Eylül kararı (STATE KARARLAR) girdiyi `Song {mood, genre, decade}` bileşimi olarak LOCKED yaptı.
- **NASIL:** `src/types/visualSpec.ts` (SceneVisualSpecInput → SceneVisualResolution → SceneVisualSpec; VisualAxisSource; fallbackTrace), `src/lib/visual/visualResolver.ts` (`resolveSceneVisualSpec`: backdrop=mood-only → sceneTheme=genre keyword→decade ladder→gothic → era=eraStyle/eraTheme; deterministik, LLM/image üretimi YOK), `src/lib/visual/visualSpec.test.ts` (10 test). Docs `VISUAL_ARCHITECTURE.md §3`'e kanonik girdi bloğu.
- **Sonuç:** Kod bugün yalnız mood eksenini kullanır ama kontrat üç ekseni taşır; FAZ 4 (SceneRoom bağlama) ayrı.

### 2b. FAZ 3.1 (commit `ea84a6e`, 19 Eylül) — exact-match Asset Registry
- **NEDEN:** Kullanıcı MANUEL üretilmiş kombinasyonları exact-match olarak tanımak istiyor; runtime AI/görsel üretimi YOK (ANA_YASA §9 korunur).
- **NASIL:** `src/lib/visual/assetRegistry.ts` (GenreId union, SceneAssetEntry, SCENE_ASSET_REGISTRY — pilot `1980s × Pop × 9 mood`). `resolveSceneVisualSpec`'e 0. adım `resolveExactAsset(mood, genre, decade, releaseYear)` eklendi: registry'de tam eşleşme → `SceneVisualResolution.exactAssetRef` + `fallbackTrace`'e `exact-match:pop-1980s-<mood>`; eşleşme yoksa mevcut FAZ 3 davranışı birebir korunur. **Görsel değişiklik YOK** (backdrop aynı mood dosyası; sadece şeffaflık/izlenebilirlik).
- **Sonuç:** visualSpec 13/13, suite 664/666, tsc 0.

> ⚠️ Bu commit `src/` değiştirdiği için `docs/HANDOFF.md` güncellenmemişti → `handoff-check` (push) kırmızı. İşte bu dosyanın güncellemesi + checkpoint commit'i bunu giderir.
### 2c. FAZ 3.2 (commit `12942cb`, 19 Eylül) — multi-axis backdrop entegrasyonu
- **NEDEN:** Resolver/registry üç ekseni (mood+genre+decade) taşıyordu ama SceneRoom sadece mood'u render ediyordu; genre/decade "declared input" idi (kodda kullanılmıyordu).
- **NASIL (5 dosya):** `moodBackdrop.ts` — `moodBackdropUrl(mood, genre?, decade?)` + `backdropCandidates` 4-kademeli fallback zinciri; `moodBackdrop.test.ts` — yeni imzaya göre; `visualResolver.ts:128` — genre/decade geçirir; `SceneRoom.tsx` — genre/releaseYear props + `eraThemeForYear` (tek kaynak, YENİ ladder YOK); `EraCardReveal.tsx:49` — props gönderir.
- **Sonuç:** Testler 4 dosya / 40 test geçti; tsc yeşil. Kapsam dışı kalemler (commit mesajında kayıtlı): resolveSceneVisualSpec hâlâ orphan; HF runtime üretimi hâlâ canlı; assetRegistry assetRef güncellenmedi; üçlü decade-ladder dedup bekliyor.


---

## 3. Kod Tabanı Özeti & Mevcut Durum

- **Scene/backdrop:** `SceneRoom` = tek backdrop standardı; backdrop artık `moodBackdropUrl(mood, genre, decade)` ile çok-eksenli çözülür (fallback: dec×gen×mood → dec×mood → gen×mood → mood; mood yoksa `dreamy`). Decade, `releaseYear`'den `eraThemeForYear` ile türetilir (tek kaynak).
- **Visual katmanı (yeni, FAZ 3/3.1):** `src/types/visualSpec.ts` (kontrat), `src/lib/visual/visualResolver.ts` (`resolveSceneVisualSpec` deterministik, `resolveExactAsset`), `src/lib/visual/assetRegistry.ts` (`SCENE_ASSET_REGISTRY`, pilot pop×1980s×9 mood), `src/lib/visual/visualSpec.test.ts` (13 test).
- **Motorlar:** `musicDnaEngine.ts` (mood-coverage gate'li vibe), `lifeStoryEngine.ts`, `emotionalTimelineEngine.ts`.
- **Mood veri yolu:** provider→Song(mood null)→journey şarkı seçimi→`resolveSongMood`(inferMood)→`Song.mood` persist→SceneRoom mood-backdrop.
- **Pipeline:** `src/lib/ai/pipeline.ts` → `generateGroundedAnalysis` (content-keyed memo + contextText fingerprint).
- **LLM:** OpenRouter köprüsü (primary `google/gemini-2.5-flash-lite`, fallback `openrouter/free`; key server-only). Groq summarizer `qwen/qwen3.6-27b`. Artwork: Imagen→Gemini→HF (runtime, ANA_YASA §9 geçici istisna).
- **Persistence:** `journey-storage.ts` (localStorage) + `journey-remote.ts`/`cards-remote.ts` (Supabase), `cache/supabaseCache.ts` (30s TTL).
- **Landing/results:** MasterPosterCanvas, PosterLightbox (dreamy placeholder), MusicUniverseHero, SongUniverseCard, CardGallery.

---

## 4. Test / Derleme İstatistikleri (2026-09-19 doğrulandı)

- **Vitest:** 70 dosya, 664 passed / 2 skipped (0 failed) — `npm test`. visualSpec 13/13.
- **TypeScript:** `tsc --noEmit` 0 hata.
- **Lint:** `npx eslint src scripts --rule 'prettier/prettier: off'` = 0 hata, ~9 uyarı (baseline).
- **Build:** `npm run build` exit 0.

---

## 5. Açık / Bekleyen İşler

### Karar (2026-09-19) — Poster/Music Map Life-Stage Sistemi
Üç paralel yaş/yaşam-evresi sistemi tespit edildi ve çözüldü:
- **A)** 8'li journey evresi (`data.ts eras[]`, `lifeCards.ts`) — şarkı seçim akışının adımları; yaşam evresi kavramı değil.
- **B)** 6'lı şiirsel bölüm (`poetic-analyzer.ts CHAPTER_SLOTS`: 9-12, 12-18, 18-24, 24-30, 30-35, 35+) — mevcut Music Map UI ve kullanıcı referans posterleriyle birebir eşleşiyor.
- **C)** ANA_YASA §5.1 kanonik Life-Stage (Childhood, Adolescence, Young Adult, Adult, Midlife, Later Life) — yalnız tasarım, implemente değil, farklı etiketleme.

**KARAR:** Poster/Music Map görsel illüstrasyon seti **SİSTEM B'yi** temel alacak (6 kademe: 9-12, 12-18, 18-24, 24-30, 30-35, 35+). Gerekçe: zaten mevcut UI'da kullanılıyor, kullanıcının referans görselleriyle örtüşüyor, yeni bir kategorizasyon icat etmiyoruz.

**NOT:** Bu üç sistemin (A/B/C) uzun vadede birleştirilip birleştirilmeyeceği **AYRI bir karar** — şimdilik dokunulmuyor; yalnız B, poster illüstrasyon ekseni olarak seçildi. (i18n doğrulaması: `phaseAgeRanges` tüm dillerde zaten 6/6 içeriyordu — `i18n.test.tsx:27-42` 11/11 yeşil; kod değişikliği gerekmedi.)

### Karar (2026-09-20) — FAZ 4c: Palette Kaynağı [B]

FAZ 4c **ertelendi**. Etki analizi (33 şarkı simülasyonu) ~%15-25 şarkı bazında ayrışma gösterdi, ama kök neden tek bir kararla çözülecek kadar basit değildi — **iki iç içe geçmiş sorun** bulundu:

1. **`decadeTheme`'in "yıldan tür tahmin etme" mantığı temelden kırılgan** (tür, döneme bağlı değil — 1960s'ta country/rock/soul hepsi var, sadece jazz değil; 2010+ için "else→gothic" bu sorunun görünür ucu, kökü değil).
2. **`SCENE_KEYWORDS`'te "gothic" ailesi taksonomi hatası içeriyor** — gerçek gothic/metal/punk kümesiyle alakasız country/klasik/akustik türlerini de aynı şemsiyede topluyor (19 keyword, 3 farklı aileye ayrılmalı: dark/aggressive, acoustic/roots, classical/chamber).

**KARAR:** Bu iki sorun **AYRI, büyük bir ADIM**'da ele alınacak (taksonomi yeniden tasarımı: yeni palet tasarımı + fallback mantığı + ~20-30 test + ürün kararı gerektiren B/C birleştirme sorusu). Bugün yapılmadı.

Bu düzelene kadar FAZ 4c **"B" kalır**: SceneRoom, kendi `sceneThemeFor` kaynağını kullanmaya devam eder; resolver'ın `sceneThemeId`/`palette` çıktısı SceneRoom render'ında **tüketilmez** (backdrop/exactAssetRef için resolver zaten canlı — bu, YALNIZCA palette/tema rengi kaynağıyla ilgili).

**Blast radius (ölçülü, ileride referans):** `SceneThemeId` union genişlerse ~5 kaynak dosya (`scenePalettes.ts`, `sceneTheme.ts`, `visualResolver.ts`, `SceneRoom.tsx`, `EraCardReveal.tsx`) + 2-3 test dosyası etkilenir. gothic'e ait 50+ kod-tabanı eşleşmesinin çoğu (`gothicArt` UI, `huggingFaceService`, `cardThemes.css`, `DynamicMusicCard`) SCENE theme sisteminden bağımsız — dokunulmaz.

**Yeni açık iş (büyük, planlama gerekir):** "SCENE_KEYWORDS taksonomi yeniden tasarımı — gothic ailesini böl (dark/aggressive vs acoustic/roots/classical), decadeTheme'in yıldan-tür-tahmini mantığını gözden geçir (muhtemelen nötr/default fallback'e geç), FAZ 4c kararını bu iş bitince yeniden değerlendir."

### NOT (2026-09-20) — eraThemeFor'da AYNI kırık mantık yaşıyor

`decadeTheme` (resolver, render edilmiyor — FAZ 4c KARAR B) nötrleştirildi.
Ama `sceneThemeFor`'un fallback'i olan `eraThemeFor` (`sceneTheme.ts`) BİREBİR
aynı "yıldan tür tahmini" mantığını taşıyor VE bu, gerçekte RENDER
EDİLEN kaynak. Bunu nötrleştirmek:
- Gerçek görsel değişiklik yaratır (nostaljik dönem-atmosferi kalkar)
- `eraTheme` differ testini kırar
- kural-10'u TEKRAR AÇAR

Bu yüzden BİLEREK yapılmadı. Taksonomi yeniden tasarımı işiyle birlikte
ele alınacak (gothic bölme kararıyla aynı ADIM'da) — o zaman zaten
kural-10 tekrar açılacağı için, iki değişikliği (`eraThemeFor`
nötrleştirme + gothic bölme) birlikte yapıp TEK bir kural-10
doğrulamasıyla kapatmak daha verimli.

### Karar (2026-09-20) — HF Runtime Kapatma

Server-side HF kademesi kaldırıldı (`cardArtwork.server.ts`, `hfImage.server.ts`).
Gerekçe: config-by-dead (`HUGGINGFACE_API_KEY` hiç set değildi, sıfır
görsel etki), ANA_YASA §9'un "geçici istisna" niyetiyle tutarlı,
Visual Resolver/Asset Registry (FAZ 3-4b) olgunlaştığı için artık
gerekli değil.

Kaybedilen: Gemini/Imagen ikisi de başarısız olursa üçüncü fallback
yoktu, artık hiç yok. Bu risk ölçülemedi (kullanım sıklığı verisi
yoktu) ama bilerek kabul edildi.

AYRI, henüz yapılmayan iş: Client-side dead code (`VITE_HF_TOKEN`,
`huggingFaceService.ts:generateGothicArt` — hiç çağrılmıyor, ama
`CardGallery.tsx`/`gothicArt.tsx` hata tiplerini import ediyor). Bu,
CardGallery'nin error-retry mantığına dokunacağı için ayrı, daha
dikkatli bir P2 temizliği olarak kalıyor.

### Karar (2026-09-20) — KARAR REVİZYONU: Kart/Poster Metin Stratejisi

**ÖNCEKİ KARAR (oturum başı):** "9 mood-backdrop görseli nihai tasarım,
üstüne ayrıca metin bindirilmeyecek."

**YENİ KARAR:** Arka planlar TEMİZ üretilecek (metinsiz), gerçek metin
(şarkı adı, sanatçı, dönem etiketi vb.) **CSS/HTML tipografi** ile bindirilecek.

**Gerekçe:** (1) AI modelleri metni güvenilir yazamıyor — üretim/tekrar
deneme maliyetini artırıyor; (2) metin CSS'te olursa yazım hatası/çeviri
güncellemesi görsel yeniden üretimi gerektirmiyor; (3) tipografi tutarlılığı
garanti oluyor (AI her seferinde farklı çiziyor).

Bu, önceki kararın **BİLİNÇLİ tersine çevrilmesidir** — sessiz üzerine yazma
değil. Mevcut kod çizgisiyle uyumludur: `cardArtwork.server.ts`
`buildCardArtworkPrompt` zaten "...never draw card titles, headings or any
readable text into the image" der; QuizCard metinleri (`copy.title`, `copy.body`,
footer skoru) HTML katmanında render eder. Yani sunucu çizgisi metinsiz üretir;
metin zaten DOM'dan gelir — bu karar bunu doğrular, rastgele görsel metin
bindirilmez. NOT: "9 mood-backdrop" asset'i SceneRoom duvar kağıdıdır; kart
yüzünde albüm kapağı + AI resmi ayrı katmandır (QuizCard art-window).

### UI görsel doğrulaması (kural 10) — TAMAMLANDI (2026-09-20)
1. **Mood-backdrop doğrulaması — ✅ TAMAMLANDI (kullanıcı onayı, 2026-09-20):** `npm run dev` → journey 8 şarkıyla tamamlandı → her EraCardReveal'da şarkının mood'uyla eşleşen wallpaper görüldü, kullanıcı "Arayüz Onaylandı" dedi. ⚠️ Mood inference gerçek OpenRouter key ister (`.env`'de `OPENROUTER_API_KEY`).
   **Koşullu yeniden-açma:** Taksonomi yeniden tasarımı (gothic bölme / decadeTheme sadeleştirme, bkz. aşağı "Karar FAZ 4c"), FAZ 4c palette kaynağı değişimi, veya registry'ye `mood-backdrop-*.png`'den FARKLI bir exact asset eklenmesi gibi görsel-üretim değişiklikleri yapılırsa kural-10 **YENİDEN açılır** (kullanıcı göz doğrulaması gerekir). Bu, "bekliyor" statüsü değil — tamamlanmış ama koşullu.

   **UYARI (2026-09-20) — ✅ KAPANDI (onay 2026-09-20):** QuizCard.tsx redesign implementasyonu başladığında kural-10 **TEKRAR AÇILACAKTI** (kart render davranışı değişecekti — buton ekleme, puan/fiyat kaldırma, "ADD TO COLLECTION" state'i). Koşul gerçekleşti: implementasyon (Adım 1-4) bitti, uçtan uca gözle doğrulandı, "Arayüz Onaylandı" alındı → **bu uyarı kapanma koşulunu tamamladı**. Taksonomi yeniden tasarımından **bağımsızdı**; artık kapalı. Kural-10 yalnızca yeni görsel-üretim işlerinde (taksonomi / FAZ 4c / yeni exact asset) yeniden açılır.

   **PALET GÖRÜNÜRLÜĞÜ NOTU (2026-09-20):** Taksonomi yeniden tasarımı (gothic split + acoustic + eraThemeFor nötralizasyonu) kod + test düzeyinde doğru ve 682/684 yeşil. Ancak `SCENE_PALETTES[themeId]`'nin kullanıcıya görünür etkisi yok: wall gradient kök div'de, backdrop blur-cover katmanı onu TAMAMEN örtüyor (moodImage her zaman dolu URL — dreamy fallback); glow yalnızca çok hafif bir screen-blend üst parlaması. Dolayısıyla bu değişiklik için kural-10'un "gözle doğrulama" standardı UYGULANABİLİR DEĞİL — görsel olarak doğrulanacak bir fark yok. Paletler ileride prosedürel masa/raf/kitap render'ına bağlandığında görünür olur ve kural-10 o noktada yeniden açılmalıdır.

### FAZ 4 / P2 (sonraki oturumlar)
2. **FAZ 4c — ertelendi (KARAR "B", 2026-09-20):** SceneRoom `resolveSceneVisualSpec` + exactAssetRef URL çözümü canlı (FAZ 4a/4b). Palette/tema rengi KAYNAĞI: **sceneThemeFor kanonik kalıyor**; resolver'ın `sceneThemeId`/`palette` çıktısı render'da tüketilmez (backdrop/exactAssetRef için resolver canlı). Gerekçe + blast radius + taksonomi planı: §5 "Karar (2026-09-20) — FAZ 4c" bloğu. ⚠️ Registry'ye mood-dosyasından farklı exact asset eklendiğinde kural-10 tekrar açılmalı.
3. **Asset Registry genişlemesi:** kullanıcı yeni `genre × decade × mood` kombinasyonu ürettikçe `SCENE_ASSET_REGISTRY`'ye manuel ekleme (yalnız onayla, No Uncontrolled Refactoring).
4. **P1 kalıntısı:** çoklu-kaynak genre (MusicBrainz/iTunes tekeli kır), artist metadata, musical characteristics.
5. **P2:** MusicUniverseHero görsel zenginliği (istatistik kartları, gradient) placeholder/skeleton ile geri kazan; SongUniverseCard'a gerçek `grounded.timeline.nodes` context'i bağla.
6. **Orphan araç — SİLİNDİ (2026-09-20):** `scripts/generate-room-backdrop.mjs` + `package.json` `gen:room` kaldırıldı (ürettiği `room-backdrop-*.png` zaten kullanılmıyordu; canlı asset = `mood-backdrop-*.png`). İlişkili doc referansları güncellendi.

### Güvenlik / house-keeping (yeni: HF kapatma eklendi)
7. **OpenRouter key rotasyonu:** yeni key `.env`/`.env.example`'ta; canlılık (HTTP 200) hâlâ test edilmedi. HEAD `17f9141` eski `settings.json` key'ini git history'de commit'lemiştir — kalıcıdır (purge = force-push, repoda yasak).
8. **HF runtime üretimi — SERVER-side SİLİNDİ (2026-09-20); client-side AYRI P2:** `cardArtwork.server.ts` zincirinden HF kademesi kaldırıldı (`hfImage.server.ts` silindi) — artık Imagen→Gemini. Gerekçe + kabul edilen risk + ayrı client işi: §5 "Karar (2026-09-20) — HF Runtime Kapatma". Client dead code (`VITE_HF_TOKEN` / `generateGothicArt`) CardGallery error-retry mantığına dokunduğu için AYRI, dikkatli P2 olarak duruyor.
9. **Küçük, ayrı temizlik — Adım 1'den kalan ölü i18n alanı (`intensityLabel`):** QuizCard skor rozeti kaldırılınca `quizCard.intensityLabel` tip'te + 5 dilde (en/tr/es/de/fr) hâlâ duruyor, kullanan YOK. QuizCard redesign'ın Adım 1-3'ü sırasında BİLEREK dokunulmadı (kapsam dışı). Adım 4 ile KARIŞTIRILMAMALI — ayrı, küçük bir temizlik olarak ele alınacak (dictionaries.ts tip + 5 dil bloğundan `intensityLabel` silinmeli).

---

## 6. Sıradaki İş Adımları (Next Steps)

1. **✅ Kural-10 tamamlandı (2026-09-20):** mood-backdrop doğrulaması onaylandı — "Arayüz Onaylandı". Sıradaki görsel doğrulama yalnızca koşullu yeniden-açma durumlarında (taksonomi / FAZ 4c / yeni exact asset).
2. **FAZ 4b tamamlandı:** exactAssetRef → gerçek URL çözülüp resolver backdrop'unda önceliklendirildi (pass-through: pilot exact asset'ler == mood dosyaları; 40/40, tsc temiz). Kalan: FAZ 4c (palette/eraStyle/eraTheme wiring) ayrı kanonik-kaynak kararı (sceneThemeFor vs resolver sceneThemeId — 2010-sonrası farklı sonuç, bilinen risk); orphan script temizliği (`generate-room-backdrop.mjs`) tamamlandı (silindi 2026-09-20). ⚠️ mood-dosyasından farklı exact asset eklendiğinde kural-10 tekrar açılmalı.
3. **Sırada (onayla):** user yetkisi — yeni asset kombinasyonu ekleme, FAZ 4c (palette kanonik-kaynak kararı), HF runtime kapanışı.
4. **QuizCard redesign (Adım 1-4 TAMAMLANDI — onay 2026-09-20):** (1) hash-skoru + score/scoreLabel kaldırıldı; (2) preview toggle görünür "Play/Mute" butonuna çevrildi; (3) journey-bağımsız "Add to Collection" (localStorage cap-50, idempotent toggle) eklendi; (4) okunurluk katmanı (gradient scrim + text-shadow + backdrop-blur + safe-area) eklendi. Dil seçici UI eklenmedi (Q1=B — mevcut LanguageSwitcher journey header'ında erişilebilir kalıyor, EraCardReveal modal değil). **Kural-10: "Arayüz Onaylandı" (2026-09-20)** — uçtan uca gözle doğrulandı; önceki §5 UYARI'sı kapanma koşulu gerçekleşti (implementasyon bitti + onaylandı). Kanalı kapanan kural-10, yalnızca yeni görsel-üretim değişikliği (taksonomi / FAZ 4c / yeni exact asset) olursa yeniden açılır.

---

## 7. Yapılmaması Gerekenler

- **`git add -A` / commit'e ters git KESİNLİKLE YASAK:** `settings.json` anahtar taşır; `.claude/` + olası debris süpürülür. Sadece **belirli dosyalar/pat'lar** `git add` edilir.
- **Key sızdırma:** `ANTHROPIC_AUTH_TOKEN` / `OPENROUTER_API_KEY`'i yeni commit'lere/log'a asla; `.env` gitignore'da kalır. Ölü client anahtar kodu (gemini.ts `VITE_GEMINI_API_KEY`, generateGothicArt `VITE_HF_TOKEN`) runtime'da çağrılmıyor — kaldırmak/belgelemek ayrı P2.
- **ANA_YASA §0 ihlali:** Uydurma fallback değerleri geri getirme (`Timeless`, `Eclectic Explorer`, `diversity ?? 100`, genre→mood sabit eşleme). Mood bilinmezse null/dreamy.
- **Runtime görsel üretimi ÇOĞALTMA:** FAZ 3.1 exact-match registry seçim katmanıdır; yeni runtime AI/GPT Image üretimi EKLEME (ANA_YASA §9 — yalnız kullanıcının manuel ürettiği asset'ler kayıtlanır, kartezyen matris YOK §10).
- İç içe `soundtrack-ai/` repo'suna yazma / oradan merge etme.
- **Lint/çizgi sonu tuzağı:** ham `eslint .`'yi koşma (untracked debri asıyor); `prettier --write .` / `git add --renormalize`'ı rastgele koşma.
- Testleri "geçsin diye" değiştirme/zayıflatma.
- **Git commit kimliği:** Bu repoda atılan commit'ler `mascarillion8888 <67925182+mascarillion8888@users.noreply.github.com>` kimliğiyle olmalı (repo-local `git config`; `--global` DEĞİL). Farklı kimlik Vercel Hobby deployment'ını bloklar.
- **`git commit --allow-empty` tuzağı:** index'te staged dosya varsa ONLARI da commit'ler; boş commit öncesi `git status` / `git diff --cached --name-only` ile index'in boş olduğunu doğrula.
- **handoff-check:** `src/`, `supabase/`, `docs/PRODUCT/`, `orchestra/` altında değişiklik yapan push'lar `docs/HANDOFF.md` güncellemesi OLMADAN kırmızı X üretir — gerçek iş + HANDOFF aynı push'ta/checkpoint'te gider.

---

## 8. Devir Kaydı (son commit'ler)

```
12942cb feat(scene): backdrop selection now multi-axis (mood+genre+decade)
ea84a6e feat(visual): exact-match asset registry for manually produced combos (FAZ 3.1)
2883f9a feat(visual): add deterministic scene visual contract (FAZ 3)
c886a12 feat(arch): canonical Visual Resolver input = interactive Song{mood, genre, decade} (18 Eylül LOCKED)
759ab29 docs(scene): Visual Resolver contract type on moodBackdrop + Phase-4 deferral note (Faz 2)
5c8707b feat(journey): infer + persist Song.mood so SceneRoom shows the mood wallpaper (Faz 1)
112d70f fix(scene): mood-backdrop single visual standard; remove genre room backdrops (Faz 0)
72547db chore: mood-backdrop görselleri 1620x941 çözünürlüğe güncellendi + STATE NOTLAR
e2a8d67 feat(scene): mood-backdrop wallpapers (9x MOOD_SET) + SceneRoom mood prop (fallback genre)
6188005 docs: HANDOFF senkronu + bos placeholder'lara durum notu (AI/*, DEPLOYMENT)
e6baf2a docs: hedef mimari kararlari + ANA_YASA $9 uzlastirmasi + deployment netlestirmesi
ef27814 fix(mood): dedupe render-driven 8x mood-inference calls on results page
```

---

## 9. Bu Oturumda Öğrenilen Kritik Bilgi

- **Kanonik görsel girdi (18 Eylül LOCKED):** Resolver girdisi tek eksen değil `Song {mood, genre, decade}` bileşimidir. Mood bağımsız eksen; genre/decade tek başına görsel seçmez. Eksik eksen deterministik fallback'e iner, uydurulmaz (ANA_YASA §0); `fallbackTrace` kararı izlenebilir kılar.
- **Exact-match registry (19 Eylül):** `resolveExactAsset` genre→küçük-harf, decade→`1980s` (yoksa releaseYear'den `floor(y/10)*10}s`), mood→case-insensitive eşler. Registry'de olmayan kombinasyon mevcut FAZ 3 zincirine aynen düşer — davranış bozulmaz, testler kırılmaz (boş-geçiş garantisi). Görsel değişiklik YOK, sadece traceability.
- **Runtime görsel üretimi (kalıcı):** Ana katman (FAZ 3/3.1) runtime'da YENİ görsel ÜRETMEZ — sadece onaylı/manuel asset'lerden seçim. `cardArtwork.server.ts` (Imagen→Gemini→HF) CURRENT geçici istisna olarak kalır (ANA_YASA §9); kartezyen matris YOK (§10).
- **`git add -A` tuzağı:** commit'lere ters git / debris süpürülmemesi için sadece targeted `git add <path>`. `.claude/` ve untracked çalışma ağacı kalıntıları dışarıda tutulur.
- **Deployment gerçeği (kalıcı):** main aktif = Vercel (Node+Nitro react-start). Docker yalnızca `remotes/origin/migration/node-docker-v1`'de, main'de yok. "Node+Nitro+Docker" STATE üst satırı VİZYON.

---

_Artık son güncelleme: Hermes — 2026-09-19 (FAZ 3 → 3.2: multi-axis backdrop entegrasyonu push edildi; handoff-check yeşilde; test 4 dosya/40, tsc 0, lint 0e/~9w)._
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log + STATE.md gerçektir._