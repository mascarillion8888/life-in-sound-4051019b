# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (asla sabit yazılmaz — `git log -1 --oneline` ile doğrula)
           Son commit hâlâ 04d9a00; BU OTURUMUN DEĞİŞİKLİKLERİ HENÜZ
           COMMIT EDİLMEDİ (kullanıcı kuralı: onaysız commit yok).
           Çalışma ağacında 4 dosya değişik/yeni:
             M  src/lib/llm/poetic-analyzer.ts
             M  src/lib/llm/poetic-analyzer.test.ts
             M  src/lib/soundmap/poeticPoster.ts
             ?? src/lib/soundmap/poeticPoster.test.ts
Testler:   241/241 geçti (18 dosya; 228 + 3 poetic-analyzer narrative/
           prompt testi + 10 poeticPoster saf-yardımcı testi)
tsc:       temiz (`npx tsc --noEmit` = 0 hata)
Build:     `npm run build` = 0 (postbuild-vercel-spa shell, route patch tamam)
Lint:      değişen dosyalarda 0 hata (repo genelinde bilinen 1
           react-refresh uyarısı LanguageContext.tsx'te — kabul edilebilir)
i18n:      LanguageContext + LanguageSwitcher aktif; 5 dil (en/tr/es/de/fr),
           varsayılan en, localStorage "soundmap:language"
Tema motoru: src/lib/soundmap/dynamicThemes.ts — 3 eksenli skorlama
           (tür x2, duygu x1, yaş/faz x1); VisualSpec frame /
           waveGradient / texture / auraGlow
Fontlar:   Cinzel / Playfair Display / Inter / Plus Jakarta Sans
           (styles.css Google Fonts import + tipografi->font haritaları)
Gemini:    `GEMINI_API_KEY` server-only; analiz prose'u aktif dilde
           üretiliyor (LANGUAGE REQUIREMENT + REMINDER kuralları)
Spotify:   `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` server-only (NO VITE_);
           dropdown Spotify primary → iTunes fallback → serbest-metin
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Narrative de-robotizasyonu + Canvas poster motoru yeniden inşası (TAM, COMMIT EDİLMEDİ)

Kullanıcı onayı ile (kapsam: sadece `poetic-analyzer.ts` +
`poeticPoster.ts`, API imzaları ve veri akışı korunarak):

1. **`src/lib/llm/poetic-analyzer.ts` — prompt revizyonu + deterministik şablonların kaldırılması:**
   - `ANALYZER_GROUNDING_RULES`'a yeni kural: "Formulaic scaffold structures
     are forbidden" — "It begins with…", "By the time…", "First you tried…",
     "And in the end…", "What remains is…" gibi kalıp açılışlar yasak;
     narrative'ler editoryal dergi biyografisi gibi akmalı.
   - TASK bloğunda `manifesto` ve `chapters` tanımları güçlendirildi
     (editoryal biyografi, şarkı listesi sayma yasağı).
   - `deterministicPoeticAnalysis`: sabit `narrativeByChapter` Record'u
     kaldırıldı; yerine `CHAPTER_NARRATIVES` — her faz için 3 editoryal
     varyant, `stableHash(first‖last)` ile deterministik seçim. Tüm
     varyantlar gerçek şarkı başlıklarını akan prose içine örüyor.
   - Life Story prompt'larına / `GROUNDING_RULES`'a / `buildLifeStoryPrompt`'a
     DOKUNULMADI (kural #2'ye uygun — yalnız poetic-analyzer'ın kendi
     prompt'u onaylı plan kapsamında güncellendi).

2. **`src/lib/soundmap/poeticPoster.ts` — Canvas motoru sıfırdan:**
   - İmza aynı: `exportPoeticPoster(analysis, songs, feedEntries)`;
     2400x3600 high-DPI korundu.
   - `seededRandom` (mulberry32) — tüm texture/rough-edge geometrisi
     seed-deterministik; aynı analiz her zaman aynı PNG'yi üretir.
   - 6 tema texture'ı: smoke / grid (perspektif) / silk / paper / gloss /
     nebula (yıldız + glow).
   - 5 frame stili: gotik **pointed arch** (çift katman), double-rule,
     rough-edge (jitter), neon-glow (3 geçişli glow), hairline + köşe tick.
   - Yeni tipografik harita düzeni: brand eyebrow → manifesto hero → aura
     chip'leri → 4'lü Life-Phase Roadmap → 2x2 Narrative Chapter kartları
     (elmas ornament + numaralı şarkı listesi + narrative paragraf) →
     düzgünleştirilmiş bezier **waveform** paneli (glow + gradient stroke +
     numaralı noktalar; Life Feed entry'leri eğriyi uzatır) → "The Eight
     Tracks" playlist satırları (vinyl disc placeholder + numara + başlık +
     sanatçı + insight) → Life Feed satırları (`fitFeedRows` ile taşma
     koruması + doğru "+N more on your living map" notu) → Core Duality
     paneli (3 renkli eksen) → footer (tema imzası + brand).
   - Test edilebilir saf yardımcılar export edildi: `seededRandom`,
     `buildWaveformPoints`, `fitFeedRows`.

3. **Testler:**
   - `poetic-analyzer.test.ts` +3: scaffold açılışları yasak testi,
     narrative örgü testi (her chapter'ın ilk/son şarkısı narrative'de),
     prompt scaffold-yasağı kuralı testi.
   - `poeticPoster.test.ts` (YENİ, 10 test): PRNG determinizmi ve aralığı,
     waveform geometrisi (sayı, aralık, tepe eşleme, tek nokta, boş),
     feed satır bütçesi (yeterli/kısıtlı/yok).

**Bilerek kapsam dışı bırakılanlar:** PosterCanvas.tsx (ekran posteri),
routing, Supabase, auth, görsel tema kataloğu, Journey soru sayısı,
Life Story pipeline'ı, QuestionCard/serbest-metin UX'i.

---

## 3. Olası sonraki adımlar

- **Bu oturumun değişikliklerini commit/push et** — kullanıcı onayı
  bekleniyor (kural: onaysız commit yok; push için kullanıcı her seferinde
  taze token veriyor).
- **iTunes Search API ile gerçek şarkı doğrulaması** — bu konuşmanın
  orijinal TASK'ı. Kullanıcı önceliği narrative/canvas işine verdi;
  iTunes planı sunuldu ama implementasyon için ayrı onay turu bekleniyor.
  Kurallar: eski MusicBrainz dialog'u GERİ GELMEZ, serbest-metin girişi
  birincil UX kalır, LLM yok, sahte/mock şarkı yok, `searchSong.server.ts`
  soyutlaması korunur, testlerde canlı ağ çağrısı yok.
- `feed/` bileşenlerini (LifeFeedInput/Timeline/Section) sözlüğe bağla —
  şu an Türkçe hard-coded.
- `buildEntryInsightPrompt` için language param.
- Landing hero/section copy çevirileri.

---

## 4. Karar ağacı

**🅐 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN
yeniden yaz, onaylıysa `checkpoint: ... — HANDOFF.md güncellendi` ile
commit et (onay yoksa değişiklikleri çalışma ağacında bırak ve bildir).

**🅑 i18n'e yeni string eklerken →** `en`'e ekle → diğer 4 dile kopyala →
`i18n.test.tsx` key-parity testi otomatik yakalar.

**🅒 Testler kızarsa →** `npm test`; QuestionCard/PosterCanvas testleri
İngilizce varsayılan sözlüğe bağlı — provider'la dil değiştirilmedikçe
en stringleri bekle.

**🅓 Canvas export'a dokunurken →** Rastgelelik her zaman `seededRandom`
üzerinden; asla `Math.random()` kullanma (export tekrarlanabilirliği bozulur).

---

## 5. Dikkat — bu oturumda öğrenilen

- **eslint --fix'i SADECE değişen dosyalarda çalıştır.** Repo genelinde
  çalıştırmak daha önce `src/lib/soundmap/data.ts`'te istenmeyen prettier
  drift'i yaratmıştı (geri alınmıştı).
- `ctx.letterSpacing` TS DOM tiplerinde mevcut (TS 5.8); tracked başlıklar
  için güvenle kullanılabilir, eski tarayıcılarda sessizce yok sayılır.
- `npm run lint` (repo geneli) bu ortamda >180 sn sürebiliyor; hızlı gate
  için değişen dosyalara scoped eslint yeterli, finalde repo geneli koş.
- Vitest sayacı: 228 → 241 (18 dosya).

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- Life Story prompt'larına / `GROUNDING_RULES`'a / `buildLifeStoryPrompt`'a
  DOKUNMA (kullanıcı kuralı #2 — yalnız `buildPoeticAnalyzerPrompt`'a
  onaylı değişiklik yapıldı).
- Kullanıcı onayı olmadan commit/push etme; main'e push etme; dal birleştirme.
- `vite.config.ts`'te DEV-ONLY allowedHosts'u commit'leme.
- Vercel'e `VITE_`-prefixed secret env girme.
- `.vercel/` build çıktısını commit'leme (gitignore'da).
- `inlineDynamicImports`'u kaldırma — SSR çökmesini geri getirir.
- Eski MusicBrainz dialog/arama UI'ını geri getirme; serbest-metin girişi
  birincil UX olarak kalır (iTunes görevi için de geçerli).
- Canvas export'ta `Math.random()` kullanma — determinizmi bozar.
