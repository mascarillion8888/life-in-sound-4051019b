# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (asla sabit yazılmaz — `git log -1 --oneline` ile doğrula)
Testler:   219/219 geçti — bu oturumda yeniden koşturuldu (16 dosya;
           9 i18n + 1 prompt language-enforcement testi)
tsc:       temiz (`npm run typecheck` = 0 hata)
Build:     `npm run build` = 0 (postbuild-vercel-spa shell 3287 byte,
           route patch yapıldı)
Lint:      0 hata (1 react-refresh uyarısı LanguageContext.tsx'te — kabul
           edilebilir, gate'i bloklamıyor)
i18n:      LanguageContext + LanguageSwitcher aktif; 5 dil (en/tr/es/de/fr),
           varsayılan en, localStorage "soundmap:language"
Gemini:    `GEMINI_API_KEY` server-only; analiz prose'u aktif dilde
           üretiliyor (prompt'ta güçlü LANGUAGE REQUIREMENT kuralı +
           TASK öncesi REMINDER; her JSON value hedef dilde)
Spotify:   `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` server-only (NO VITE_);
           dropdown Spotify primary → iTunes fallback → serbest-metin
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Çoklu Dil Desteği (i18n + Language Switcher) + poetic 4-faz chapter sistemi (TAM, push edildi)

**İki iş tek oturumda, iki ayrı commit:**

1. `feat: poetic analyzer 4-faz chapter + poster roadmap` (önceki görev,
   daha önce commit'lenmemişti):
   - `poetic-analyzer.ts`: 4 faz (FIRST SPARK / AWAKENING / PASSAGES /
     DEEP RESONANCE), chapter'lara `ageRange` alanı, 8 şarkı fazlara
     eşleştiriliyor.
   - `PosterCanvas.tsx`: `songs: Song[]` prop, albüm kapağı küçük
     resimleri, SVG waveform, 4-fazlı "Life Phase Roadmap".
   - `results.tsx`: `songs: Song[]` türetimi (journey + manual fallback);
     LifeStory hâlâ `string[]` alıyor.
   - `poeticPoster.ts` canvas export aynı yapıyı çiziyor.

2. `feat: multi-language support (i18n + language switcher)`:
   - `src/lib/i18n/languages.ts` — `Language` tipi ('en'|'tr'|'es'|'de'|'fr'),
     `SUPPORTED_LANGUAGES`, `LANGUAGE_NAMES`, `isLanguage` guard.
   - `src/lib/i18n/dictionaries.ts` — `Dictionary` tipi + 5 sözlük;
     nav / journey / questionCard / results / poster (roadmap etiketleri,
     chapter başlıkları, footer alıntıları dahil).
   - `src/lib/i18n/LanguageContext.tsx` — `LanguageProvider` +
     `useLanguage()`; varsayılan **en**; localStorage `soundmap:language`;
     `document.documentElement.lang` güncellenir; **provider olmadan**
     `useLanguage()` İngilizce fallback döner (testler provider'sız
     çalışmaya devam eder).
   - `src/components/LanguageSwitcher.tsx` — Globe + dil kodu pill,
     Radix dropdown-menu; index Header'da, journey ve results
     sayfalarında sağ-üst köşede.
   - LLM lokalizasyonu: `PoeticAnalyzerInput.language?: Language`;
     `buildPoeticAnalyzerPrompt` son kural olarak dil direktifi ekler
     ("Write ALL prose ... in <Language>"; varsayılan English).
     `generateAnalysis.server.ts` → `GenerateAnalysisInput.language`;
     `results.tsx` fingerprint'e `language` eklendi → dil değişince
     analiz yeniden üretilir.
   - QuestionCard artık sözlükten okuyor (varsayılan en: "Add to Ritual",
     "Type a song and artist name" vb.); QuestionCard testleri en
     varsayılanına güncellendi.

**İkinci i18n turu (bu oturum):** results hero ("Your SoundMap" / "Eight
songs." / "One life, in sound." / sub-cümle) sözlüğe bağlandı
(`results.yourSoundmap|heroAccent|heroTagline|heroSub`, 5 dil);
poetic-analyzer prompt'una güçlü dil kuralı ("LANGUAGE REQUIREMENT: The
ENTIRE story body ... MUST be written in <dil>", her JSON value dahil) +
TASK öncesi "REMINDER: Respond entirely in <dil>" eklendi.

**Bilerek kapsam dışı bırakılanlar:** Life Story prompt'ları (korumalı),
`feed/` bileşenleri içi (mevcut Türkçe stringler duruyor), landing hero
metinleri, `deterministicPoeticAnalysis`/`deterministicLifeStory` çıktısı
(her zaman İngilizce — dictionary değil), `poeticPoster.ts` canvas export
etiketleri (marka İngilizce).

---

## 3. Olası sonraki adımlar

- `feed/` bileşenlerini (LifeFeedInput/Timeline/Section) sözlüğe bağla —
  şu an Türkçe hard-coded; dictionary'ye `feed` bölümü eklenecek.
- `buildEntryInsightPrompt` (Life Feed insight cümleleri) için language
  param — `GenerateEntryInsightInput.language` altyapısı hazır değil.
- Landing hero/section copy'lerinin çevirisi (şu an İngilizce sabit).
- LLM chapter başlıkları `chapter.id` "c1..c4" olduğunda sözlük
  override'ı devreye girmez — Gemini zaten aktif dilde yazıyor; gerekirse
  id'leri "chapter-i..iv" sabitle.

---

## 4. Karar ağacı

**🅐 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN
yeniden yaz, `checkpoint: ... — HANDOFF.md güncellendi` ile commit et.

**🅑 i18n'e yeni string eklerken →** `en`'e ekle → diğer 4 dile kopyala →
`i18n.test.tsx` key-parity testi otomatik yakalar.

**🅒 Testler kızarsa →** `npm test`; QuestionCard/PosterCanvas testleri
İngilizce varsayılan sözlüğe bağlı — provider'la dil değiştirilmedikçe
en stringleri bekle.

---

## 5. Dikkat — bu oturumda öğrenilen

- **`useLanguage()` provider'sız çalışmalı.** Context default değeri en
  sözlüğü + no-op setter; böylece mevcut bileşen testleri (PosterCanvas
  dahil) provider sarmadan geçer.
- **Dil değişimi = yeni analiz.** `results.tsx` fingerprint'ine `language`
  eklenmezse eski dildeki cache'li analiz kalır; eklendi.
- Prettier drift'i `--fix` ile temizlendi; rastgele kozmetik fix YOK.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- Life Story prompt'larına / `GROUNDING_RULES`'a / `buildLifeStoryPrompt`'a
  DOKUNMA (kullanıcı kuralı #2 — yalnız `buildPoeticAnalyzerPrompt`'a dil
  kuralı eklendi, onaylı plan kapsamında).
- `vite.config.ts`'te DEV-ONLY allowedHosts'u commit'leme.
- Vercel'e `VITE_`-prefixed secret env girme.
- `.vercel/` build çıktısını commit'leme (gitignore'da).
- `inlineDynamicImports`'u kaldırma — SSR çökmesini geri getirir.
- Eski MusicBrainz dialog/arama UI'ını geri getirme; serbest-metin girişi
  birincil UX olarak kalır.
