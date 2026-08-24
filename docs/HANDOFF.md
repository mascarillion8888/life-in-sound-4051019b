# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      3b3a720 (origin/main ile senkron) + BU OTURUMUN COMMIT'SİZ
           DEĞİŞİKLİKLERİ çalışma ağacında (kullanıcı onayı bekleniyor;
           commit/push YAPILMADI)
Testler:   298/298 geçti (25 dosya; 292'den +6: 1 i18n no-fallback testi,
           4 buildEntryInsightPrompt language testi [yeni dosya
           generateAnalysis.server.test.ts], 1 LifeFeedSection language
           passthrough testi)
tsc:       temiz (`npx tsc --noEmit` = 0 hata)
Build:     `npm run build` = 0 hata (Nitro + postbuild-vercel-spa OK)
Lint:      `npm run lint` = 0 HATA, repo geneli YEŞİL (exit 0). Kalan
           9 react-refresh uyarısı (ui/* shadcn + PosterCanvas.tsx +
           LanguageContext.tsx) pre-existing, kabul edilebilir.
           ÖNCEKİ PRETTIER BORCU KAPANDI: data.ts, spotify.server.test.ts
           + 6 dosya daha (verify-no-server-secrets.mjs, Results.tsx,
           SongPicker.tsx, Waveform.tsx, keep-alive.ts, server.ts)
           prettier --write ile formatlandı — saf formatlama, semantik
           değişiklik yok, testler onaylıyor.
i18n:      5 dil (en/tr/es/de/fr). quizCard + poster.canvas.lifeCards
           artık es/de/fr'de GERÇEK ÇEVİRİ (önceki "English-first bilinçli
           bırakıldı" kararı kullanıcı göreviyle geçersiz kılındı):
           es Intensidad/TARJETAS DE VIDA, de Intensität/LEBENSKARTEN,
           fr Intensité/CARTES DE VIE. Key-parity + yeni no-fallback
           testi yeşil.
Gemini:    `GEMINI_API_KEY` server-only; prose aktif dilde üretiliyor.
           YENİ: `buildEntryInsightPrompt` artık `language?: Language`
           alıyor (default en) — kullanıcı prompt'unda kural 3 +
           system prompt'ta hedef dil takviyesi; Life Feed insight'ı
           artık aktif UI dilinde yazılıyor.
Spotify:   `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` server-only (NO VITE_);
           dropdown Spotify primary → iTunes fallback → serbest-metin
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — i18n tamamlama + dinamik Gemini dili + repo prettier temizliği (TAM, COMMIT BEKLİYOR)

Kullanıcı görevi üç parçalıydı; üçü de tamamlandı, gate'ler yeşil:

1. **es/de/fr tam çeviri (`src/lib/i18n/dictionaries.ts`):** `quizCard`
   bloğu (intensityLabel, playPreviewAria, mutePreviewAria,
   previewUnavailableAria) ve `poster.canvas.lifeCards` üç dilde de artık
   gerçek çeviri — İngilizce fallback kalmadı. `i18n.test.tsx`'e yeni
   test: "quiz card and life cards labels leave no English fallback gaps"
   (footerQuote testinin deseni; her non-en dilde quizCard değerlerinin
   hiçbiri İngilizce değere eşit olamaz + lifeCards farklı olmalı).
2. **Dinamik Gemini prompt dili (`src/lib/llm/generateAnalysis.server.ts`
   + `src/components/feed/LifeFeedSection.tsx`):**
   - `GenerateEntryInsightInput.language?: Language` eklendi;
     `buildEntryInsightPrompt` `LANGUAGE_NAMES[language ?? "en"]` ile
     kural 3'te hedef dili bildiriyor ("only the song title and artist
     name stay in their original form").
   - `generateEntryInsight` handler'ının systemPrompt'u da hedef dili
     içeriyor (çift katman: user prompt + system prompt).
   - `EntryInsightFetcher` input'una `language: Language` eklendi;
     `LifeFeedSection` `useLanguage()` ile aktif dili okuyup fetcher'a
     geçiriyor. Provider'sız render'da `useLanguage` en'e düşer (mevcut
     fallback davranışı) — testler etkilenmedi.
   - Yeni test dosyası `src/lib/llm/generateAnalysis.server.test.ts`
     (server modülünü import eder ama ağ çağrısı yok — saf prompt
     string testi). LifeFeedSection.test.tsx'e LanguageProvider'lı
     passthrough testi eklendi (localStorage "de" → fetcher language:"de").
3. **Prettier borcu kapatıldı (repo geneli):** `npx prettier --write` 8
   dosyada; `npm run lint` artık 0 hata. NOT: önceki oturumun "eslint
   --fix'i sadece değişen dosyalarda çalıştır" kuralı bu görevde kullanıcı
   talimatıyla ("Ensure npm run lint passes cleanly across the entire
   repository") bilinçli olarak aşıldı — formatlama-only drift kabul edildi.

**Gate'ler:** tsc 0 hata, `npm test` 298/298 (25 dosya), `npm run lint`
exit 0 (0 hata, 9 pre-existing uyarı), `npm run build` temiz.

**Bilerek kapsam dışı:** `deterministicEntryInsight` şablonları hâlâ
İngilizce-only (anında fallback satırı; görev yalnızca Gemini prompt'unu
kapsıyordu). `feed/` bileşenlerinin Türkçe hard-coded string'leri sözlüğe
bağlanmadı. Life Story prompt'ları / GROUNDING_RULES / `buildLifeStoryPrompt`
dokunulmadı (kullanıcı kuralı #2). Companion/memory sistemi geri getirilmedi.

## 2a. Önceki iş — iTunes hi-res artwork + MTG Life Cards (TAM, push'lu, 2b3c8db)

- iTunes `artworkUrl100` → `600x600` upgrade (`highResArtworkUrl`); 300 ms
  debounce'lu non-blocking doğrulama altyapısı zaten vardı, değişmedi.
- MTG-Style Dynamic Life Cards + Master Poster + Audio Preview (e0b15dd):
  8 era kartı 4×2 grid, `drawHarmonizedArtwork` canvas shader, singleton
  `useAudioPreview` (fade 900/450 ms, volume [0,1] clamp), `renderMap`
  iki geçişli dinamik yükseklik, `lifeCardStringsFor(locale)` TR kopya.

## 2b. Önceki işler (commit'li ve push'lu)

- **Supabase keep-alive cron** (152da7f): Vercel Cron → `/api/keep-alive`;
  `keepAliveLogic()` asla throw etmez; 5 unit test.
- **Gotik Müzik Haritası** (088535f'e kadar): 6 fazlı chapter yapısı,
  Hayat Ağacı, kemer portallar, Spotify deep link, 5-dil poster.canvas
  sözlüğü, dinamik tema motoru.

---

## 3. Olası sonraki adımlar

- **Bu oturumun değişikliklerini commit'leme** — kullanıcı onayı bekleniyor
  (görev kuralı: onaysız commit/push yok). Onay gelirse:
  `checkpoint: i18n tam çeviri + dinamik Gemini dili + prettier temizliği — HANDOFF.md güncellendi`.
- `feed/` bileşenlerini sözlüğe bağla (şu an Türkçe hard-coded).
- `deterministicEntryInsight` şablonlarını çokdilleştir (şu an en-only;
  Gemini yoksa Life Feed anında satırı her dilde İngilizce görünür).
- 9 react-refresh uyarısını temizleme (ui/* export ayrıştırma) — düşük
  öncelik, kabul edilebilir durumda.

---

## 4. Karar ağacı

**🅐 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN
yeniden yaz, onaylıysa `checkpoint: ... — HANDOFF.md güncellendi` ile
commit et (onay yoksa değişiklikleri çalışma ağacında bırak ve bildir).

**🅑 i18n'e yeni string eklerken →** `en`'e ekle → diğer 4 dile kopyala →
`i18n.test.tsx` key-parity + no-fallback testleri otomatik yakalar.

**🅒 Testler kızarsa →** `npm test`; QuestionCard/PosterCanvas testleri
İngilizce varsayılan sözlüğe bağlı.

**🅓 Canvas export'a dokunurken →** Rastgelelik her zaman `seededRandom`
üzerinden; asla `Math.random()` kullanma (export tekrarlanabilirliği
bozulur). Yeni bölüm eklersen akış `y`'yi ilerletir; yükseklik ölçümü
otomatik — ama `return y + 300` (duality dibi) kontratını bozma.

**🅔 Poster layout'una bölüm eklerken →** `drawMap` içindeki akışa ekle
(portallar sonrası gibi), sabit H'ye GÖRELİ konumlandırma; H'yi shadow'la,
modül sabitini değil.

---

## 5. Dikkat — bu oturumda öğrenilen

- **Taze ortamda `npx tsc` yerel binary yoksa npm'den sahte `tsc@2.0.4`
  paketi çekmeye çalışır ve askıda kalır** — önce `npm install`, sonra
  gate'ler. `node_modules` gitignore'lu; ağaç temiz kalır.
- **LLM dil kuralları çift katmanlı olmalı:** user prompt kuralı +
  systemPrompt takviyesi (`buildPoeticAnalyzerPrompt` deseni; entry
  insight'a da aynısı uygulandı).
- **Repo-geneli prettier --write güvenli ama bilinçli karar:** 8 dosyada
  saf formatlama drift'i yarattı; tam test + tsc + build ile doğrulandı.
  Kullanıcı repo-geneli lint yeşilliği istediğinde bu kabul edilebilir.
- jsdom'da `audio.volume = 1.0000000000000002` IndexSizeError fırlatır —
  rAF tween'lerinde her zaman [0,1] clamp.
- Singleton audio handoff'ta eski sahibin `playing` flag'ini temizlemek
  için `onInactive` callback'i şart.
- renderMap iki geçişli ölçüm: PROVISIONAL_H=24000 yeterli (32767 canvas
  limitinin altında).
- Vitest sayacı: 290 → 298 (25 dosya).

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- Life Story prompt'larına / `GROUNDING_RULES`'a / `buildLifeStoryPrompt`'a
  DOKUNMA (kullanıcı kuralı #2).
- Kullanıcı onayı olmadan push etme; main'de history rewrite YOK
  (Lovable senkronu); dal birleştirme.
- `vite.config.ts`'te DEV-ONLY allowedHosts'u commit'leme.
- Vercel'e `VITE_`-prefixed secret env girme.
- Sahte/mock şarkı, sahte artwork, sahte preview URL'si ÜRETME — gerçek
  dış veri tek otorite.
