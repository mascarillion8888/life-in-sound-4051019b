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
HEAD:       759ab29 — "docs(scene): Visual Resolver contract type on moodBackdrop + Phase-4 deferral note (Faz 2)"
            origin/main ile SENKRON (push edildi 2026-09-17; rev-list 0 0)
            Son 3 commit (bu oturum, ayrı fazlar):
              112d70f  Faz 0 — mood-backdrop tek görsel standart; genre room-backdrop + poster-preview silindi;
                        SceneRoom mood-only + Dreamy fallback; poster placeholder'ları dreamy'ye bağlandı; build/test kırığı giderildi
              5c8707b  Faz 1 — journey'de şarkı seçilince inferMood → Song.mood persist (localStorage + mevcut remote yol);
                        enrichSongMood.ts (session-dedup); SceneRoom gerçek mood-backdrop gösterir
              759ab29  Faz 2 — moodBackdrop.ts'e VisualSpecInput/VisualResolution contract type (era/genre/culture atıl);
                        STATE.md Phase-4 erteleme notu
Testler:    68 dosya, 646 passed / 2 skipped (648) — vitest v4.1.11, `npm test` exit 0 (2026-09-17)
tsc:        temiz (`npm run typecheck` = 0 hata)
Lint:       0 hata, 9 uyarı (baseline: react-refresh ui/* + LanguageContext + results.tsx:344 exhaustive-deps;
            yeni uyarı YOK). `npx eslint src scripts --rule 'prettier/prettier: off'`.
Build:      `npm run build` exit 0 (Vercel SPA path; Nitro .output). Doğrulandı 2026-09-17.
Worktree:   temiz — yalnızca `src/routeTree.gen.ts` "M" (CRLF stat artifact, İÇERİK değişmedi, index==HEAD hash)
            + `.claude/` untracked (Claude Code yerel config; bilerek commit'lenmedi).
```

Doğrula: `git pull origin main && npm test && npm run typecheck && npx eslint src scripts --rule 'prettier/prettier: off'`.

---

## 2. Son Biten İş: 3 faz (16-17 Eylül) — mood-render veri yolu + backdrop standardı

### 2a. Faz 0 (commit `112d70f`) — P0 build/test kırığı
- **NEDEN:** 10 asset silinmişti (9 `room-backdrop-*.png` + `poster-preview.jpg`) ama kod hâlâ import ediyordu → build `ENOENT room-backdrop-jazz.png` (exit 1) ve 3 test dosyası `Failed to resolve import` (EraCardReveal / PosterLightbox / SceneRoom).
- **NASIL:** Kullanıcı kararı — genre room-backdrop kavramı KALKTI, `mood-backdrop-*.png` (9×1920x1080) TEK görsel standart. `SceneRoom.tsx`: 7 static import + genre→görsel `BACKDROPS` objesi kaldırıldı; artık SADECE `moodBackdropUrl(song.mood)`, mood yoksa nötr `Dreamy` fallback. Genre görseli seçmiyor (yalnızca UI metni / palet alt tonu). `PreviewSection` / `PosterLightbox` / `results.tsx`: poster-preview → `mood-backdrop-dreamy.png` placeholder (3'ü de gerçek placeholder gerektiriyordu). `SceneRoom.test.tsx` yeni mood-backdrop davranışını test ediyor. Silinen 10 dosya resmen stage-edildi (targeted `git add`, `git add -A` DEĞİL — HANDOFF §7).
- **Sonuç:** build exit 0, test 66 dosya / 640 pass, tsc 0, lint 9.

### 2b. Faz 1 (commit `5c8707b`) — mood verisinin persist edilmesi
- **NEDEN:** Mood inference yalnızca results'ta (pipeline, internal kopya) yaşıyordu; journey'deki Song.mood her zaman null'dı → SceneRoom mood-backdrop'u etkisizdi (STATE.md'nin açık işi).
- **NASIL:** `src/lib/ai/enrichSongMood.ts` (yeni, client-safe): `resolveSongMood()` şarkıda mood yoksa `inferMood` (server fn) çağırıp `Song.mood`'a yazar; **session başına kez** dedupe (per-track guard) — results'taki "8× storm" aynı ruhla önlendi; bilinmiyorsa null (asla uydurmaz). `journey.tsx`: şarkı seçilince arka planda mood'u infer edip `Song.mood`'a yazan effect; mevcut `saveJourney`/`saveRemoteJourney` persist zinciri korur.
- **not:** `normalizeSong` (localStorage) ve `toProgress` (Supabase) ZATEN genre+mood+releaseYear+previewUrl round-trip ediyordu (`SONG_FIELDS` + `COERCE_TO_PERSISTED`; testler L239/L273/L215/L284). Önceki forensic notunun aksine bugüne kadar kodda eksik yoktu.
- **Persistence kararı (kullanıcı onayı):** localStorage ağırlıklı tasarım; mood, mevcut `saveRemoteJourney`'in yazdığı `songs` objesinin parçası olduğu için auth'luysa remote'a da gider — kullanıcı bunu OK verdi, ayrı kod eklenmedi.
- **Sonuç:** 68 dosya / 646 pass (enrichSongMood.test dahil), build exit 0, tsc 0, lint 9.

### 2c. Faz 2 (commit `759ab29`) — P2 hafif hazırlık
- **NEDEN:** Gelecekteki Visual Resolver / Asset Registry geçişini kolaylaştırmak (Phase 4), bugünkü davranışı değiştirmeden.
- **NASIL:** `moodBackdrop.ts`'e `VisualSpecInput` / `VisualResolution` contract type'ları (JSDoc; `mood` tek kullanılan eksen; `era`/`genre`/`culture` optional/atıl). `STATE.md`'ye Phase-4 erteleme + genişleme sırası (Asset Factory §15: 1980s×Rock, 1980s×Soul/Funk/Disco) notu. Kod davranışı DEĞİŞMEDİ.

---

## 3. Kod Tabanı Özeti & Mevcut Durum

- **Scene/backdrop:** `SceneRoom` = tek mood-wallpaper görsel standardı (moodBackdrop glob, Dreamy fallback). Genre IMAGE seçmez.
- **Motorlar:** `musicDnaEngine.ts` (mood-coverage gate'li vibe), `lifeStoryEngine.ts`, `emotionalTimelineEngine.ts`.
- **Mood veri yolu:** provider→Song(mood null)→journey şarkı seçimi→`resolveSongMood`(inferMood)→`Song.mood` persist→SceneRoom mood-backdrop. Results'ta pipeline ayrıca infer edip aggregate DNA verir (deterministik, memo'lu).
- **Pipeline:** `src/lib/ai/pipeline.ts` → `generateGroundedAnalysis` (content-keyed memo + contextText fingerprint; results'taki 8× dedupe korunur).
- **LLM:** OpenRouter köprüsü (`openrouter.server.ts`), primary `google/gemini-2.5-flash-lite`, fallback `openrouter/free`; key server-only. Groq summarizer `qwen/qwen3.6-27b`. Artwork: Imagen→Gemini→HF zinciri (runtime, ANA_YASA §9 geçici istisna).
- **Persistence:** `journey-storage.ts` (localStorage) + `journey-remote.ts`/`cards-remote.ts` (Supabase), `cache/supabaseCache.ts` (30s TTL).
- **Landing/results:** MasterPosterCanvas, PosterLightbox (dreamy placeholder), MusicUniverseHero, SongUniverseCard, CardGallery.

---

## 4. Test / Derleme İstatistikleri (2026-09-17 doğrulandı)

- **Vitest:** 68 dosya, 646 passed / 2 skipped (0 failed) — `npm test`.
- **TypeScript:** `tsc --noEmit` 0 hata.
- **Lint:** `npx eslint src scripts --rule 'prettier/prettier: off'` = 0 hata, 9 uyarı.
- **Build:** `npm run build` exit 0.

---

## 5. Açık / Bekleyen İşler

### UI görsel doğrulaması (kural 10 — kullanıcı onayı bekliyor)
1. **Mood-backdrop'u gerçek tarayıcıda gör:** `npm run dev` → journey'i 8 şarkıyla tamamla → her EraCardReveal'da şarkının mood'uyla eşleşen wallpaper görünmeli (mood yoksa `dreamy`). Kullanıcı "Arayüz Onaylandı" der demez bu görev TAMAMLANDI olur. ⚠️ Mood inference gerçek OpenRouter key ister (`.env`'de `OPENROUTER_API_KEY`).

### P1 / P2 (sonraki oturumlar)
2. **P1 kalıntısı:** çoklu-kaynak genre (MusicBrainz/iTunes tekeli kır), artist metadata, musical characteristics.
3. **P2:** MusicUniverseHero görsel zenginliği (istatistik kartları, gradient) placeholder/skeleton ile geri kazan; SongUniverseCard'a gerçek `grounded.timeline.nodes` context'i bağla.
4. **Orphan araç:** `scripts/generate-room-backdrop.mjs` + `package.json` `gen:room` artık üretilen görsel kullanılmıyor (room-backdrop kaldırıldı). Kullanıcı bilinçli olarak şimdilik dokunulmamasını istedi; ayrı bir faz isterse silinir.

### Güvenlik / house-keeping (kayıtlı, yeni yok)
5. **OpenRouter key rotasyonu** (önceki oturumdan): yeni key `.env`/`.env.example`'ta; canlılık (HTTP 200) hâlâ test edilmedi. HEAD `17f9141` eski `settings.json` key'ini git history'de commit'lemiştir — kalıcıdır (purge = force-push, repoda yasak).

---

## 6. Sıradaki İş Adımları (Next Steps)

1. **Kullanıcı (acil, kural 10):** `npm run dev` → journey'i 8 şarkıyla bitir → mood-backdrop'u gör → "Arayüz Onaylandı". (Artık Santranç: 3 faz da push edildi, main senkron; bekleyen tek yazma onayı/görsel onay bu.)
2. **Kullanıcı (görsel onay sonrası):** P1 çoklu-kaynak genre VEYA Phase 2/4 hazırlıkları (Visual Resolver / Asset Registry) — yalnızca onayla, `No Uncontrolled Refactoring` kapsamında küçük adımlarla.
3. **İstenirse:** orphan `generate-room-backdrop.mjs` + `gen:room` silinmesi.

---

## 7. Yapılmaması Gerekenler

- **`git add -A` / commit'e ters git KESİNLİKLE YASAK:** `settings.json` anahtar taşır; `.claude/` + routeTree stat no-op + olası debris süpürülür. Sadece **belirli dosyalar/pat'lar** `git add` edilir. (16-17 Eylül'de bu fazlar kullanıcıya raporlanarak targeted add kullanıldı.)
- **Key sızdırma:** `ANTHROPIC_AUTH_TOKEN` / `OPENROUTER_API_KEY`'i yeni commit'lere/log'a asla; `.env` gitignore'da kalır. Ölü client anahtar kodu (gemini.ts `VITE_GEMINI_API_KEY`, generateGothicArt `VITE_HF_TOKEN`) runtime'da çağrılmıyor — kaldırmak/belgelemek ayrı bir P2.
- **ANA_YASA §0 ihlali:** Uydurma fallback değerleri geri getirme (`Timeless`, `Eclectic Explorer`, `diversity ?? 100`, genre→mood sabit eşleme). Mood bilinmezse null/dreamy.
- İç içe `soundtrack-ai/` repo'suna yazma / oradan merge etme.
- **Lint/çizgi sonu tuzağı:** ham `eslint .`'yi koşma (untracked debri asıyor / CRLF yığını); `prettier --write .` / `git add --renormalize`'ı rastgele koşma.
- Testleri "geçsin diye" değiştirme/zayıflatma.
- **Git commit kimliği:** Bu repoda atılan commit'ler `mascarillion8888 <67925182+mascarillion8888@users.noreply.github.com>` kimliğiyle olmalı (repo-local `git config user.name/email`; `--global` DEĞİL). Farklı kimlik (örn. `JellyBeanMaster`) Vercel Hobby plan deployment'ını "commit author did not have contributing access" diye bloklar (17 Eylül 2026).
- **`git commit --allow-empty` tuzağı:** Aslında boş değildir — index'te staged dosya varsa ONLARI da commit'ler. Boş commit (redeploy tetikleyicisi) atmadan ÖNCE `git status` / `git diff --cached --name-only` ile index'in boş olduğunu doğrula.

---

## 8. Devir Kaydı (son commit'ler)

```
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

- **Mood FREEZE tasarım kararı (STATE.md'de kayıtlı):** `resolveSongMood` hesapladığı mood'u `Song.mood`'a yazar ve bu değer persist edilir; bir daha yeniden hesaplanmaz (belge/tasarım kararı — kod değişikliği yok). Model değişirse manuel invalidation gerekir (TTL/version yok). Yeniden infer ancak o şarkı değiştirilirse (yeni key) veya journey silinirse.
- **`git add -A` tuzağı düştü:** Bu fazlarda silinen asset'leri `git add -A` yerine targeted path'lerle stage'ledim — `.claude/` ve `routeTree.gen.ts` (içerik yok) dışarıda kaldı. HANDOFF §7 kuralı geçerli.
- **Build/test asset kırığı:** Statik `import ... from "@/assets/x.png"` eksik dosyada Vite build'i `ENOENT` ile patlatır VE vitest import'larını transform'da kırar. Glob (`import.meta.glob`) bu hatayı vermez — moodBackdrop bunun için glob kullanıyor.
- **`inferMood` client-safe:** `src/lib/ai/moodInference.ts` ince sarmalayıcı → `moodInference.server.ts`'teki `createServerFn` (TanStack Start server fn); key server-only. Journey'den doğrudan çağrılabilir.
- **Deployment gerçeği (kalıcı):** main aktif = Vercel (Node+Nitro react-start). Docker yalnızca `remotes/origin/migration/node-docker-v1`'de, main'de yok. "Node+Nitro+Docker" STATE üst satırı VİZYON.
- **ANA_YASA §9 (kalıcı):** cardArtwork runtime üretimi (Imagen→Gemini→HF) = CURRENT geçici istisna; hedef = Visual AI sonrası runtime'da yeni üretim YOK, yalnızca onaylı Asset Registry'den deterministik seçim (Phase 4).

---

_Artık son güncelleme: Hermes — 2026-09-17 (3 faz commit'i push edildi; main senkron; test 646/2, tsc 0, build exit 0, lint 9)._
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log + STATE.md gerçektir._