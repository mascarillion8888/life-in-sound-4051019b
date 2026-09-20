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
HEAD:       4b0e1cc — "checkpoint: docs(handoff): HF runtime kapatma (P2) açık iş olarak kaydedildi — HANDOFF.md güncellendi (handoff-check green)"
            origin/main ile SENKRON (push edildi 2026-09-20; rev-list 0 0)
            Son commit zinciri (FAZ 0 → 3.2):
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

### UI görsel doğrulaması (kural 10 — kullanıcı onayı bekliyor)
1. **Mood-backdrop'u gerçek tarayıcıda gör:** `npm run dev` → journey'i 8 şarkıyla tamamla → her EraCardReveal'da şarkının mood'uyla eşleşen wallpaper görünmeli (mood yoksa `dreamy`). Kullanıcı "Arayüz Onaylandı" der demez bu görev TAMAMLANDI olur. ⚠️ Mood inference gerçek OpenRouter key ister (`.env`'de `OPENROUTER_API_KEY`).

### FAZ 4 / P2 (sonraki oturumlar)
2. **FAZ 4 — kalan entegrasyon:** backdrop zaten bağlı (FAZ 3.2); kalan: `resolveSceneVisualSpec` orphan (çözüm fonksiyonu hiçbir UI bileşeni tarafından çağrılmıyor) + exactAssetRef tüketimi.
3. **Asset Registry genişlemesi:** kullanıcı yeni `genre × decade × mood` kombinasyonu ürettikçe `SCENE_ASSET_REGISTRY`'ye manuel ekleme (yalnız onayla, No Uncontrolled Refactoring).
4. **P1 kalıntısı:** çoklu-kaynak genre (MusicBrainz/iTunes tekeli kır), artist metadata, musical characteristics.
5. **P2:** MusicUniverseHero görsel zenginliği (istatistik kartları, gradient) placeholder/skeleton ile geri kazan; SongUniverseCard'a gerçek `grounded.timeline.nodes` context'i bağla.
6. **Orphan araç:** `scripts/generate-room-backdrop.mjs` + `package.json` `gen:room` artık üretilen görsel kullanılmıyor (room-backdrop kaldırıldı). Kullanıcı bilinçli olarak şimdilik dokunulmamasını istedi; ayrı faz isterse silinir.

### Güvenlik / house-keeping (yeni: HF kapatma eklendi)
7. **OpenRouter key rotasyonu:** yeni key `.env`/`.env.example`'ta; canlılık (HTTP 200) hâlâ test edilmedi. HEAD `17f9141` eski `settings.json` key'ini git history'de commit'lemiştir — kalıcıdır (purge = force-push, repoda yasak).
8. **HF runtime üretimi kapatma (P2):** `cardArtwork.server.ts` içindeki Imagen→Gemini→HF zincirinin HF ayağı, ANA_YASA §9'da "CURRENT geçici istisna" olarak tanımlı ama kapatılması hiçbir açık iş listesinde yoktu (yalnız betimleyici notlar: §2c satır ~57, §3 satır ~69, §7 satır ~112, §9 satır ~147). Bu madde o boşluğu kapatır: HF ayağının ne zaman/nasıl kaldırılacağı (veya kalıcı hale getirilip getirilmeyeceği) ayrı bir kararla netleştirilmeli — "geçici istisna" süresiz kalmasın. Ölü client anahtar kodu (`VITE_HF_TOKEN`, §7 satır ~112) bu kararla birlikte temizlenebilir.

---

## 6. Sıradaki İş Adımları (Next Steps)

1. **Kullanıcı (acil, kural 10):** `npm run dev` → journey'i 8 şarkıyla bitir → mood-backdrop'u gör → "Arayüz Onaylandı".
2. **Kullanıcı (görsel onay sonrası):** FAZ 4 (SceneRoom'a resolver bağlama) VEYA yeni asset kombinasyonu ekleme — yalnızca onayla, küçük adımlarla.
3. **İstenirse:** orphan `generate-room-backdrop.mjs` + `gen:room` silinmesi.

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