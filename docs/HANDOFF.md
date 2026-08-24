# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (asla sabit yazılmaz — `git log -1 --oneline` ile doğrula)
           MTG Life Cards işi commit'lendi ve PUSH TAMAM
           (`d838566..e0b15dd main -> main`; `git status` temiz).
Testler:   290/290 geçti (24 dosya; 257'den +33: lifeCards 8,
           artworkHarmonize 6, useAudioPreview 8, QuizCard 4,
           poeticPoster renderMap 4, searchSong preview 1,
           PosterCanvas grid 1, iTunes fixture güncellemesi)
tsc:       temiz (`npx tsc --noEmit` = 0 hata)
Build:     `npm run build` = 0 hata (Nitro + postbuild-vercel-spa OK)
Lint:      bu işin dokunduğu dosyalarda 0 hata. UYARI: HEAD'de
           `src/lib/soundmap/data.ts` ve `src/lib/song/spotify.server.test.ts`
           zaten prettier HATALI (pre-existing; eslint --fix düzeltmesi
           kapsam dışı diye geri alındı — repo geneli `npm run lint`
           bu iki dosya yüzünden kırmızı kalır, bu oturumun borcu değil).
           PosterCanvas.tsx / LanguageContext.tsx react-refresh
           UYARILARI da HEAD'den beri mevcut (kabul edilebilir).
i18n:      5 dil (en/tr/es/de/fr). YENİ: `quizCard` bloğu (intensityLabel,
           playPreviewAria, mutePreviewAria, previewUnavailableAria) +
           `poster.canvas.lifeCards` — en "LIFE CARDS", tr "HAYAT
           KARTLARI", es/de/fr'de İngilizce bırakıldı (English-first
           kararı, bilinçli). Key-parity testi yeşil.
Fontlar:   Cinzel / Playfair Display / Inter / Plus Jakarta Sans
Gemini:    `GEMINI_API_KEY` server-only; prose aktif dilde üretiliyor
Spotify:   `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` server-only (NO VITE_);
           dropdown Spotify primary → iTunes fallback → serbest-metin
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — MTG-Style Dynamic Life Cards + Master Poster entegrasyonu + Audio Preview (TAM, bu oturumun commit'i)

Kullanıcı onaylı kararlar: (1) `profile` opsiyonel kalır, yeni zorunlu
input yok; (2) 6 portallı poster yapısı KORUNUR, 8 MTG kartı ayrı bir
4×2 grid bölümü olarak eklenir; (3) 30 sn preview ses modülü dahil.

1. **`src/lib/song/types.ts`:** `Song.previewUrl?: string | null` — 30 sn
   önizleme URL'si (sağlayıcı gerçekten veriyorsa).
2. **`src/lib/song/itunes-mapping.ts` + `src/lib/song/spotify.server.ts`:**
   iTunes `previewUrl` ve Spotify `preview_url` Song'a map'lenir; yoksa
   `null` — asla uydurma URL yok.
3. **`src/lib/soundmap/lifeCards.ts` (YENİ):** 8 era kartı (FIRST SPARK,
   FIRST SIGNATURE, REBELLION, INQUIRY, STEEL, DARKNESS, LONGING,
   ACCEPTANCE — yaş aralıkları, tag, tone, deterministik intensity,
   gotik narrative). English-first; `TR_LIFE_CARD_STRINGS` +
   `lifeCardStringsFor(locale)` ile Türkçe kopya; `LIFE_CARD_TONE_COLORS`
   (violet/gold/silver) DOM + canvas ortak tek kaynak.
4. **`src/lib/soundmap/artworkHarmonize.ts` (YENİ):** `drawHarmonizedArtwork`
   — canvas shader pipeline (sepia/contrast filtre + bronz multiply tint +
   seed-deterministik grain + vinjet); `harmonizeFilter()` DOM'da CSS
   yaklaşımı. Ham kapak asla düz yapıştırılmaz.
5. **`src/lib/soundmap/useAudioPreview.ts` (YENİ):** singleton çalma
   (modül-seviye `active`; yeni kart başlayınca eski `onInactive` ile
   fade-out + flag temizlenir), fade-in 900 ms / fade-out 450 ms,
   `previewUrl` yoksa `available:false` (ses UYDURULMAZ), autoplay
   reddi sessizce yutulur. **Hacim clamp bugfix:** `0.7+0.3` float'u
   1.0000...2 üretip jsdom'da IndexSizeError fırlatıyordu —
   `rampVolume` artık [0,1] clamp'liyor.
6. **`src/components/results/QuizCard.tsx` (YENİ):** MTG çerçevesi —
   başlık barı (era + yaş rozeti), harmonize artwork penceresi (şarkı
   yoksa boş koyu çerçeve, sahte kapak YOK), type line + tone gem,
   stats (tag + Intensity), gotik narrative, şarkı kredi satırı,
   köşede gothic mute/play toggle (preview yoksa disabled).
7. **`src/components/results/PosterCanvas.tsx`:** portalların altına
   "LIFE CARDS" 4×2 grid bölümü (8 QuizCard; ilk kart autoplay dener —
   singleton tek ses garantisi). Export butonu artık
   `{...t.poster.canvas, lifeCardStrings: lifeCardStringsFor(language)}`
   geçiriyor.
8. **`src/lib/soundmap/poeticPoster.ts` — dinamik yükseklik + kart grid'i:**
   - `renderMap` artık EXPORTED ve iki geçişli: ölçüm geçişi
     (PROVISIONAL_H=24000) → içerik dibini ölç → canvas yüksekliğini
     `max(3600, contentBottom + 420)` yap → final geçiş. Kesilme
     imkânsız; footer her zaman son panelin altında.
   - Gövde `drawMap(ctx, H, ...)` oldu; H parametresi modül sabitini
     shadow'lar — bottom glow / feed bütçesi / footer ölçülen yüksekliği
     takip eder. `drawTexture`/`drawFrame` de H parametresi alıyor.
   - Yeni bölüm 4b: portalların altında 4×2 kart grid'i, `drawLifeCard`
     (çerçeve, başlık barı, harmonize artwork veya boş koyu çerçeve +
     tone halkası, type line, stats, narrative max 3 satır, kredi satırı).
   - `PosterLabels`: `lifeCards: string` + opsiyonel
     `lifeCardStrings?: LifeCardStrings`; DEFAULT "LIFE CARDS".
   - 6 portal, ağaç, waveform, playlist, feed, duality, footer AYNI.
9. **Testler:** lifeCards (8 era, determinizm, TR kopya, tone renkleri),
   artworkHarmonize (filtre/seed determinizm, canvas çağrıları),
   useAudioPreview (singleton handoff, fade, autoplay reddi, unmount),
   QuizCard (çerçeve öğeleri, harmonize filter, boş çerçeve, toggle
   disabled), poeticPoster renderMap (yükseklik >3600, feed büyünce
   büyür, deterministik, TR kopya), PosterCanvas (grid 8 kart; yaş
   rozetleri artık roadmap+kartlarda çift → getAllByText), searchSong
   (TRACK_FRAGILE fixture'ına previewUrl + yeni preview mapping testi).

**Bilerek kapsam dışı:** Life Story pipeline/prompt'ları, GROUNDING_RULES,
routing, Supabase şeması, auth, Journey soru sayısı, QuestionCard
serbest-metin UX'i, eski MusicBrainz dialog'u, görsel tema kataloğu,
`profile` alanları.

---

## 2a. Önceki işler (commit'li ve push'lu)

- **Supabase keep-alive cron** (152da7f, push'lu): Vercel Cron
  `0 6 * * *` → `/api/keep-alive`; `src/server.ts` entry intercept,
  `keepAliveLogic()` asla throw etmez; 5 unit test.
- **Gotik Müzik Haritası** (088535f'e kadar push'lu): 6 fazlı chapter
  yapısı, Hayat Ağacı, kemer portallar, Spotify deep link, 5-dil
  poster.canvas sözlüğü, dinamik tema motoru.

---

## 3. Olası sonraki adımlar

- ~~Bu işi push etme~~ — PUSH TAMAM (kullanıcı isteğiyle, e0b15dd = origin/main).
- **iTunes Search API ile gerçek şarkı doğrulaması** — hâlâ açık; ayrı
  onay turu bekliyor. Kurallar: eski MusicBrainz dialog'u GERİ GELMEZ,
  serbest-metin birincil UX, LLM yok, sahte/mock şarkı yok,
  `searchSong.server.ts` soyutlaması korunur, testlerde canlı ağ yok.
- es/de/fr sözlüklerinde İngilizce kalan `quizCard` + `lifeCards`
  string'lerinin gerçek çevirileri (kullanıcı isterse).
- `feed/` bileşenlerini sözlüğe bağla (şu an Türkçe hard-coded).
- `buildEntryInsightPrompt` için language param.
- HEAD'deki pre-existing prettier borcu (data.ts, spotify.server.test.ts)
  — ayrıca temizlenmek istenirse.

---

## 4. Karar ağacı

**🅐 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN
yeniden yaz, onaylıysa `checkpoint: ... — HANDOFF.md güncellendi` ile
commit et (onay yoksa değişiklikleri çalışma ağacında bırak ve bildir).

**🅑 i18n'e yeni string eklerken →** `en`'e ekle → diğer 4 dile kopyala →
`i18n.test.tsx` key-parity testi otomatik yakalar.

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

- **eslint --fix'i SADECE değişen dosyalarda çalıştır** (repo geneli drift
  riski; bu oturumda data.ts + spotify.server.test.ts'e formatlama
  bulaştı — HEAD zaten prettier-hatalıymış, düzeltmeler geri alındı).
- **jsdom'da `audio.volume = 1.0000000000000002` IndexSizeError fırlatır**
  — 0.7+0.3 float artefaktı. rAF tween'lerinde her zaman [0,1] clamp.
  Tek dosya koşusunda gizlenebilir; batch'te açığa çıkar.
- Singleton audio handoff'ta eski sahibin `playing` flag'ini temizlemek
  için `onInactive` callback'i şart — aksi halde iki kart aynı anda
  "çalıyor" görünür.
- renderMap iki geçişli ölçüm: PROVISIONAL_H=24000 yeterli (2400x24000
  canvas ~230 MB, browser'da sorun yok; 32767 canvas limitinin altında).
- Vitest sayacı: 257 → 290 (24 dosya).

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- Life Story prompt'larına / `GROUNDING_RULES`'a / `buildLifeStoryPrompt`'a
  DOKUNMA (kullanıcı kuralı #2 — poetic-analyzer prompt'una bile bu
  oturumda dokunulmadı).
- Kullanıcı onayı olmadan push etme; main'de history rewrite YOK
  (Lovable senkronu); dal birleştirme.
- `vite.config.ts`'te DEV-ONLY allowedHosts'u commit'leme.
- Vercel'e `VITE_`-prefixed secret env girme.
- Sahte/mock şarkı, sahte artwork, sahte preview URL'si ÜRETME — gerçek
  dış veri tek otorite.
