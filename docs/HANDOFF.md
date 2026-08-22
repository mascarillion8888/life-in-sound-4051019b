# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her operasyon sonunda TAMAMEN yeniden yazılır.
> `STATE.md` anayasa (kalıcı kurallar), bu dosya "şu an". Her AI oturumu
> ilk iş olarak bunu BAŞTAN SONA okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (asla sabit yazılmaz — `git log -1 --oneline` ile doğrula)
Testler:   172/172 geçti — 2026-08-22 (11 dosya; +3 yeni test dosyası)
tsc/build: temiz (tsc --noEmit = 0 hata; npm run build = 0)
Lint:      Yeni dosyalar temiz; 4 DOSYADA ÖNCEDEN VAR OLAN prettier drift'i
           (Results.tsx, SongPicker.tsx, Waveform.tsx, soundmap/data.ts)
           bilinçli dokunulmadı — minimal-değişiklik ilkesi.
LLM:       GEMINI_API_KEY BU ORTAMDA BOŞ — canlı Gemini çıktı doğrulaması
           KULLANICI makinesinde yapılmalı (deterministik fallback her
           durumda render olur).
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

**Dynamic Music Map Engine & Poetic Gemini Analyzer (TAMAMLANDI + 172/172 test
yeşil; canlı Gemini çıktısı doğrulaması KULLANICI'DA BEKLEMEDE).**

Kullanıcı talebi: 8 şarkıdan soğuk AI raporu değil, "ömrü boyu yanındaki
bir dost" gibi yazılan şiirsel bir analiz; görsel tema/renk/tipografi/duygu
eğrisi kullanıcının janrına göre (Metal/Gothic, 80s Synthwave, Jazz/Classical,
Indie/Acoustic, Pop) dinamik belirlensin. Grounding ilkesi korunarak yapıldı:
**tema ve temel palet deterministik hesaplanır, LLM sadece anlatır (aura +
artwork prompt'u rafine eder).**

Yeni dosyalar:
- `src/lib/llm/poetic-analyzer.ts` — tipler (PoeticAnalysis, LifeChapter,
  VisualSpec, CoreDuality), `detectVisualTheme` (janr ×2 + şarkı başlığı ×1
  keyword skoru, tie-break öncelik sırası, hiçbiri yoksa ambient-default),
  `THEME_CATALOG` (5 tema + default, hex palet + tipografi + aura + artwork
  prompt), `buildPoeticAnalyzerPrompt` (saf string; grounding kuralları
  biography-yasağı dahil; strict JSON kontrat + KEŞİF & BÜYÜLENME /
  GEÇİŞ PORTALLARI örnekleri; opsiyonel memory notes), `extractJsonObject`,
  `parsePoeticAnalysis` (telafi edici parser — her alan fallback'e düşer,
  sadece hex kabul eder, asla throw etmez; hiç JSON yoksa null),
  `deterministicPoeticAnalysis` (tamamen render-edilebilir fallback).
- `src/lib/llm/generateAnalysis.server.ts` — server-only Gemini köprüsü
  (OpenAI-uyumlu endpoint, native fetch, `GEMINI_API_KEY` env; json_object
  response_format; hiçbir hata asla client'a fırlatılmaz → null = fallback).
- `src/components/results/PosterCanvas.tsx` — dinamik temalı poster
  komponenti: manifesto, aura çipleri, duygusal eğri barları, chapter
  kartları, song insights, core duality, export butonu. Tüm renkler
  `analysis.visual.palette`'ten inline style ile sürülür.
- `src/lib/soundmap/poeticPoster.ts` — 1600×2400 canvas → PNG indirme
  (bağımsız canvas renderer; DOM rasterizasyonu yok).
- `src/lib/life-feed.ts` — Life Feed state + persistence: 8. cevap tamam
  olunca `graduateToLifeFeed`; `appendLifeFeedEntry` immutable büyütür;
  `loadLifeFeed` yüklerken validasyon eksik base'i reddeder; map +
  memories dizileri (analyzer'a genişleyen girdi için).
- Testler: `poetic-analyzer.test.ts` (tema tespiti + prompt + parser +
  deterministik fallback), `life-feed.test.ts` (graduate/append/remove +
  localStorage round-trip), `PosterCanvas.test.tsx` (render + tema palet).
- `src/routes/results.tsx` — "Dynamic Music Map" bölümü eklendi
  (deterministic derhal render → Gemini gelince yerinde upgrade;
  LifeStory ile aynı fingerprint sözleşmesi).
- `journey-storage.ts` — `normalizeSong` artık exported (life-feed reuse).
- `.env.example` — server-only `GEMINI_API_KEY` dokümantasyonu.

Uyum: `vite.config.ts` allowedHosts (DEV-ONLY) commitlenmedi; orchestraya
dokunulmadı; companion/memory/pattern sistemi geri getirilmedi (STATE.md 🚨).

---

## 3. Şu an açık/bekleyen tek şey

Yeni engine TAMAM ve push edildi. BEKLEYEN: canlı Gemini çıktı doğrulaması
(kullanıcı makinesinde). Validation Gate (5+ gerçek kişi) hâlâ geçerli öncelik;
Faz 4 kullanıcı onayı olmadan başlamıyor.

**Sıradaki tek adım:**
```
1) KULLANICI: git pull → GEMINI_API_KEY=<key> ile npm run dev → journey
   tamamla → /results'ta "Dynamic Music Map" bölümünde manifesto/chapter/
   duality'nin deterministikten daha zengin (Gemini) geldiğini GÖZLE KONTROL ET.
   Anahtar yoksa deterministik render beklenen davranış — hata değil.
2) Validation Gate: 5+ kişiye ürünü göster, geri bildirim topla. AI adımı YOK.
```

---

## 4. Olası sonuçlar

**🅐 Kullanıcı Gemini çıktısında zengin manifesto/chapters görür →** Doğrulandı.
Validation Gate'e geçilebilir; Life Feed UI (graduation akışı) sıradaki
tasarım onayını bekler (`docs/TECH/DATABASE_PLAN.md` DRAFT).

**🅑 Kullanıcı sadece deterministik çıktı görür (Gemini yanıt vermiyor) →**
Ortamda GEMINI_API_KEY eksik veya endpoint/model erişimi sorunu; server
loglarında değil client'ta sessiz fallback — anahtarı kontrol et.

**🅒 Gemini žey/geçersiz JSON dönerse →** Parser telafisi devrede (testlerle
kanıtlı); prompt'a "strict JSON" güçlendirmesi küçük bir yama olarak eklenebilir.

**🅓 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden
yaz, `checkpoint: [özet] — HANDOFF.md güncellendi` ile push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**LLM görsel spesifikasyonunda renkleri asla serbest bırakma.** Tema kimliği +
palet hex'leri prompt'a deterministik girdi olarak verildi; Gemini sadece
aura/artwork metnini rafine eder, parser de yalnızca geçerli hex kabul eder
(aksi halde tema paleti devreye girer). Böylece "LLM hesaplar" değil "LLM
anlatır" ilkesi renk katmanına da taşındı. Ayrıca jsdom testlerinde CSS
shorthand hex→rgb normalize edilir; poster tema testleri bu normalize formu
spesifik assert etmeli (PosterCanvas.test.tsx'deki helper).

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- `vite.config.ts`'i değiştirme — DEV-ONLY allowedHosts commitleme.
- Önceden var olan prettier drift'ini (Results.tsx, SongPicker.tsx, Waveform.tsx,
  soundmap/data.ts) rastgele kozmetik olarak fix etme — ayrı bir temizlik
  kararıdır, kullanıcı onayıyla.
- Anahtarsız ortamda canlı Gemini/Groq doğrulaması yapmaya çalışma;
  kullanıcı makinesine devret (aynı kural Life Story'de de geçerliydi).

---

## 7. Devir kaydı (son 5 satır)

| Tarih | Kim | Ne | Commit |
|---|---|---|---|
| 2026-08-19 | Claude+OpenHands | QuestionCard manuel giriş | 053bd4a |
| 2026-08-20 | OpenHands | metaLine + isValidSong artist fix | 482a292 |
| 2026-08-20 | OpenHands | Journey Step 4 UI tersine çevirme | 7a8a56a |
| 2026-08-20 | OpenHands | MusicBrainz arama UI'dan kaldırıldı | 7b27cd3 |
| 2026-08-22 | OpenHands | Dynamic Music Map Engine + Poetic Gemini Analyzer | (bu checkpoint — `git log -1 --oneline` ile doğrula) |

---
_2026-08-22 OpenHands tarafından tamamen yeniden yazıldı. Dynamic Music Map
Engine + Poetic Gemini Analyzer + Life Feed persistence teslim edildi
(172/172 test, tsc/build temiz). Canlı Gemini doğrulaması anahtar eksikliği
nedeniyle kullanıcı makinesine devredildi. Tek kaynak `docs/HANDOFF.md`._
