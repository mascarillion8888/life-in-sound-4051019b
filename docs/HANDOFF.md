# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**
>
> Yerel klonunuz `git pull` ile güncellenmemiş olabilir — her oturum
> başında **önce `git fetch` + `git pull origin main`** yapın, sonra
> commit'lere güvenin (bkz. §5).

---

## 1. Doğrulanabilir gerçek

```
Aktif ortam: Windows yerel (C:\Projects\soundtrack-ai) — Claude Code
Dal:        main
HEAD:       eee319d — "feat: migrate mood/poetic analyzer from Gemini SDK to
            OpenRouter (primary+fallback)" — origin/main ile eşit (0 ahead / 0 behind)
Testler:    631 passed / 2 skipped (633) — 66 dosya (65 passed, 1 skipped)
            vitest v4.1.10, `npm test` exit 0 (2026-09-13, akşam doğrulaması)
tsc:        temiz (`npm run typecheck` = 0 hata)
Lint:       kod temiz — `npx eslint src scripts --rule 'prettier/prettier: off'`
            = 0 hata, 8 uyarı (react-refresh, pre-existing: ui/* + LanguageContext).
            ⚠️ Ham `npm run lint` CRLF yığını döndürür (32k prettier hatası) —
            çevresel: çalışma kopyası Windows CRLF (core.autocrlf=true), repo LF;
            .gitattributes yalnız src/routeTree.gen.ts'yi normalize eder. Ayrıca
            `eslint .` untracked debri (iç içe soundtrack-ai/ klonu, .next/, app/)
            yüzünden asılıyor.
Build:      temiz (`npm run build` exit 0, 2026-09-13 — Vite 3.27s + Nitro üretimi)
```

Doğrula: `git pull origin main && npm test && npm run typecheck && npm run lint`.

---

## 2. Son Biten İş: Mood Inference + Music DNA P0 + OpenRouter Geçişi (TAM, 13 Eylül)

Bugünün işi uzak repo'da (`origin/main`) 4 commit olarak duruyordu; yerel klon
`git pull origin main` ile bunlara fast-forward edildi:

1. **`b42e605` — merge: dev/next Universe Hero + Song Universe Card + genre-aware
   Music DNA main'e entegre edildi.**
   - NEDEN: `origin/dev/next`'teki gerçek-grounded UI (MusicUniverseHero,
     SongUniverseCard, genre-aware Music DNA) main'e taşınıyordu.
   - NASIL: Çakışma çözümleri ANA_YASA §0'a göre — uydurma fallback değerleri
     (`Timeless`, `Eclectic Explorer`, `diversity ?? 100`, `stageName='Life
     Stage'`, `vibeLabel='Grounded Reflection'`) HEAD tarafında reddedildi,
     `origin/dev/next` tarafı korundu. (Detay: STATE.md → NOTLAR, 13 Eylül)

2. **`3a97968` — feat(mood): moodInference pipeline'a entegre edildi + musicDnaEngine
   mood-coverage gate'i (P1).**
   - NEDEN: Song.mood değeri her zaman ayrı, izlenebilir bir inference
     katmanından gelsin (STATE.md → KARARLAR, 13 Eylül — §9 gerilimi çözümü).
   - NASIL: `src/lib/ai/moodInference.ts` (+ `.server.ts`, `.test.ts`) — LLM
     tabanlı, temperature 0, 9 kapalı mood seti, bilinmeyende `null` (asla
     serbest metin/uydurma). `generateGroundedAnalysis`'e entegre. `musicDnaEngine`
     → `deriveDominantVibe`'da `MIN_MOOD_COVERAGE_FOR_LABEL=60` gate'i:
     moodCoverage ≥ 60 → `"{Genre} · {Mood}"` (ör. "Rock · Melancholic"), aksi
     halde genre-only / diversity heuristic.

3. **`95a9d9c` — docs: P0/P1 durumu güncellendi + ANA_YASA/CLAUDE.md kopya
   senkronizasyonu.**
   - NASIL: Kök `ANA_YASA.md` ve `docs/CLAUDE.md` kopyaları silindi (tek kaynak
     kuralı); `TASKS.md` oluşturuldu; STATE.md NOTLAR/KARARLAR güncellendi.

4. **`eee319d` — feat: mood/poetic analyzer Gemini SDK → OpenRouter
   (primary+fallback).**
   - NEDEN: Tek Gemini modeline bağlılık + kredi sınırları; OpenRouter tek
     anahtarla çoklu model + fallback zinciri sağlıyor.
   - NASIL: `src/lib/openrouter.server.ts` — `callOpenRouter`: primary
     `google/gemini-2.5-flash-lite`, fallback `openrouter/free`; HTTP 429/5xx'te
     tek retry, istemci hatalarında (400/401) throw; `@google/genai` kaldırıldı.
     Key server-only (`OPENROUTER_API_KEY`, asla `VITE_` prefix'i değil).
     `generateAnalysis.server.ts` (mood + poetic) bu köprüye geçirildi.

**Değişen modüller:** `src/lib/openrouter.server.ts` (yeni),
`src/lib/ai/moodInference.{ts,server.ts,test.ts}` (yeni),
`src/lib/ai/pipeline.ts`, `src/engine/musicDnaEngine.ts` (+test),
`src/lib/llm/generateAnalysis.server.ts`, `src/routes/results.tsx`,
`src/components/results/*`, `src/types/musicDna.ts`, `.env.example`,
`TASKS.md`, `STATE.md`.

---

## 3. Kod Tabanı Özeti & Mevcut Durum

- **Motorlar:** `src/engine/musicDnaEngine.ts` (P0: era dağılımı, çeşitlilik,
  vibe — artık mood-aware gate'li), `lifeStoryEngine.ts`, `emotionalTimelineEngine.ts`.
- **Pipeline:** `src/lib/ai/pipeline.ts` → `generateGroundedAnalysis(songs, contexts)`
  tek merkezden tüm motorları çağırır; `results.tsx`'te `useMemo` ile deterministik.
- **LLM katmanı:** `callOpenRouter` (OpenRouter köprüsü) → mood inference +
  poetic analyzer (`generateAnalysis.server.ts`). Key server-only.
- **Results sayfası:** `MusicUniverseHero` (grounded DNA kimlik kartı; vibe chip'i
  `"{Genre} · {Mood}"` gösterebilir), `SongUniverseCard` galerisi, `AIPersonalityCard`
  (Recommended Genres paneli gerçek topGenres'ten besleniyor).
- **Cache & Storage:** `src/lib/cache/supabaseCache.ts` singleton `dbCache` (30s TTL),
  `cards-remote.ts` / `journey-remote.ts`, `useCardLore` + `generateCard.server.ts`.
- **Poster & Gallery:** `MasterPosterCanvas`, `SharePosterDialog`, `CardGallery`
  (grounded vibe badge), `GothicArtSkeleton` fonksiyonel.

---

## 4. Test ve Derleme İstatistikleri

- **Vitest:** 66 dosya, 631 passed / 2 skipped (0 failed) — `npm test` (2026-09-13 akşam).
- **TypeScript:** `tsc --noEmit` 0 hata.
- **Lint / Build:** bu oturum sonunda değerlendirilecek (§1).

---

## 5. Açık / Bekleyen İşler

### P0 — GÜVENLİK (kullanıcı eylemi gerekli)
1. **Eski OpenRouter key'i revoke et** — eski key chat'te ifşa oldu. Tespit
   durumu: repo `git history` **temiz** (0 commit `sk-or-v1` geçiyor); disk'teki
   tek key yerel `settings.json`'da (untracked — Claude Code'u OpenRouter
   üzerinden çalıştıran harness config). İşlem: https://openrouter.ai/settings/keys →
   ifşa olan key'i DELETE; yeni key'i kullan. **DİKKAT:** eğer iptal edeceğin key
   `settings.json`'daki `ANTHROPIC_AUTH_TOKEN` ise, önce yeni key'i o dosyaya
   yaz, sonra iptal et — yoksa Claude Code sonraki açılışta bağlanamaz.

### UI doğrulaması (kullanıcı eylemi — STATE.md Görsel Doğrulama Kuralı madde 10)
2. **Mood-aware vibe etiketini ("Rock · Melancholic") gerçek tarayıcıda doğrula:**
   - Kök dizinde `.env` oluştur (`.env.example` kopyala) ve
     `OPENROUTER_API_KEY=<yeni-key>` doldur. **Key yoksa mood inference `null`
     döner ve etiket genre-only görünür** — bu beklenen davranıştır.
   - `npm run dev` → http://localhost:3000 → journey'i 8 soru şarkıyla tamamla →
     sonuç sayfasında MusicUniverseHero'daki vibe chip'inde `{Genre} · {Mood}`.
   - Kullanıcı ekranda görüp "Arayüz Onaylandı" demeden bu görev TAMAMLANDI sayılmaz.

### Küçük karar
3. **scripts/ kalıntısı:** `.gitignore` `scripts/test-mood-live.ts` +
   `scripts/test-openrouter-live.ts` giriyor ama **dosyalar disk'te YOK** (bu
   klonda) — silinecek bir şey yok; gitignore satırları dokümantasyon olarak kalsın.

### P1 / P2 (sonraki oturumlar)
4. **P1 kalıntısı:** çoklu-kaynak genre (iTunes tekelini kır — MusicBrainz/ek
   API), artist metadata, musical characteristics — P1'in kalan metadata kısmı.
5. **P2:** MusicUniverseHero görsel zenginliği (istatistik kartları, gradient)
   placeholder/skeleton ile geri kazan; SongUniverseCard'a gerçek
   `grounded.timeline.nodes` context'i bağla (TASKS.md'de kayıtlı).

---

## 6. Sıradaki İş Adımları (Next Steps)

1. **Kullanıcı:** Eski OpenRouter key'i iptal + yeni key'i `settings.json` /
   `.env`'e işle. (→ P0 kapanır)
2. **Kullanıcı:** `npm run dev` ile vibe etiketini görsel doğrula → "Arayüz
   Onaylandı" derse görev STATE.md/TASKS.md'de kapanır.
3. **Sonraki oturum (resmi):** HANDOFF §5'teki P1 kalıntısı (çoklu-kaynak
   metadata) veya P2 görsel iyileştirmeler üzerinden devam.

---

## 7. Yapılmaması Gerekenler

- **`git add -A` / commit'e ters git KESİNLİKLE YASAK:** Kök dizinde untracked
  kritik kalıntılar var — `settings.json` (canlı API key içerir!), iç içe
  `soundtrack-ai/` klonu (kendi `.git`'i var — aynı remote'a ayrı tarihçe),
  `app/` + Next.js config artıkları, `cmp-*.txt` / `full-diff.txt` / `*log.txt`
  tarama kalıntıları. Sadece **belirli dosyalar** `git add` edilir.
- **ANA_YASA §0 ihlali:** Uydurma fallback değerleri geri getirme (`Timeless`,
  `Eclectic Explorer` sabitleri, `diversity ?? 100` vb.) — gerçek veri yokken
  placeholder/skeleton göster (P2 görevi burada).
- İç içe `soundtrack-ai/` repo'suna yazma / oradan merge etme — tekilleştirilmeli
   (kullanıcı kararıyla silinmeli/yeni yere taşınmalı).
- Kök `ANA_YASA.md` / `docs/CLAUDE.md` kopyası açma — tek kaynak kuralı.
- Testleri "geçsin diye" değiştirme / zayıflatma; mood etiketini sabit değerle
   uydurma.
- **Lint/çizgi sonu tuzağı:** `eslint .`'yi koşma (untracked debri yüzünden
   asılıyor); `prettier --write .` veya `git add --renormalize`'ı rastgele çalıştırma
   (çalışma kopyası CRLF, repo LF — tüm ağacı değiştiren dev bir diff üretir).
   Lint için: `npx eslint src scripts --rule 'prettier/prettier: off'`.

---

## 8. Devir Kaydı (son commit'ler)

```
eee319d feat: migrate mood/poetic analyzer from Gemini SDK to OpenRouter (primary+fallback)
95a9d9c docs: P0/P1 durumu güncellendi (Music DNA mood-aware, mood inference tamamlandı) + ANA_YASA/CLAUDE.md kopya senkronizasyonu
3a97968 feat(mood): moodInference pipeline'a entegre edildi + musicDnaEngine mood-coverage gate'i (P1)
b42e605 merge: dev/next Universe Hero + Song Universe Card + genre-aware Music DNA main'e entegre edildi
75a1589 checkpoint: fix PosterModel.visual literal drift in test fixtures and journey.tsx fallback (pull öncesi yerel HEAD)
```

---

## 9. Bu Oturumda Öğrenilen Kritik Bilgi

- **Yerel klon yanıltabilir:** Bugünün 4 commit'i uzak repo'da zaten vardı;
  yerel klon (75a1589) eski olduğu için "yok" gibi görünüyordu. **Kural: bir
  işin "yokluğunu" ilan etmeden önce daima `git fetch` + `git pull origin main`**
  yap. Bu oturumun ana dersi budur.
- **Vibe label'ı `OPENROUTER_API_KEY` ister:** Runtime'da mood inference server
  tarafında key olmadan `null` döner → etiket genre-only'e düşer. Tasarım gereği
  (uydurma yok), test ederken `.env`'e key koymayı unutma.
- **`settings.json` = Claude Code harness config:** OpenAI-compatible OpenRouter
  endpoint üzerinden `~deepseek/deepseek-v4-flash-latest` kullanıyor. Bu SİZİN
  çalışma mekanizmanız — iptal/rotasyon yaparken önce settings.json güncellenmeli.