# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (asla sabit yazılmaz — `git log -1 --oneline` ile doğrula)
           origin/main = 2c2b60c → bu oturum commit'landi:
             **91b5cea** "feat(soundmap): overhaul gothic map canvas,
             click-to-listen & 6-phase narrative" (11 dosya, +994/−465).
           PUSH DENENDİ — sistem tokenı geçersiz (401); kullanıcıdan taze token bekleniyor.
           origin/main = 2c2b60c (2 commit geride: 1efb9e3 + 91b5cea).
           Çalışma ağacı TEMİZ (commit sonrası).
Testler:   252/252 geçti (19 dosya; 241 + 3 listen + 6 poeticPoster
           tree/nodeColors/labels + PosterCanvas link/6-faz + i18n canvas)
tsc:       temiz (`npx tsc --noEmit` = 0 hata)
Build:     `npm run build` = 0 (postbuild-vercel-spa shell, route patch tamam)
Lint:      değişen dosyalarda 0 hata; PosterCanvas.tsx'te 2 react-refresh
           UYARISI var (FALLBACK_EXTRAS/posterExtras export'ları — önceki
           oturumdan beri mevcut, kabul edilebilir, gate bloklamıyor)
i18n:      5 dil (en/tr/es/de/fr); poster.phaseTitles/phaseAgeRanges artık
           6 faz (chapter-i..vi); poster.canvas bloğu (mapTitle,
           mapSubtitle, emotionalJourney, lifePlaylist, treeBranches[4],
           journeyNodes[8], moreOnMap) her dilde mevcut — en varsayılan
           ("MUSIC MAP — SOUNDTRACK OF A LIFE" vb.), tr'de referans
           görseldeki birebir metinler ("MÜZİK HARİTASI", "DUYGUSAL
           YOLCULUK", "HAYAT PLAYLIST'İM", ZİHİN/GÜÇ/KARANLIK/KABULLENİŞ)
Tema motoru: src/lib/soundmap/dynamicThemes.ts — 3 eksenli skorlama;
           VisualSpec frame / waveGradient / texture / auraGlow
Fontlar:   Cinzel / Playfair Display / Inter / Plus Jakarta Sans
Gemini:    `GEMINI_API_KEY` server-only; prose aktif dilde üretiliyor
Spotify:   `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` server-only (NO VITE_);
           dropdown Spotify primary → iTunes fallback → serbest-metin
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Gotik Müzik Haritası: 6 faz + click-to-listen + gotik canvas haritası (TAM, 91b5cea COMMIT'Lİ, push bekliyor)

Kullanıcı onaylı mimari kararlar (English-first, 6 faz, Spotify deep link):

1. **`src/lib/song/listen.ts` (YENİ):** `spotifySearchUrl(title, artist)` —
   gerçek Spotify arama deep link'i (`open.spotify.com/search/<query>`).
   Sahte stream URL'si yok; tek otorite gerçek servis.

2. **`src/lib/llm/poetic-analyzer.ts` — 6 faz + gotik ton:**
   - `CHAPTER_SLOTS` 4 → 6: DISCOVERY & WONDER [1], MENTAL AWAKENING [2],
     STRENGTH & TRIUMPH [3,4], THRESHOLD PORTALS [5], PURE ENERGY & JOY
     [6,7], IDENTITY & SYNTHESIS [8] (1..8 tam bir kez kapsanır).
   - `CHAPTER_NARRATIVES` 6 faza genişletildi (her faz 3 varyant, hash'li).
   - Yeni export'lar: `TREE_BRANCH_LABELS` (MIND/POWER/DARKNESS/ACCEPTANCE),
     `JOURNEY_NODE_LABELS` (8 düğüm: Discovery, Rebellion, Inquiry,
     Darkness, Triumph, Longing, Portal, Depth).
   - Prompt (onaylı kapsam — poetic-analyzer'ın kendi prompt'u): 6 arketip
     kuralı, "chapters 4-6" kontratı, gotik-fantazi harita tonu + şarkı
     başlıklarını derin örme kuralı. Life Story prompt'larına DOKUNULMADI.

3. **`src/lib/i18n/dictionaries.ts`:** 5 dilde 6 faz başlığı/yaş aralığı +
   yeni `poster.canvas` bloğu (harita başlığı, bölüm etiketleri, ağaç
   dalları, yolculuk düğümleri). Varsayılan İngilizce; tr'de referans
   görseldeki Türkçe metinler birebir.

4. **`src/components/results/PosterCanvas.tsx`:**
   - Hero manifesto tam ortalı, tema serif'i (Cinzel/Playfair italic).
   - Tüm albüm görselleri (chapter strip, playlist, Life Feed) + kapaksız
     vinyl placeholder'lar tıklanabilir → Spotify arama deep link'i,
     `target="_blank" rel="noopener noreferrer"`, aria-label'lı.
   - Roadmap grid 4 → 6 sütun (lg:6, sm:3, mobil:2); chapter kartları
     lg:3 sütun.
   - Export butonu `t.poster.canvas` etiketlerini exporter'a geçiriyor.

5. **`src/lib/soundmap/poeticPoster.ts` — gotik harita exporter:**
   - `exportPoeticPoster(analysis, songs, feedEntries, labels?)` — 4.
     parametre opsiyonel, varsayılan `DEFAULT_POSTER_LABELS` (İngilizce).
   - Prosedürel **Hayat Ağacı** (`buildTree`, seed-deterministik): gövde +
     4 ana dal (etiketler dal uçlarında), derinlikle incelen dallar.
   - **Gotik kemer portalları** (`drawPortal`): 6 chapter, 3 sütun × 2 satır;
     arch clip içinde albüm kapağı (CORS-safe `loadArtwork`, 6 sn timeout,
     yüklenemezse vinyl placeholder — asla sahte veri yok), çift taş rib +
     apex elmas; altında başlık/era/şarkılar.
   - **EMOTIONAL JOURNEY**: çok renkli sinyal çizgisi (`nodeColors` ile
     segment bazlı gradyan), düğüm etiketleri (journeyNodes; feed "+N").
   - **MY LIFE PLAYLIST**: 2 sütunlu tablo (mini-arch marker + numara +
     başlık + sanatçı/insight); Life Feed satırları bütçe korumalı
     (`fitFeedRows` + doğru "+N moreOnMap" notu).
   - Core duality paneli + footer (aura, tema imzası, brand).
   - Export artık async: görseller preload edilince render + indirme;
     hata/timeout'ta placeholder'lı senkron render'a düşer.

6. **Testler (252/252):** listen (3), buildTree determinizm/4 dal/incelme,
   nodeColors interpolasyon, DEFAULT_POSTER_LABELS, PosterCanvas 6-faz
   roadmap + tıklanabilir link testi, i18n 6-faz + canvas key-parity.

**Bilerek kapsam dışı:** Life Story pipeline/prompt'ları, routing, Supabase,
auth, tema kataloğu, Journey soru sayısı, QuestionCard/serbest-metin UX'i,
audio preview (Song tipinde previewUrl yok — isterseniz iTunes previewUrl
ayrıca eklenebilir).

---

## 3. Olası sonraki adımlar

- **Bu oturumun değişikliklerini commit/push et** — kullanıcı onayı
  bekleniyor (push için kullanıcı her seferinde taze token veriyor).
- **iTunes Search API ile gerçek şarkı doğrulaması** — hâlâ açık; ayrı onay
  turu bekliyor. Kurallar: eski MusicBrainz dialog'u GERİ GELMEZ,
  serbest-metin birincil UX, LLM yok, sahte/mock şarkı yok,
  `searchSong.server.ts` soyutlaması korunur, testlerde canlı ağ yok.
- `feed/` bileşenlerini sözlüğe bağla (şu an Türkçe hard-coded).
- `buildEntryInsightPrompt` için language param.
- PosterCanvas.tsx'teki 2 react-refresh uyarısını temizlemek isterseniz
  `FALLBACK_EXTRAS`/`posterExtras`'ı ayrı modüle taşıyın (opsiyonel).

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
üzerinden; asla `Math.random()` kullanma (export tekrarlanabilirliği bozulur).

---

## 5. Dikkat — bu oturumda öğrenilen

- **eslint --fix'i SADECE değişen dosyalarda çalıştır** (repo geneli drift
  riski; daha önce data.ts olayı yaşandı).
- 6 faz genişlemesi LLM üretimlerini de etkiler: kontrat "4-6" oldu;
  Gemini 4 chapter dönerse roadmap 4 kart gösterir (grid uyarlanabilir).
- Albüm kapağı canvas'ta yalnızca CORS'a izin veren kaynaklardan çizilir
  (mzstatic OK); `crossOrigin="anonymous"` + timeout + placeholder zorunlu.
- `npm run lint` (repo geneli) bu ortamda >180 sn sürebiliyor; hızlı gate
  için scoped eslint, finalde repo geneli koş.
- Vitest sayacı: 241 → 252 (19 dosya).

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
  birincil UX olarak kalır.
- Canvas export'ta `Math.random()` kullanma — determinizmi bozar.
- Sahte stream/preview URL'si üretme — tıkla-dinle yalnızca gerçek servis
  arama linkidir.
