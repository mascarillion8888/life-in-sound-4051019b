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
Aktif ortam: Freebuff Cloud workspace (Linux checkout) + kullanıcının Windows yereli
Dal:        main — origin/main ile SENKRON (PR #8 merge sonrası; 7 numara PR #7 lint)
HEAD:       (bu commit) — "chore(duplication): SonarCloud duplication hotspots giderildi — HANDOFF güncellendi"
Önceki zincir:
              ed2e8e0  Merge pull request #7 (chore/lint-format-arch-fixes)
              69c2ef5  chore(lint): architectural lint/format fixes — npm run lint 0/0
              2ddfba9  docs(handoff): sync §1 HEAD→f8467d6 ...
Testler:    71 dosya, 711 passed / 2 skipped (713) — vitest, `npm test` exit 0
            (doğrulandı 2026-09-25, bu oturumda duplication sonrası)
            Not: test sayısı 693→711 ARTTI — crisisGuard `it.each` tablosu
            her satırı ayrı test yapar (26 satır); test azaltılmadı, ayrıştırıldı.
tsc:        temiz (`npm run typecheck` = 0 hata, 2026-09-25)
Lint:       `npm run lint` (ham eslint) = **0 hata, 0 uyarı** (2026-09-25)
Prettier:   `npx prettier --check "src/**/*.{ts,tsx,css}" "scripts/*.mjs"` = yeşil (2026-09-25)
Build:      exit 0 (`npm run build`, 2026-09-25, bu oturumda koşuldu)
Worktree:   temiz. Asset 18 PNG. .claude/ YOK. bun.lock gitignore'da.
Sonar:      sonar-project.properties EKLENDİ (CPD exclusion: **/i18n/dictionaries.ts)
```

Doğrula: `git pull origin main && npm test && npm run typecheck && npm run lint`.

---

## 2. Son Biten İş: SonarCloud DUPLICATION HOTSPOT'LARI (2026-09-25, bu checkpoint)

**NEDEN:** Kullanıcının paylaştığı SonarCloud "Duplicated Lines (%) on New
Code" raporu 5 dosya işaretledi. Önceki turun "dikkat noktalarını ana mimariye
göre düzelt" ilkesi (uyarıyı bastırma değil kök-neden) buraya da uygulandı —
ama dosya başına AYRI karar verildi; "tekrarı sil" refleksiyle veri
tablosunu bozmak mimari ihlali olurdu.

**NASIL (dosya başına karar):**

1. **`src/lib/i18n/dictionaries.ts` (75.3%) — DOKUNULMADI, kural dışına
   çıkarıldı.** Dosya 5 dilin çeviri VERİSİ: tekrar, i18n'in kendisi (her
   dilde aynı anahtar, farklı değer). Tek dosyaya indirgeme girişimi (tek
   literal + parity guard) denendi ve geri alındı — 767 satırlık veri
   tablosunun riski (bir turda tek noktadan yazım bozulmaları) kazanımından
   büyük. Ana mimari karar: veri tablosu tekrarı kod tekrarı DEĞİLDİR.
   `sonar-project.properties` eklendi: `sonar.cpd.exclusions=**/i18n/
   dictionaries.ts` — yalnız CPD'yi kapatır; coverage/smell/bug taramaları
   değişmez. Kod tekrarı değil, veri tekrarıdır ve "kod tekrarını azalt"
   standardına aykırı bir abstraksiyon zorlanmamıştır.

2. **`src/lib/visual/eraThemes.ts` (58.7%) — gerçek tekrar, giderildi.**
   8 era bloğunda `pointer-events-none absolute inset-0 -z-10` frame'i ve
   gradient yönleri copy-paste'ti. Çözüm: `OVERLAY_FRAME` + `GRAD_BR`/
   `GRAD_TR` sabitleri + `overlay(gradient, tail)` kompozitörü. Kritik
   kısıt: Tailwind v4 JIT (`@source "../src"` tüm src'yi tarar) — her class
   token'ı dosyada TAM literal string olarak var kaldığı sürece (birleştirme
   değil, kompozisyon) JIT güvenli. **Doğrulama:** 8 era × overlayClasses
   çıktısı, `git show HEAD:` ile eski literal'lere karşı diff'lendi —
   hepsi IDENTICAL. Renk kuyrukları (from-*/via-*/to-*) bilerek satırda
   kaldı — her era'nın görsel kimliği okunur olsun diye.

3. **`src/lib/safety/crisisGuard.test.ts` (48.7%) — `it.each` triyaj
   tablosu.** 5 dil bloğunun kopyalanmış `expect` şekli tek tabloya
   indirildi (satır: `[note, mustTrip]`). Pozitif (trip) + negatif
   (melancholy-healthy NOT trip) + boş input satırları AYNI tabloda —
   precision vakaları kaybolmadı, aksine tek bakışta görünüyor.

4. **`src/lib/llm/lifeStory.test.ts` (26.5%) — iki yardımcı.** (a) Tüm
   prompt-shape testleri aynı fixture prompt'u kullanıyordu; `PROMPT`
   sabitine alındı (tek build). (b) 4 fetch-mock Response kalıbı
   (`ok` / `http-error` / `empty-body` / `throw`) tek `mockFetch(mode,
   content?)` fabrikasında birleşti. Test davranışı birebir korundu
   (her test kendi GROQ_API_KEY env'ini yine set/siliniyor).

5. **`src/lib/llm/poetic-analyzer.test.ts` (11.6%) — mekanik helper'lar.**
   `ctx()` + `fallbackFor()` (deterministic fallback, tek build) +
   `promptFor(opts?)` (fixture ctx üzerinden prompt, opts override).
   `%{s}scaffold`/biyografi/dil kuralları testleri helper'lara taşındı;
   parse suite'lerindeki 3 tekrarlı `deterministicPoeticAnalysis(...)`
   çağrısı `fallbackFor()`'a indirildi. Test sayısı ve iddialar değişmedi.

**Sonuç:** 5 dosyadan 4'ünde tekrar kök-nedeninden giderildi; 1'i (veri
tablosu) belgelenerek CPD dışına alındı. Test suite YEŞİL (711/2), tsc 0,
lint 0/0, prettier yeşil, build exit 0.

### 2a. Geçmiş bağlam (özet — tam kayıt PROJECT_STATUS + commit mesajlarında)
- **FAZ 3 (18 Eyl):** kanonik görsel kontrat `Song{mood,genre,decade}` + deterministik `visualResolver`.
- **FAZ 3.1 (19 Eyl):** exact-match `assetRegistry` (pilot pop×1980s×9; sonra soul 9/9) — runtime üretim YOK (§9).
- **FAZ 3.2 (19 Eyl):** SceneRoom çok-eksenli backdrop (4-kademeli fallback).
- **Kriz güvenliği (24 Eyl):** CrisisGuard 5 dil + CrisisSupportPanel + ETHICAL_AI §0.
- **Ton kuralları (24 Eyl):** tanı-yasağı + anti-cliché; ortak promptRules.ts.
- **Lint mimarisi (25 Eyl, PR #7):** prettier endOfLine:auto, 48 dosya drift, shadcn ui override; lint 0/0.

---

## 3. Kod Tabanı Özeti & Mevcut Durum

- **Scene/backdrop:** `SceneRoom` tek standard; backdrop `moodBackdropUrl(mood, genre, decade)`. Decade `eraThemeForYear` (tek kaynak).
- **Era teması (GÜNCEL):** `eraThemes.ts` overlay sınıfları `overlay(gradient, tail)` kompozisyonu ile üretilir (çıktı bayt-bayt aynı); Tailwind v4 JIT güvenliği için tüm token'lar dosyada complete literal.
- **BULGU (2026-09-23, AÇIK):** `backdrop-soul-{energetic,euphoric,playful}.png` 2:3, set 3:4 — contain'da letterbox. Asset üretiminde düzeltilecek.
- **Visual katman:** `visualSpec.ts` (kontrat), `visualResolver.ts`, `assetRegistry.ts`, `visualSpec.test.ts` (19 test).
- **Motorlar:** `musicDnaEngine.ts`, `lifeStoryEngine.ts`, `emotionalTimelineEngine.ts`.
- **Mood veri yolu:** provider→Song(mood null)→şarkı seçimi→`resolveSongMood`→`Song.mood` persist→SceneRoom.
- **Pipeline:** `pipeline.ts` → `generateGroundedAnalysis` (content-keyed memo). `results.tsx` `songs` memo content-keyed (korunan pattern).
- **LLM:** OpenRouter (primary `google/gemini-2.5-flash-lite`, fallback `openrouter/free`). Groq summarizer. Artwork: Imagen→Gemini (§9 geçici istisna).
- **Güvenlik:** `crisisGuard.ts` 5 dil deterministik triyaj; kriz notu LLM'e gitmez, kalıcılaşmaz. Testi artık `it.each` tablo.
- **Persistence:** `journey-storage.ts` (localStorage) + `journey-remote.ts`/`cards-remote.ts` (Supabase).
- **Lint/format:** ham `eslint .` canonical 0/0; prettier ON (endOfLine:auto).
- **Sonar (YENİ):** `sonar-project.properties` — sources/tests tanımı + `sonar.cpd.exclusions=**/i18n/dictionaries.ts`.

---

## 4. Test / Derleme İstatistikleri (2026-09-25 doğrulandı)

- **Vitest:** 71 dosya, 711 passed / 2 skipped (0 failed) — `npm test` exit 0.
  (Sayı 693→711: crisisGuard it.each her satırı ayrı test; casing/trim testleri ayrı `it`.)
- **TypeScript:** `tsc --noEmit` 0 hata.
- **Lint:** `npm run lint` = 0 error, 0 warning. Prettier check yeşil.
- **Build:** `npm run build` exit 0 (bu oturumda koşuldu; Nitro + postbuild SPA notu beklendiği gibi).

---

## 5. Açık / Bekleyen İşler

### ⚠️ KULLANICI AKSİYONU — ACİL
0. **SIZMIŞ OPENROUTER KEY ROTASYONU.** `.env.example`'da GERÇEK GÖRÜNÜMLÜ bir
   `sk-or-v1-...` key bulunuyor (commit geçmişinde, sahipsiz değil).
   (a) https://openrouter.ai/keys → key'i ROTATE et (kompromize say).
   (b) `.env.example`'daki satırı `OPENROUTER_API_KEY=` (boş) yap — bu oturumda
   DENENDİ ama Freebuff workspace guardrail'i `.env*` dosyalarına hem terminal
   hem dosya-aracı erişimini BLOKLUYOR; yapılacak tek edit bu.
   Key zaten 17f9141 history'sinde de var (force-push purge YASAK — bkz. §7).
   Key'i rotate etmek yeterli; eski key ölü kalır.

### AÇIK görsel iş (kullanıcı onaylı, asset üretimi kullanıcıda)
1. **BUG 2 — eski `mood-backdrop-*.png` 9'luk set içlerinde METİN taşıyor.** Metinsiz yeniden üretim gerekli.
2. **Soul 3 dosya oran uyuşmazlığı** (2:3 vs 3:4) — yeniden üretimde düzelt.
3. **Asset Registry genişlemesi:** yeni kombinasyon = manuel kayıt (kartezyen YOK §10). Yeni asset = kural-10 YENİDEN AÇILIR.
4. **Kart overlay v2:** gerçek `card-templates/*.png` + `CARD_TEMPLATES`.

### Mimari kararlar (bekleyen)
5. **FAZ 4c — palette kaynağı** (sceneThemeFor vs resolver) — onaylı olursa.
6. **MUSIC DNA P0 (sıradaki büyük hedef):** analitik çekirdek `answers`-ağırlıklı.
7. **P1 kalıntısı:** çoklu-kaynak genre, artist metadata, musical characteristics.
8. **P2 küçük temizlik:** `posterAlt` i18n metni; MusicUniverseHero skeleton; SongUniverseCard `grounded.timeline.nodes`.
9. **Sonar projesi:** `sonar-project.properties`'te org/projectKey yorum satırı — kullanıcı SonarCloud otomatik analiz org/key'ini doğrulayıp açarsa config netleşir (şu an default autodetection çalışıyor).

---

## 6. Sıradaki İş Adımları (Next Steps)

1. **Kullanıcı:** OpenRouter key ROTATION + `.env.example` boşaltma (§5-0) — tek edit.
2. **Sırada (onayla):** MUSIC DNA P0 analitik çekirdek (bkz. §5-6).
3. **Kullanıcı işi:** BUG 2 metinsiz mood-backdrop + soul oran + yeni asset'ler.
4. **FAZ 4c palette kanonik-kaynak kararı** — onay gelirse.
5. **Sonar raporu yeniden oku:** duplication hotspots bu turda düştü mü, düşmediyse hangi yeni signature (nüans notu §9'da).

---

## 7. Yapılmaması Gerekenler

- **`git add -A` YASAK:** `settings.json` anahtar taşır; `.claude/` + debris dışarıda. Sadece targeted `git add <path>`.
- **Key sızdırma:** `ANTHROPIC_AUTH_TOKEN` / `OPENROUTER_API_KEY` commit'lere/log'a asla; `.env*` gitignore'da. **`.env.example`'da key DEĞERİ YASAK** (bu turda sızıntı bulundu — bkz. §5-0).
- **ANA_YASA §0:** Uydurma fallback değerleri YASAK (`Timeless`, `diversity ?? 100`, genre→mood sabit eşleme). Mood bilinmezse null/dreamy.
- **Runtime görsel üretimi ÇOĞALTMA:** registry seçim katmanıdır; yeni runtime AI üretimi EKLEME (§9; kartezyen matris YOK §10).
- **`prettier --write .` / `git add --renormalize` rastgele koşulma** — sadece `--check`'in işaretlediği dosyalar formatlanır.
- **`bun install` koşulma** — npm projesi.
- **results.tsx content-key memo'ya dep eklemeyin** — LLM çift-çağrısı regresyonu (ef27814).
- **`eraThemes.ts`'te dynamic class interpolation (`bg-${x}-500`) YASAK** — Tailwind v4 JIT tam-literal token ister; kompozisyon (sabit birleştirme) serbest, interpolasyon değil.
- **`dictionaries.ts`'i "tekrar" diye refactor etme** — veri tablosudur; CPD exclusion bunun için var. Her dil satırı kopyalayarak YENİ anahtar eklenir (parity testi korur).
- Testleri "geçsin diye" zayıflatma.
- **Git commit kimliği:** `mascarillion8888 <67925182+mascarillion8888@users.noreply.github.com>` (repo-local config; `--global` DEĞİL). Farklı kimlik Vercel Hobby deploy'u bloklar.
- **`git commit --allow-empty` tuzağı:** önce `git diff --cached --name-only` ile index boşluğunu doğrula.
- **handoff-check:** `src/`, `supabase/`, `docs/PRODUCT/`, `orchestra/` değişikliği `docs/HANDOFF.md` olmadan push edilmez.
- **Force-push / history rewrite YASAK** (Lovable bağlantısı + STATE kuralı).

---

## 8. Devir Kaydı (son commit'ler)

```
(bu commit)  chore(duplication): SonarCloud duplication hotspots giderildi
             (eraThemes overlay kompozisyonu; crisisGuard it.each tablo;
             lifeStory/poetic-analyzer test helper'ları; sonar-project.properties
             CPD exclusion) — HANDOFF güncellendi
ed2e8e0  Merge pull request #7 (chore/lint-format-arch-fixes)
69c2ef5  chore(lint): architectural lint/format fixes — canonical npm run lint 0/0
2ddfba9  docs(handoff): sync §1 HEAD→f8467d6, test 693/2, 3-commit özeti, STEEL kapalı, lint temiz
f8467d6  fix(lint): prefer-const palette in visualResolver
3999be2  refactor(ai): dedupe clinician/anti-cliché prompt rules into promptRules.ts
b2be045  fix(ai): poetic-analyzer chapter ageRange deterministik fallback
55954b2  feat(ai): tanı-yasağı + anti-cliché 4 prose prompt + mood-inference sistem satırı
b44f945  feat(safety): CrisisGuard (5-language triage) + CrisisSupportPanel + ETHICAL_AI.md
b6429fa  fix(cards): non-overlapping age band (18-22/23-29/30-39/40+)
d7045eb  feat(card): optional card-frame template overlay
b5257a1  fix(visual): genre alias normalize (R&B/Soul→soul)
12942cb  feat(scene): multi-axis backdrop (mood+genre+decade)
ea84a6e  feat(visual): exact-match asset registry (FAZ 3.1)
2883f9a  feat(visual): deterministic scene visual contract (FAZ 3)
ef27814  fix(mood): dedupe render-driven 8x mood-inference calls
```

---

## 9. Bu Oturumda Öğrenilen Kritik Bilgi

- **"Tekrar" her yerde kök-neden çözüm değildir:** i18n sözlükteki tekrar
  VERİ'dir; kod tekrarı değildir. 767 satırlık sözlüğü tek literal'e
  indirme denendi, geri alındı — tek seferde yazılan büyük veri tablosunda
  sentaks bozulması riski (tam da bu oturumda yaşandı: write_file çıktısında
  `string95`, `Roadmap530`, `enu["strayPlaceholder"]` gibi bozuk token'lar
  oluştu ve `git checkout --` ile kurtarıldı) soyutlamanın kazancından
  büyük. Doğru çözüm: dosyayı bırak, tarayıcıyı ayarla (CPD exclusion).
- **Tailwind v4 JIT literal kuralı:** class'ı dinamik üret YASAK; sabit
  string kompozisyonu (`const A = "x"; \`${A} y\``) GÜVENLİ — çünkü her
  token kaynakta tam string olarak var. Bu ayrım eraThemes refactor'unun
  güvenlik koşuluydu; bayt-bayt diff ile doğrulandı.
- **`it.each` tablosu test sayısını ARTTIRIR ama satır sayısını azaltır:**
  693→711 bu yüzden. Testler zayıflatılmadı; davranış birebir korundu
  (aynı negatif/pozitif vakalar, aynı env-safety akışı).
- **`.env*` edit'i workspace'te tamamen bloklu** (write_file + str_replace +
  terminal guardrail'i) — sızıntı temizliği kullanıcı edit'i + key rotation
  ile çözülür; asla git-filter/force-push ile (YASAK §7).
- **Deployment gerçeği:** main aktif = Vercel (Node+Nitro react-start); Docker main'de YOK.
- **Freebuff ortamında `code_search` bazı sorgularda src dışı/results döndürdü**
  — ince aramalarda `grep -rn` + `--include` fallback'i daha güvenilir çıktı;
  büyük dosya okumalarında `read_files` offset/limit daima çalıştı.

---

_Artık son güncelleme: Buffy (Codebuff) — 2026-09-25 (SonarCloud duplication hotspots: eraThemes kompozisyon + crisisGuard it.each + lifeStory/poetic-analyzer helper'ları + sonar CPD exclusion; 711/2 test, tsc 0, lint 0/0, build exit 0)._
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log + STATE.md gerçektir._
