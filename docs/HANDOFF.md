# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      ebbeb5f — bu oturumun işi COMMIT'LENDİ ve PUSH TAMAM
           (`64f0dc8..ebbeb5f main -> main`; `git status` temiz).
Testler:   319/319 geçti (29 dosya; 315'ten +4 reset-session)
tsc:       temiz (`npx tsc --noEmit` = 0 hata)
Build:     `npm run build` = 0 hata (Nitro + postbuild-vercel-spa OK)
Lint:      `npm run lint` = 0 HATA (exit 0). Kalan 9 react-refresh uyarısı
           (ui/* shadcn + PosterCanvas.tsx + LanguageContext.tsx)
           pre-existing, kabul edilebilir.
i18n:      5 dil korunuyor (en/tr/es/de/fr sözlükleri, key-parity testleri
           yeşil). ANCAK yeni Era Card akışı + Master Poster kart kopyası
           TASARIM GEREĞİ English-only: kullanıcının "Full English
           Experience" görevi. Journey soruları/placeholder'lar hâlâ
           sözlükten gelir (varsayılan en); kart başlıkları, narrative'ler,
           poster kartları her zaman İngilizce render edilir.
Era flow:  Adım-adım kart akışı CANLI: şarkı commit → Era Card reveal
           (organik artwork + 30s preview autoplay + İngilizce narrative)
           → "Next Era / Continue" (audio fade-out + ilerleme) → 8. kartta
           "See Your Master Poster" → /results. Tarayıcıda uçtan uca
           doğrulandı (Painkiller 1990 → vintage-poster mount, '90s rozeti,
           crimson metal accent, Q2'ye temiz geçiş).
Gemini:    `GEMINI_API_KEY` server-only; prose aktif dilde (önceki oturum).
Spotify:   `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` server-only (NO VITE_);
           dropdown Spotify primary → iTunes fallback → serbest-metin
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Auto-Reset / Clean Restart (TAM, ebbeb5f, push'lu)

Kullanıcı görevi: her aşamada açık bir "Start Over" + landing'den dönüşte
temiz yeniden başlangıç. Uygulama:

- **`src/lib/reset-session.ts` (YENİ):** `resetJourneySession(userId)` — tek
  choke point. Siler: journey (localStorage `soundmap.journey.v1` + Supabase
  satırı, `clearRemoteJourney` üzerinden) + Life Feed (`soundmap.life-feed.v1`).
  KORUNUR: dil tercihi (`soundmap:language`) ve auth oturumu. AI sonuçları
  (Life Story/insight) fingerprint'li in-memory — answers silinince cache de
  anlamsızlaşır, ayrıca silinecek bir şey yok.
- **Landing'den temiz giriş:** `/journey` route'una `validateSearch` ile
  `?fresh` paramı eklendi. Landing hero CTA + FinalCTASection linkleri
  `search={{ fresh: true }}` taşır. Journey restore effect'i `fresh` görünce
  restore ETMEZ: önce reset, sonra Q1, sonra `replace` ile param URL'den
  düşer (böylece F5 yeni journey'yi normal restore eder). Tarayıcıda
  doğrulandı: `/journey?fresh=true` → temiz `/journey` Q1.
- **Journey içi "Start New Journey":** artık `resetJourneySession` çağırıyor
  (önceden Life Feed silinmiyordu — eski feed yeni journey'ye sızıyordu).
  Reveal fazı dahil her aşamada görünür/aktif (savedProgress true iken).
- **Results "Start Over — New Journey":** eski pasif "Start again" linki
  yerine her zaman aktif primary buton — reset + `/journey`'ye navigate.
  Boş storage'da results "No journey data available yet" gösterir
  (tarayıcıda doğrulandı).
- **Testler:** `reset-session.test.ts` (YENİ, 4 test): journey+feed silinir,
  dil korunur, userId'li yol da local'i siler (Supabase yokken best-effort),
  boş storage'da no-op.

**Bilerek korundu:** F5/sayfa yenilemede journey restore davranışı —
persistence ürün özelliği; sadece açık başlangıç noktaları (landing CTA,
Start Over, Start New Journey) sıfırlar.

## 2a. Önceki iş — Era-Adaptive Step-by-Step Card Flow + Organic Artwork + Full English (TAM, c46adf0 + 64f0dc8, push'lu)

Kullanıcı görevi 6 maddeliydi; tamamı uygulandı, gate'ler yeşil, tarayıcıda
uçtan uca doğrulandı:

1. **Full English:** feed bileşenlerindeki hard-coded Türkçe string'ler
   İngilizce'ye çevrildi (LifeFeedInput: "Which song is speaking for you
   today?", "Search songs", "Add to the Map", "Remove selection";
   LifeFeedTimeline: "Edit note"/"Save"/"Cancel"). Feed testleri güncellendi.
   Master Poster'ın life-card kopyası (`buildLifeCards({ locale: "en" })` +
   export'ta `lifeCardStringsFor("en")`) ve yeni reveal akışı English-only.
   i18n altyapısı/sözlükleri korundu — parity testleri hâlâ yeşil.
2. **Organik artwork (`src/components/results/OrganicArtwork.tsx` — YENİ):**
   Kapak artık düz kare thumbnail DEĞİL; sahneye gömülü: `vinyl-sleeve`
   (kılıftan çıkan oluklu plak + etiket), `cassette-desk` (J-card + makara
   penceresi + neon underglow), `vintage-poster` (katlanma çizgileri + raptiye
   + eskitilmiş kağıt tint), `framed-portrait` (paspartulu galeri çerçevesi +
   picture light). Hepsinde ortam ışığı: backdrop gradient "oda", screen-blend
   ışık yıkaması, era color grading — kapak sahnenin ışığıyla aydınlanıyor.
3. **Dinamik era/genre adaptasyonu (`src/lib/soundmap/eraStyle.ts` — YENİ,
   saf/deterministik):** `eraStyleFor(song, cardIndex)` → releaseYear
   onyılı mount+palette'i belirler (≤1979 vinyl/amber, 80s cassette/neon,
   90s poster/grunge, 2000+ portrait/galeri); genre keyword'leri
   (title/artist/album) accent'i override eder (metal crimson #b3122e, jazz
   brass, synth cyan, pop pink, folk moss, classical ivory); releaseYear
   yoksa kartın journey pozisyonu kullanıcının o dönemdeki yaşını temsilen
   mount seçer (çocukluk→vinyl, gençlik→cassette, 20'ler→poster, sonrası→
   portrait). `eraLabel` rozeti ("'90s") QuizCard başlığında. SANATÇI
   KÖKENİ/KÜLTÜR UYDURULMAZ — provider verisi yok; kodda belgelendi.
4. **Adım-adım akış (`src/components/journey/EraCardReveal.tsx` — YENİ +
   `src/routes/journey.tsx`):** onChoose / onSelectSuggestion / Next-with-
   draft → `setReveal(question.id)`; reveal fazında EraCardReveal render
   edilir ("Era N of 8" + QuizCard autoPlayPreview + "Next Era / Continue";
   8.'de "See Your Master Poster" → setCompleted + navigate /results).
   Continue reveal'ı unmount eder → audio singleton fade-out (mevcut
   useAudioPreview cleanup). startNewJourney reveal'ı da sıfırlar.
   Persistence davranışı değişmedi.
5. **Master Poster:** PosterCanvas grid'i QuizCard kullandığı için 8 kart
   otomatik olarak era-adaptive organik sahnelerle render ediliyor (her kart
   kendi şarkısının onyılına/genre'sine göre farklı sahne).
6. **Gate'ler:** tsc 0 hata, 315/315 (28 dosya), lint exit 0 (9 pre-existing
   uyarı), build exit 0. Tarayıcı smoke test: journey akışı canlıda
   doğrulandı.

**Bilerek kapsam dışı:** PNG canvas export (`poeticPoster.ts`) hâlâ eski
`drawHarmonizedArtwork` kare-crop tarzını kullanıyor — organik sahneler
DOM-only (canvas'a port etmek büyük iş, görev DOM kartlarını kapsıyordu).
`soundmap/` legacy bileşenleri (Wizard/Results/SongPicker/Waveform)
kullanılmıyor, dokunulmadı. `deterministicEntryInsight` en-only kalıyor.
Kültür adaptasyonu yalnızca era+genre sinyalleriyle (sanatçı kökeni
fabricate edilmez).

## 2b. Önceki iş — i18n tam çeviri + dinamik Gemini dili + prettier (TAM, 180ab4b, push'lu)

- es/de/fr quizCard + lifeCards gerçek çeviri; no-fallback testi.
- `buildEntryInsightPrompt` language parametresi; LifeFeed insight aktif dilde.
- Repo-geneli prettier; lint exit 0. 298 test.

## 2c. Önceki işler (commit'li ve push'lu)

- **iTunes hi-res artwork + MTG Life Cards** (2b3c8db): 600x600 artwork,
  8 era kartı 4×2 grid, harmonize shader, singleton useAudioPreview,
  renderMap iki geçişli dinamik yükseklik.
- **Supabase keep-alive cron** (152da7f): Vercel Cron → `/api/keep-alive`.
- **Gotik Müzik Haritası** (088535f'e kadar): 6 fazlı chapter yapısı,
  Hayat Ağacı, kemer portallar, Spotify deep link, dinamik tema motoru.

---

## 3. Olası sonraki adımlar

- ~~Bu oturumun değişikliklerini commit'leme~~ — PUSH TAMAM (kullanıcı
  onayıyla, ebbeb5f = origin/main).
- Organik sahneleri PNG canvas export'a port etme (poeticPoster.ts'de
  mount başına çizim) — büyük iş, ayrı görev.
- `deterministicEntryInsight` şablonlarını çokdilleştir (şu an en-only).
- 9 react-refresh uyarısını temizleme (ui/* export ayrıştırma) — düşük
  öncelik.

---

## 4. Karar ağacı

**🅐 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN
yeniden yaz, onaylıysa `checkpoint: ... — HANDOFF.md güncellendi` ile
commit et (onay yoksa değişiklikleri çalışma ağacında bırak ve bildir).

**🅑 Kart sahnesine dokunurken →** Stil kararları her zaman `eraStyleFor`
üzerinden (saf, deterministik); DOM sahneleri `OrganicArtwork.tsx`'te.
Yeni mount eklersen `SCENE_BY_MOUNT` + `eraStyle.test.ts` güncelle.

**🅒 Testler kızarsa →** `npm test`; jsdom hex renkleri rgb()'ye
normalize eder — stil assertion'larında rgb karşılığını kullan. Senkron
rAF mock'larında saati +1000ms ileri sar (yoksa fade recursion'ı stack
taşırır).

**🅓 Canvas export'a dokunurken →** Rastgelelik her zaman `seededRandom`
üzerinden; asla `Math.random()` kullanma. `return y + 300` (duality dibi)
kontratını bozma.

**🅔 i18n'e yeni string eklerken →** `en`'e ekle → diğer 4 dile kopyala →
key-parity testi otomatik yakalar. Era Card akışı English-only kalır
(tasarım kararı); sözlüğe bağlama.

---

## 5. Dikkat — bu oturumda öğrenilen

- **jsdom stil normalize eder:** `style.background` hex'i `rgb(r, g, b)`
  olarak döndürür — backdrop assertion'ları rgb'ye çevrilerek yapılmalı.
- **Senkron rAF mock tuzak:** `cb(performance.now())` fade ramp'ini sonsuz
  recursion'a sokar (saat ilerlemez, t<1 kalır, stack taşar). Mevcut
  useAudioPreview.test.tsx kalıbı: `cb(performance.now() + 1000)`.
- **Era başlığı iki yerde render edilir** (reveal heading + kart title
  bar) — testlerde `getAllByText`.
- **Reveal'da audio stop = unmount:** onContinue mock'u unmount etmez;
  testte açıkça `unmount()` çağırıp pause assertion'ı yapılır.
- Vitest sayacı: 298 → 315 (28 dosya).

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
  dış veri tek otorite. Sanatçı kökeni/kültürü UYDURMA (provider verisi yok).
