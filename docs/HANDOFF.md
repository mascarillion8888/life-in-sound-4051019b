# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      bu oturumun işi COMMIT'LENDİ ve PUSH TAMAM
           (literal SHA `git log -1` ile doğrulanır; git'e güven, metne değil).
Testler:   359/359 geçti (33 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Build:     `npm run build` = 0 hata (7 backdrop PNG bundle'da)
Lint:      `npm run lint` = 0 HATA (exit 0). 9 react-refresh uyarısı
           pre-existing (ui/* shadcn + PosterCanvas + LanguageContext).
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Re-open: "Backdrop Path & Vector Claim" (KAPANDI, kod değişikliği yok)

Kullanıcı re-open etti: "blue/purple vector boxes STILL render; path veya CSS
override sorunu" iddiası. Adli kanal:

1. **Served source curl:** `SceneRoom.tsx` runtime'da **2 span** (backdrop
   `background-image` + `glow gradient`) — sıfır BookRow/Shelf/DeskLamp JSX.
   `backgroundImage: url(${BACKDROPS[theme]})` import map'ten çözülür.
2. **Network probe:** `?import` endpoint `export default
   "/src/assets/room-backdrop-<theme>.png?t=…"` döner; raw endpoint HTTP 200
   ile ~470 KB PNG döner. Vite asset resolution sorunsuz.
3. **Test proof:** `[aria-hidden]` node sayısı <5 (nested furniture DOM vektörü
   yok); `backgroundImage` `room-backdrop-<theme>.<hash>.png` içerir →
   359/359 yeşil.

**Sonuç:** blue/purple bloklar DOM vektörü değil — procedural renderer'ın
çizdiği panel/shelf box'ları raster PNG'nin kendi içeriği. Kod değişikliği
yok; claim'i "asset path broken veya DOM fallback" olarak kapat. Eğer hâlâ
kalitesiz görünüyor, çözüm PNG'i **daha sarsıntılı/fotoğrafa yakın**
üretmek (generator refactor'ı), kod restore değil.

---

## 2a. Önceki iş — Dynamic Atmosphere Engine (genre/decade) (TAM)

Oda/backdrop backbone'u statik 4 temadan dinamik genre+decade matrisine
genişletildi. `SceneRoom` ve AI painting brief'i aynı aileyi çözer.

### Yeni aileler (4 → 7)

- **`scenePalettes.ts`:** `soul` (bal/amber soul-vinyl), `grunge` (slate/zeytin
  90s basement), `hiphop` (plum/violet + gold studio) eklendi; büyük/küçük
  palet anahtarları SceneThemeId union'ına taşındı. Generator
  (`npm run gen:room`) paletleri auto-iterate ettiği için 7 backdrop PNG
  tek komutla üretildi (`src/assets/room-backdrop-*.png`, ~450–510 KB).
- **`sceneThemeFor` (client, `src/lib/art/sceneTheme.ts`):** genre keyword
  aileleri yeniden sıralandı (soul ailesi ayrıldı — `soul/funk/motown/rnb/…`
  artık jazz'dan önce gelir; `funk` synth'ten soul'a alındı), `grunge` +
  `hiphop` aileleri eklendi. Genre yoktiebreak'ında **decade ladder**:
  ≤1969→jazz, ≤1979→soul, ≤1989→synth, ≤1999→grunge, 2000+→hiphop,
  null→gothic (`eraThemeFor` export). Eski "sadece 80s → synth" kısıtı
  kaldırıldı.
- **`cardArtwork.server.ts` (server mirror):** `SCENE_SPECS` aynı id'leri ve
  prompt'ları taşıyor (her aileye yeni prompt; cache discriminator olarak
  scene id aynı kalıyor). `cardArtworkScene` decade ladder'ı sunucu tarafında
  da aynı şekilde döndürür.
- **`SceneRoom.tsx`:** `BACKDROPS` 7 kayıt; runtime DOM vektörü yok,
  her tema kendi raster PNG'sini cover'lar.
- **Kart rozeti:** `eraStyleFor` zaten decade badge (`'70s/…/'10s`) + genre
  accent override'ı sağlıyor — bu özellik dokunmadan doğal entegre.

### Test ve kanıt

- Yeni/güncellenmiş testler: server (`cardArtworkScene` 3 yeni family +
  decade ladder), client mirror (`sceneThemeFor` family keyword + ladder,
  `eraThemeFor` saf decade tablosu), SceneRoom loop artık 7 temayı da
  traverse eder → **359/359**.
- Tarayıcı kanıtı (STATE.md kural 10), dev server 12000, `/journey?fresh=1`:
  1. **Smells Like Teen Spirit / Nirvana** → grunge oda (slate-zeytin raf),
     `'90s` rozeti, kapak ANINDA.
  2. **Respect / Aretha Franklin** → soul oda (amber bal raf + amber lamba
     yayılımı), `'60s` rozeti.
  3. **HUMBLE / Kendrick Lamar** → hiphop oda (plum/violet raf + gold
     artifact), `'10s` rozeti.

`359/359, tsc 0, lint 0, build 0.`

---

## 2a. Önceki iş — Gothic Wooden Frame Card (TAM)

Referans GothicEraCard tasarımı QuizCard'a taşındı: responsive `w-full max-w-md`,
lucide Shield/Music/Volume ikonları (emoji yok), dinamik sequence/score,
serif ahşap çerçeve. 356/356.

## 2b. Önceki iş — Rendered Room Backdrop + Artwork Hard-Guard (TAM)

Procedural PNG backdrop backbone, SceneRoom DOM vektörü YOK, cover
`onError` → skeleton.

## 2c. Önceki iş — Hybrid Fallback Restore (TAM, eski)

Punterly-graded kapak ANINDA + AI cross-fade + coverless skeleton.

## 2d. Önceki iş — STRICT NO-PHOTO FIX (TAM, eski)

Raw cover fallback kaldırılmıştı; hybrid restore ile geri alındı.

## 2e. Önceki iş — Global Card Design + Dynamic Copy (TAM, eski)

SceneRoom client mirror + dynamicCardText + hybrid fallback.

## 2f. Önceki iş — User/Genre-Adaptive AI Artwork (TAM, eski)

Sahne ailesi sinyal önceliği + cache disiplini.

---

## 3. Sıradaki iş adımları

1. Tema paleti değişirse: `npm run gen:room` (backdrop'lar yeniden üretilir).
2. `GEMINI_API_KEY` varsa AI painting katmanı yeni scene prompt'larından
   beslenir (cache eski scene id ile çoklu saat sayılabilir; anahtar scope
   `trackKey::scene`).
3. Grand Finale yönü (kartların cosmic poster grid'e unlock-merged geçişi)
   hâlâ tasarım onayı bekliyor.
4. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
5. HANDOFF tam rewrite + commit `checkpoint: ... — HANDOFF.md güncellendi`.

---

## 4. Olası tuzaklar

- Genre keyword sırası önem: soul ailesi (`soul/funk/motown`) jazz'dan önce;
  otherwise "soul" hiç yakalanmazdı (jazz eski `soul` keyword'u yutardı).
  `funk` synth'ten soul'a alındı — 70s funk artık neon değil bal ışık.
- Client `SCENE_KEYWORDS` ve server `SCENE_SPECS` manuel mirror; değişiklik
  iki tarafa da uygulanmalı (testler bu yüzden iki tarafta ladder assert'ü
  taşıyor).
- Decade ladder null year → gothic (kültür uydurmamak); yıl varsa her bucket
  kendi kimliği.
- `pngjs` yalnız generator (devDependency); `gen:room`
  `--experimental-strip-types` ile `.ts` import eder (Node 22 gerektirir).
- Dev server bu oturumda 12000 portunda çalıştı; kapatılması gerekmiyorsa
  dursun (UI doğrulaması için yeniden başlat).
