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
HEAD:       e9a012c — "checkpoint: card overlay v1 + rebase senkronu — HANDOFF.md güncellendi"
            origin/main ile SENKRON (rev-list 0 0; push edildi 2026-09-22)
            DÜZELTME (2026-09-23): 397ac09..e9a012c aralığı YALNIZCA 4 commit'tir — b5257a1, 6985aeb,
            d7045eb, e9a012c. "Uzak 19-commit rebase" iddiası YANLIŞTIR: bu klonun reflog'unda rebase
            yok, d7045eb/e9a012c LOCAL reflog'da hiç geçmiyor (başka — dün akşamki Hermes — oturumda
            üretilip origin'e push edilmiş, bu klon sabah 07:35 "pull fast-forward" ile çekti). Hash
            değişimi YOK, force-push YOK — güvenli; eski commit numaralarımız geçerli.
            Son zincir (kritik):
              e9a012c  checkpoint: card overlay v1 + rebase senkronu — HANDOFF güncellendi
              d7045eb  feat(card): optional card-frame template overlay (QuizCard templateFile + cardTemplates.ts + EraCardReveal default-null) — 4 dosya
              6985aeb  docs(handoff): genre-normalize fix + BUG 2 açık iş
              b5257a1  fix(visual): genre alias normalize (R&B/Soul→soul) — soul exact-assets eşleşiyor
              397ac09  checkpoint: soul 6 yeni exact-asset + kural-10 Test B 9 mood
              3892330  refactor(visual): gothic → dark/acoustic ayrımı + eraThemeFor year-guess nötralize
              d5c2131  refactor(hf): client-side HF dead-code TAMAMEN kaldırıldı (huggingFaceService.* silindi)
              be79f9c  feat(card): QuizCard redesign Adım 1-4 + okunurluk katmanı
Testler:    69 dosya, 674 passed / 2 skipped (676) — vitest v4.1.10, `npm test` exit 0 (2026-09-22)
            visualSpec exact-match/genre-normalize dahil 19/19 yeşil (doğrulandı 2026-09-23)
tsc:        temiz (`npm run typecheck` = 0 hata)
Lint:       1 error (prefer-const 'palette') + 9 uyarı (baseline, pre-existing — bu oturum dokunmadı)
Build:      `npm run build` exit 0 (doğrulandı 2026-09-22).
Worktree:   temiz. stash@{0}=HF WIP backup (superseded — onaysız drop YOK). Asset 18 PNG
            (9× mood-backdrop-*.png + 9× backdrop-soul-*.png). .claude/ YOK.
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

### 2d. Manual kart çerçevesi OVERLAY — v1 (commit `d7045eb`, 2026-09-22)
- **NEDEN:** Kullanıcının kartın tasarımını (çerçeve) şarkıya özel AI artwork'ünden AYRI yönetebilmesi: ham yazısız AI sahnesi + manuel kart modeli + HTML/CSS metin.
- **NASIL (4 dosya, geri alınabilir):** `src/lib/card/cardTemplates.ts` (yeni — Vite glob `../../assets/card-templates/*.png` + `cardTemplateUrl(file)` + `CARD_TEMPLATES` registry; V1 BOŞ = opt-in, PNG yok); `QuizCard.tsx` — opsiyonel `templateFile` prop, art penceresine `card-art-template` overlay `<img>` (yalnız dosya çözülürse; default null = görünüm değişmez); `EraCardReveal.tsx` — `templateFile={null}` (wiring yerinde, default kapalı); `QuizCard.test.tsx` — +2 test (open/off).
- **Sonuç:** Rebase sonrası tsc 0, build 0, suite 69 dosya/674 pass/2 skip. Overlay yalnız journey QuizCard yüzeyinde; share/gallery/poster'dan bağımsız (bilinçli).
- **Kapsam dışı (v2):** gerçek PNG asset yüklemek (`src/assets/card-templates/`), `CARD_TEMPLATES` registry eşlemesi + `scene→file` resolver.
- **Sync notu:** Bu push `src/` dokundu; HANDOFF güncellemesi AYRI docs push'u (bu commit 03dccb9-sonrası zincirde). Kural-10: overlay default OFF olduğu için görsel değişiklik YOK — açılmadı. Bir asset eklendiğinde/template aktifleştiğinde kural-10 yeniden açılmalı.


---

## 3. Kod Tabanı Özeti & Mevcut Durum

- **Scene/backdrop:** `SceneRoom` = tek backdrop standardı; backdrop artık `moodBackdropUrl(mood, genre, decade)` ile çok-eksenli çözülür (fallback: dec×gen×mood → dec×mood → gen×mood → mood; mood yoksa `dreamy`). Decade, `releaseYear`'den `eraThemeForYear` ile türetilir (tek kaynak).
- **Backdrop sabit-oran kiliti — DOĞRULANDI (2026-09-23):** `aspect-[3/4]` (EraCardReveal.tsx:42) 9ff7671'de zaten uygulanmış. 3 viewport'ta (1920, 1106, 390px) gerçek DOM ölçümüyle (getBoundingClientRect) doğrulandı — hepsi tam 0.750 (3:4), viewport yüksekliğinden bağımsız. Mobilde (390px) içerik container'ı aşıyor (709px > 500px) ama `overflow-y:auto` ile sayfa-içi scroll'a düşüyor, kırpma YOK — beklenen/kabul edilebilir davranış.
- **BULGU (2026-09-23):** `backdrop-soul-{energetic,euphoric,playful}.png` 1024×1536 (2:3) üretilmiş; setin geri kalanı (dark, dreamy, melancholic, nostalgic, romantic, world + genel `mood-backdrop-*`) 1086×1448 (3:4). Bu 3 dosya container'ın (3:4) beklediği orandan farklı — contain katmanında üstte/altta ince boşluk bırakabilir (kırpma değil ama tutarsız görünüm). Asset üretim sırasında düzeltilmeli (kullanıcı elle üretiyor).
- **BULGU (2026-09-23): STEEL era age-range komşularla örtüşüyor.** lifeCards.ts'te `ageRanges[4]="Ages 18-28"` — komşu `[3]="Ages 18-22"` ve `[5]="Ages 23-30"` ile çakışıyor. Sonraki düzeltmede ele alınacak (bu turda düzeltilmedi).
- **Visual katmanı (yeni, FAZ 3/3.1):** `src/types/visualSpec.ts` (kontrat), `src/lib/visual/visualResolver.ts` (`resolveSceneVisualSpec` deterministik, `resolveExactAsset`), `src/lib/visual/assetRegistry.ts` (`SCENE_ASSET_REGISTRY`, pilot pop×1980s×9 mood), `src/lib/visual/visualSpec.test.ts` (13 test).
- **Motorlar:** `musicDnaEngine.ts` (mood-coverage gate'li vibe), `lifeStoryEngine.ts`, `emotionalTimelineEngine.ts`.
- **Mood veri yolu:** provider→Song(mood null)→journey şarkı seçimi→`resolveSongMood`(inferMood)→`Song.mood` persist→SceneRoom mood-backdrop.
- **Pipeline:** `src/lib/ai/pipeline.ts` → `generateGroundedAnalysis` (content-keyed memo + contextText fingerprint).
- **LLM:** OpenRouter köprüsü (primary `google/gemini-2.5-flash-lite`, fallback `openrouter/free`; key server-only). Groq summarizer `qwen/qwen3.6-27b`. Artwork: Imagen→Gemini→HF (runtime, ANA_YASA §9 geçici istisna).
- **Persistence:** `journey-storage.ts` (localStorage) + `journey-remote.ts`/`cards-remote.ts` (Supabase), `cache/supabaseCache.ts` (30s TTL).
- **Landing/results:** MasterPosterCanvas, PosterLightbox (dreamy placeholder), MusicUniverseHero, SongUniverseCard, CardGallery.

---

## 4. Test / Derleme İstatistikleri (2026-09-23 doğrulandı)

- **Vitest:** 69 dosya, 674 passed / 2 skipped (0 failed) — `npm test` exit 0 (doğrulandı 2026-09-23). visualSpec 19/19.
- **TypeScript:** `tsc --noEmit` 0 hata.
- **Lint:** `npx eslint src scripts --rule 'prettier/prettier: off'` = 1 error (baseline `prefer-const 'palette'` visualResolver.ts:171) + ~9 uyarı (pre-existing).
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

**DURUM (güncellendi 2026-09-23): taksonomi bölmesi ve eraThemeFor nötralizasyonu EXECUTE edildi (3892330, 2026-09-21).** Bu bloktaki "Bugün yapılmadı / Yeni açık iş: planlama gerekir" ifadeleri artık GEÇERSİZ. Gerçekte:
- `decadeTheme` ve `eraThemeFor` ikisi de nötrleştirildi → yalnız `return "gothic"` (yıldan-tür tahmini kaldırıldı).
- gothic keyword ailesi 19→9'a düşürüldü (dark/aggressive: goth, doom, metal, thrash, slayer, sabbath, priest, maiden, punk); yeni `acoustic` ailesi (10: acoustic, country, americana, bluegrass, folk, classical, orchestra, piano, symphony, sonata); `SceneThemeId` +"acoustic"; `SCENE_PALETTES.acoustic` eklendi.
- Bu, GERÇEK bir görsel değişiklikti (nostaljik dönem-atmosferi kalktı) → kural-10 bir kez daha açıldı ve doğrulandı.
Tam kayıt: skill `references/faz-4c-and-taxonomy.md`.

**Kalan FAZ 4c (hâlâ açık, KARAR "B"):** yukarıdaki taksonomi işi BİTmiştir, ama palette/tema rengi KAYNAĞI kararı değişmedi. SceneRoom, kendi `sceneThemeFor` kaynağını kullanmaya devam eder; resolver'ın `sceneThemeId`/`palette` çıktısı SceneRoom render'ında **tüketilmez** (backdrop/exactAssetRef için resolver zaten canlı — bu, YALNIZCA palette/tema rengi kaynağıyla ilgili). `sceneThemeFor` ve resolver iki ayrı kaynaktan türetir (farklı sonuç verebilir, bilinen risk).

**Blast radius (ölçülü, ileride referans):** `SceneThemeId` union daha da genişlerse ~5 kaynak dosya (`scenePalettes.ts`, `sceneTheme.ts`, `visualResolver.ts`, `SceneRoom.tsx`, `EraCardReveal.tsx`) + 2-3 test dosyası etkilenir. gothic'e ait 50+ kod-tabanı eşleşmesinin çoğu (`gothicArt` UI, `huggingFaceService`, `cardThemes.css`, `DynamicMusicCard`) SCENE theme sisteminden bağımsız — dokunulmaz.

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

      **SOUL EXACT-ASSET KAYDI (2026-09-20, b995ce2; 6 yeni mood 2026-09-22) — KURAL-10 DURUMU GÜNCELLENDİ:**
      Asset Registry'ye iki dalgada decade-free soul kayıtları eklendi: ilk 3 mood (Energetic/Euphoric/Playful, b995ce2)
      ve **6 yeni mood (Romantic/Melancholic/Dreamy/Nostalgic/Dark/World)** → soul artık **9/9 mood'un tamamı** `backdrop-soul-*.png` ile exact-match.
      `SceneAssetEntry.decade` opsiyonel (`decade?: string`); decade taşımayan kayıt her yılda eşleşir, pop-1980s pilotu hâlâ tam-eşleşme (regresyon testi).
      Kritik fix'ler: fallbackTrace decade-undefined crash + `moodBackdrop.ts` glob'unun `backdrop-soul-*.png`'i çözmesi (iki pattern).
      Bilinen kabul edilen kusur: soul dosyaları 3:4 (1086×1448), eski `mood-backdrop-*.png` 2:3 — contain ile letterbox olası.

      **KURAL-10 (2026-09-22, DÜZELTİLDİ — önceki "değişiklik yok" değerlendirmesi HATALIYDI):**
      Bu 6 yeni exact-match kaydı, soul + {Romantic, Melancholic, Dreamy, Nostalgic, Dark, World} seçildiğinde ARTIK genel
      mood-fallback yerine özel `backdrop-soul-*.png` gösterilmesi demektir — **GERÇEK bir görsel değişiklik.** (Önceki HANDOFF
      notundaki "görsel değişiklik YOK / passthrough" değerlendirmesi yalnızca pop-1980s pilotu için doğruydu — orada exact asset == mood dosyasıydı.
      Soul'da dosya FARKLI olduğu için bu gerekçe geçerli değil.)

      **Kural-10 Test B kapsamı GENİŞLEDİ:** artık yalnızca 3 değil, **9 soul mood'unun tamamı için gözle doğrulama** gerekiyor
      (ilk 3'ü zaten bekliyordu — energetic/euphoric/playful — şimdi 6'sı daha eklendi).
      Test A (soul + eşleşmeyen mood → mood-fallback) ✅ PASS (kod testi + gözle).

      **DURUM: TAMAMLANDI DEĞİL.** Kod push edilecek (2026-09-22), ama gözle doğrulama (soul + herhangi bir mood'un doğru
            `backdrop-soul-*.png` göstermesi) hâlâ bekliyor — sıradaki oturumda soul şarkısı (genre="soul") ile son 6 mood dahil doğrulanacak.

      **KARAR (2026-09-22) — Genre normalize fix (b5257a1) + AÇIK görsel iş (BUG 2):**
      **DÜZELTİLDİ (b5257a1, fix):** exact-match genre eşleşmesi artık `normalizeGenre` kullanıyor
      (`assetRegistry.ts` `GENRE_ALIASES`): iTunes "R&B/Soul" → "soul", "Hip-Hop" → "hiphop", "New Wave" → "synth"
      vb. Kök neden: soul exact-asset'lerin (9× `backdrop-soul-*.png`) **HİÇ gösterilmediği** bulundu — iTunes genre
      "R&B/Soul" veriyordu, registry anahtarı "soul" olduğu için `===` eşleşmesi başarısızdı ve sistem eski
      `mood-backdrop-*.png`'e düşüyordu. Bu yüzden Aretha/Otis gibi soul efsaneleri ("R&B/Soul") hep aynı eski
      mood-backdrop'u gösteriyordu (kullanıcı "hep POP" gözleminin kaynağı). Fix sonrası soul + mood → `backdrop-soul-*.png`.

      **BUG 2 — AÇIK GÖRSEL İŞ (görsel yeniden-üretim, kullanıcı onayı + ayrı task):**
      Eski `mood-backdrop-*.png` dosyaları (FAZ 3 öncesi 9'luk set) **İÇLERİNDE METİN TAŞIYOR** (Vision ile doğrulandı):
      örn. `mood-backdrop-romantic.png` sol üstte "1980s • POP" + "ROMANTIC", ayrıca duvar/rafta DURAN DURAN,
      MADONNA, THE CURE, A-HA, DEPECHE MODE etiketleri. Bu, **KARAR REVİZYONU'nun ihlalidir** (2026-09-20: görseller
      metinsiz üretilir, metin CSS/DOM'dan gelir). Programatik düzeltilemez — 9+ dosyanın metinsiz olarak YENİDEN
      ÜRETİLMESİ gerekir (kullanıcının asset üretim işi). Soul şarkılarında artık yeni soul dosyaları gösterildiği için
      bu kusur soul'da görünmez; diğer tür/decade kombinasyonlarında eski dosyalar hâlâ kullanılır.

   ### FAZ 4 / P2 (sonraki oturumlar)
2. **FAZ 4c — ertelendi (KARAR "B", 2026-09-20):** SceneRoom `resolveSceneVisualSpec` + exactAssetRef URL çözümü canlı (FAZ 4a/4b). Palette/tema rengi KAYNAĞI: **sceneThemeFor kanonik kalıyor**; resolver'ın `sceneThemeId`/`palette` çıktısı render'da tüketilmez (backdrop/exactAssetRef için resolver canlı). Gerekçe + blast radius + taksonomi planı: §5 "Karar (2026-09-20) — FAZ 4c" bloğu. ⚠️ Registry'ye mood-dosyasından farklı exact asset eklendiğinde kural-10 tekrar açılmalı.
3. **Asset Registry genişlemesi:** kullanıcı yeni `genre × decade × mood` kombinasyonu ürettikçe `SCENE_ASSET_REGISTRY`'ye manuel ekleme (yalnız onayla, No Uncontrolled Refactoring).
4. **P1 kalıntısı:** çoklu-kaynak genre (MusicBrainz/iTunes tekeli kır), artist metadata, musical characteristics.
5. **P2:** MusicUniverseHero görsel zenginliği (istatistik kartları, gradient) placeholder/skeleton ile geri kazan; SongUniverseCard'a gerçek `grounded.timeline.nodes` context'i bağla.
6. **Orphan araç — SİLİNDİ (2026-09-20):** `scripts/generate-room-backdrop.mjs` + `package.json` `gen:room` kaldırıldı (ürettiği `room-backdrop-*.png` zaten kullanılmıyordu; canlı asset = `mood-backdrop-*.png`). İlişkili doc referansları güncellendi.

### Güvenlik / house-keeping (yeni: HF kapatma eklendi)
7. **OpenRouter key rotasyonu:** yeni key `.env`/`.env.example`'ta; canlılık (HTTP 200) hâlâ test edilmedi. HEAD `17f9141` eski `settings.json` key'ini git history'de commit'lemiştir — kalıcıdır (purge = force-push, repoda yasak).
8. **HF — server-side SİLİNDİ (2026-09-20) + client-side DEAD-CODE KALDIRILDI (2026-09-20, d5c2131) — ✅ TAMAMLANDI:** `cardArtwork.server.ts` HF kademesi (`hfImage.server.ts`) çoktan kaldırılmıştı (Imagen→Gemini). Şimdi client-side HF tamamen temizlendi: `huggingFaceService.ts` + `generateGothicArt` + `huggingFaceService.test.ts` silindi; CardGallery'deki zombi error-retry dalları (asla tetiklenemeyen `GothicArtError`/`isRetryableHfError`) genel bozulma paneline indirildi; `gothicArt.tsx`'te `GothicArtErrorKind` dosya-lokal oldu; `liveSmoke.ts` HF probe'u kaldırıldı; `.env.example`'dan `VITE_HF_TOKEN=` çıkarıldı. `GothicArtSkeleton`/`GothicArtFallback` genel UI olarak korundu (rename ayrı isteğe bağlı). Kapsam: d5c2131, 8 dosya +26/-242. Bu madde kapanmıştır.
9. **Küçük, ayrı temizlik — Adım 1'den kalan ölü i18n alanı (`intensityLabel`):** QuizCard skor rozeti kaldırılınca `quizCard.intensityLabel` tip'te + 5 dilde (en/tr/es/de/fr) hâlâ duruyor, kullanan YOK. QuizCard redesign'ın Adım 1-3'ü sırasında BİLEREK dokunulmadı (kapsam dışı). Adım 4 ile KARIŞTIRILMAMALI — ayrı, küçük bir temizlik olarak ele alınacak (dictionaries.ts tip + 5 dil bloğundan `intensityLabel` silinmeli).

---

## 6. Sıradaki İş Adımları (Next Steps)

1. **✅ Kural-10 tamamlandı (2026-09-20):** mood-backdrop doğrulaması onaylandı — "Arayüz Onaylandı". Sıradaki görsel doğrulama yalnızca koşullu yeniden-açma durumlarında (taksonomi / FAZ 4c / yeni exact asset).
2. **FAZ 4b tamamlandı:** exactAssetRef → gerçek URL çözülüp resolver backdrop'unda önceliklendirildi (pass-through: pilot exact asset'ler == mood dosyaları; 40/40, tsc temiz). Kalan: FAZ 4c (palette/eraStyle/eraTheme wiring) ayrı kanonik-kaynak kararı (sceneThemeFor vs resolver sceneThemeId — 2010-sonrası farklı sonuç, bilinen risk); orphan script temizliği (`generate-room-backdrop.mjs`) tamamlandı (silindi 2026-09-20). ⚠️ mood-dosyasından farklı exact asset eklendiğinde kural-10 tekrar açılmalı.
3. **Sırada (onayla):** user yetkisi — yeni asset kombinasyonu ekleme, FAZ 4c (palette kanonik-kaynak kararı), HF runtime kapanışı.
4. **QuizCard redesign (Adım 1-4 TAMAMLANDI — onay 2026-09-20):** (1) hash-skoru + score/scoreLabel kaldırıldı; (2) preview toggle görünür "Play/Mute" butonuna çevrildi; (3) journey-bağımsız "Add to Collection" (localStorage cap-50, idempotent toggle) eklendi; (4) okunurluk katmanı (gradient scrim + text-shadow + backdrop-blur + safe-area) eklendi. Dil seçici UI eklenmedi (Q1=B — mevcut LanguageSwitcher journey header'ında erişilebilir kalıyor, EraCardReveal modal değil). **Kural-10: "Arayüz Onaylandı" (2026-09-20)** — uçtan uca gözle doğrulandı; önceki §5 UYARI'sı kapanma koşulu gerçekleşti (implementasyon bitti + onaylandı). Kanalı kapanan kural-10, yalnızca yeni görsel-üretim değişikliği (taksonomi / FAZ 4c / yeni exact asset) olursa yeniden açılır.
5. **Kart çerçevesi OVERLAY v1 TAMAMLANDI (2026-09-22, d7045eb):** default kapalı (null). Sırada (onayla): gerçek `card-templates/*.png` asset'ini yükle + `templateFile` bağla / `CARD_TEMPLATES` registry eşlemesi; overlay aktifleşince kural-10 aç.

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
d7045eb feat(card): optional card-frame template overlay (QuizCard templateFile + cardTemplates.ts)
6985aeb docs(handoff): genre-normalize fix (b5257a1) + BUG 2 eski metin-işlenmiş mood-backdrop açar iş
b5257a1 fix(visual): normalize genre aliases so iTunes 'R&B/Soul' matches soul exact-assets
d5c2131 refactor(hf): remove dead client-side HuggingFace service (generateGothicArt + types + gallery zombie retry)
25fdcb6 docs(handoff): record HF runtime shutdown (server removed, client dead-code = separate P2)
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

_Artık son güncelleme: Hermes — 2026-09-23 (HANDOFF refresh: §1 HEAD→e9a012c, §4 istatistik 69/674, §5 taksonomi bloğu 3892330'da EXECUTE'di, "19-commit" iddiası 4 commit'e düzeltildi — hash değişimi/force-push YOK). docs-only değişiklik, handoff-check yeşil hedefi._
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log + STATE.md gerçektir._