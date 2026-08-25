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
Testler:   356/356 geçti (33 dosya; wood-frame design contract testi yeni)
tsc:       temiz (`npm run typecheck` = 0 hata)
Build:     `npm run build` = 0 hata (Nitro + postbuild-vercel-spa OK)
Lint:      `npm run lint` = 0 HATA (exit 0). Kalan 9 react-refresh uyarısı
           (ui/* shadcn + PosterCanvas.tsx + LanguageContext.tsx)
           pre-existing, kabul edilebilir.
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Gothic Wooden Frame Card (TAM)

Kullanıcı tarafından referans `GothicEraCard` tasarımı teslim edildi;
`QuizCard` o tasarım dili + düzeltmelere (wooden gallery frame) taşındı:

### Tasarım dili (referanstan entegre edildi)

- **Çok boyutlu ahşap çerçeve:** `border-4 border-[#8b7355]` oyma kenar,
  `bg-[#1c1815]/95`, `font-serif`, katmansal gölge (derinlik + amber
  parlaması + iç çukur) — "treasured framed photograph" hissi.
- **Responsive:** sabit `w-[380px]` yerine `w-full max-w-md` (parent
  grid/EraCardReveal içinde sorunsuz yayılır).
- **Lucide ikonları (emoji YOK):** kategori şeridinde `Shield`, metadata
  footer'ında `Music`; audio toggle `Volume2/VolumeX` — referans
  komponentteki 🛡️/🎵 glyph'leri kaldırıldı.
- **Dinamik prop'lar:** sequence (`58/100` gibi `copy.sequence`), score
  (`copy.score/10`), era rozeti, yaş rozeti — hiçbiri hardcoded değil.
  (Referanstaki `contract-110` geçersiz sınıfı düzeltildi; bizim filtre
  pipeline'ı zaten `era.grading` CSS string'ini kullanıyor.)
- **Aspect**: artwork penceresi referanstaki `aspect-[4/3]` oranını taşıyor.

### Audio (30s iTunes preview)

`useAudioPreview` singleton hook'u zaten bağlıydı: `EraCardReveal`
`autoPlayPreview` ile mount anında fade-in dener; audio toggle artwork
penceresinde `Volume2/VolumeX` ile. Entegrasyon değişmedi, davranış aynı.

### Test ve kanıt

- Yeni test: wood-frame contract (font-serif, max-w-md, `#8b7355` border,
  Shield svg motif) → **356/356**.
- Tarayıcı kanıtı (STATE.md kural 10): dev server 12000 →
  `/journey?fresh=1` → "Fragile Sting" commit → Era 4 reveal:
  serif başlık, `58/100` sequence + `'80s` + `AGES 18-22` rozetleri,
  Sting kapak painterly graded olarak ANINDA, `Shield` ikonu sertifitede,
  `Music` ikonlu footer — synth wood backdrop üzerinde.

`356/356, tsc 0, lint 0 (9 pre-existing uyarı), build 0.`

---

## 2a. Önceki iş — Rendered Room Backdrop + Artwork Hard-Guard (TAM)

Procedural PNG backdrop (`gen:room`), SceneRoom DOM vektörü YOK,
cover `onError` → skeleton, bare Music ikonu kaldırıldı.

## 2b. Önceki iş — Hybrid Fallback Restore + Oda Derinlik Pass (TAM, eski)

Punterly-graded kapak ANINDA + AI cross-fade + coverless skeleton.

## 2c. Önceki iş — STRICT NO-PHOTO FIX (TAM, eski)

Raw cover fallback kaldırılmıştı; sonraki kararla hybrid restore.

## 2d. Önceki iş — Global Card Design + Dynamic Copy (TAM, eski)

SceneRoom client mirror + dynamicCardText + hybrid fallback.

## 2e. Önceki iş — User/Genre-Adaptive AI Artwork (TAM, eski)

4 sahne ailesi + sinyal önceliği + cache disiplini.

## 2f. Önceki iş — Organic Art Style Transfer (TAM, eski)

feTurbulence warp + paper tooth + palette-accent wash.

---

## 3. Sıradaki iş adımları

1. Tema paletleri değişirse: `npm run gen:room` (backdrop'lar yeniden üretilir).
2. `GEMINI_API_KEY` sağlanınca AI painting katmanı fade-in ile üstte; keyless
   ortamlarda skeleton/painterly kapak kalır.
3. Grand Finale yönü: PosterCanvas kartlarını cosmic poster grid'e "unlock+
   merge" geçişiyle bağlamak — Tasarım onayı gerekli (bir sonraki oturumda
   kullanıcıyla konuş).
4. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
5. HANDOFF tam rewrite + commit `checkpoint: ... — HANDOFF.md güncellendi`.

---

## 4. Olası tuzaklar

- QuizCard artık serif font + 4/3 artwork penceresi; PosterCanvas grid
  (`grid-cols-2 lg:grid-cols-4`) kartları daraltır — kart kendinden
  `max-w-md` ama parent daraltır; beklenen davranış.
- Song null ise sequence gösterilmez (age badge kalır) — bilinçli.
- SceneRoom runtime'da DOM vektör YOK; backdrop PNG render'ı.
- `pngjs` yalnız generator (devDependency); `gen:room` Node
  `--experimental-strip-types` gerektirir.
