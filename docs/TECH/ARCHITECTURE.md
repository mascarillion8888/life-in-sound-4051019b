# Life in Sound — Technical Architecture (canonical)

> **Statü: AKTIF STANDART — repository mimarisinin TEK kaynağı.**
> Bu dosya, mevcut (IMPLEMENTED) mimari ile hedef (PROPOSED / FUTURE) mimariyi ayırır ve
> Life in Sound'un iki ana AI sistemini (MUSIC SYSTEM, VISUAL SYSTEM) tarif eder.
> Derin ayrıntı için: [VISUAL_ARCHITECTURE.md](./VISUAL_ARCHITECTURE.md) (görsel sistem)
> ve kod içi yorumlar. Bu dosya ile kod çelişirse KOD ESAS alınır (bkz. ANA_YASA §0).
>
> **Kaynak:** READ-ONLY audit (2026-09-16) — gerçek HEAD `ef27814`, working tree temiz.
> Bu dosya DOCUMENTATION-ONLY güncellemeyle oluşturuldu; hiçbir uygulama kodu değişmedi.

---

## 0. Durum Etiketleri (bu doküman boyunca geçerli)

| Etiket | Anlam |
|---|---|
| **CURRENT / IMPLEMENTED** | Şu an üretim kodunda çalışıyor (doğrulanmış). |
| **LOCKED DECISION** | Mimari karar olarak ALINMIŞ; dokümana işlenmiş; kod düzeyi CANLI veya planlı. |
| **PROPOSED** | Yön kararı net; henüz kodda tam sistem yok; üzerine gelecek fazda inşa edilecek. |
| **FUTURE** | Amaca uygun ve vizyon olarak onaylı; şu an hiç yok, ileride inşa edilecek.


## 1. Ürünün İki Sistemli Modeli

Life in Sound, **birbirinden bağımsız iki AI sistemi** olarak modellenir.
Bu ayrım mimarinin değişmez ilkesidir (bkz. §8 prensipler).

```text
                    LIFE IN SOUND
                         │
            ┌────────────┴────────────┐
            │                         │
       MUSIC SYSTEM              VISUAL SYSTEM
            │                         │
       ┌────┴────┐              ┌─────┴─────┐
       │         │              │           │
   Music DNA  Music Memory  Visual DNA  Reference Library
       │         │              │           │
       └────┬────┘              └─────┬─────┘
            │                         │
         MUSIC AI                 VISUAL AI
            │                         │
       ┌────┼────┐              ┌─────┼─────┐
       │    │    │              │     │     │
     Story Pattern Reflection Generate Edit Variation
                                      │
                                      ↓
                                  GPT IMAGE
                                      │
                                      ↓
                               Candidate Visuals
                                      │
                                      ↓
                                     QA
                                      │
                                      ↓
                              Approved Assets
                                      │
                                      ↓
                               Asset Registry
                                      │
                         ┌────────────┘
                         ↓
                  Visual Resolver
                         │
                         ↓
                        APP
```

**Soru (mimari olarak çözüldü):**
> "Her mood/genre/era kombinasyonu için elle üretilmiş geniş asset koleksiyonu yerine,
> kontrollü bir referans-görsel kütüphanesi kullanan ve GPT image generation ile bu
> referanslardan görsel varyasyonlar üreten AYRI bir Visual AI katmanı olmalı mı?"

**CEVAP: EVET — AYRI VISUAL AI KATMANI** (LOCKED DECISION).

- Görsel üretim, Music DNA / mood inference / story generation / poetic analysis / uygulama
  UI'ından KAVRAMSAL OLARAK ayrıdır.
- **Music System**, semantik/yaratıcı girdileri belirler (FACT→INTERPRETATION→PATTERN→Music DNA→mood).
- **Visual System**, bu girdileri bir görsel şartnameye (VisualSpec) dönüştürür.
- **Visual AI katmanı**, kontrollü referanslardan görsel materyal üretmekten sorumludur.

Bu yanıt, devasa sabit asset matrisi üretme hatasına düşmeyi önler (bkz. §7 ve
VISUAL_ARCHITECTURE §4 "Combinatorial problem").

---

## 2. MUSIC SYSTEM (CURRENT / IMPLEMENTED — KORUNACAK)

Music System **yeniden tasarlanmaz**. Mevcut mimari hedefle zaten uyumludur. Aşağıdakiler
**CURRENT / IMPLEMENTED** ve **LOCKED**'tır:

- FACT → INTERPRETATION → PATTERN → Music DNA (`src/engine/musicDnaEngine.ts`).
- Music DNA kullanıcı girdilerinden (Song[], LifeContext[]) türetilir; AI kişisel gerçek uydurmaz
  (ANA_YASA §0).
- Story / Reflection / Grounded Analysis ayrı sorumluluklardır
  (`lifeStoryEngine.ts`, `personalityScoring.ts`+`emotionAnalyzer.ts`+`posterModel.ts`+`poetic-analyzer.ts`,
  `pipeline.ts`).
- Mood inference `temp 0`, 9 kapalı mood seti, bilinmeyende `null` (`moodInference.ts`/`.server.ts`).
- **8× mood-inference fix** (render-driven tekrar çağrı düzeltmesi) **dokunulmaz**:
  `results.tsx` songs content-fingerprint + `pipeline.ts` `groundedMemo` (content-keyed) +
  `contextText` fingerprint parçası + `__resetGroundedMemo` test izolasyonu + regresyon testleri.
  Bunlar CURRENT / IMPLEMENTED, değiştirilmeyecek.
- LLM köprüsü `src/lib/openrouter.server.ts` (OpenRouter; fallback zincirli) +
  `src/lib/llm/orchestra.ts` (Story/summarizer). Key'ler server-only.

Mevcut deterministik görsel şablonlar (music tarafının görsel kısmının CANLI kısmı):
`posterRenderer.ts`, `posterTheme.ts`, `dynamicThemes.ts`, `eraThemes.ts`, `OrganicArtwork.tsx`,
`MasterPosterSheet/Canvas`. Bunlar Music System'in görsel YANSITMALARI'dır; ayrı Visual AI katmanı değildir.

---

## 3. MİMARİ AYRIM: Music AI vs Visual Intelligence vs Visual Resolver vs Visual AI

Aşağıdaki 4 sorumluluk ayrı olmalı ve ayrı dokümante edilmelidir. **Music AI görsel ÜRETMEZ;
Visual AI müziği YENİDEN YORUMLAMAZ.**

### 3.1 Music AI
**Sorumluluğu:** `FACT → INTERPRETATION → PATTERN → Music DNA → MOOD / semantik sinyaller`.
Görsel üretmez. (CURRENT / IMPLEMENTED — §2.)

### 3.2 Visual Intelligence (PROPOSED — henüz ayrı katman olarak kodda yok)
**Sorumluluğu:** Music DNA + era + genre + mood + scene/context + visual constraints →
**VisualProfile**. Müziğin semantik çıktısını art-direction temsiline DÖNÜŞTÜRÜR.

### 3.3 Visual Resolver (FUTURE — kodda yok)
**Sorumluluğu:** VisualProfile'dan görsel kesinlikleri belirler: *visual vocabulary, composition,
lighting, atmosphere, palette direction, objects, environment, reference family, mood variation
rules* → **VisualSpec**. Runtime'da GPT Image ÇAĞIRMAZ.

### 3.4 Visual AI (LOCKED DECISION / FUTURE — üretim gerçeklemesi yok)
**Sorumluluğu:** VisualSpec + onaylı referans görselleri → generated visual material.
Kavramsal olarak: `Reference Library + VisualSpec + GPT Image model → Generated Visual Variant`.
Provider değiştirilebilir bir adapter arkasında olmalıdır (§6 / VISUAL_ARCHITECTURE §6),
Music DNA / Visual Intelligence'a dokunmadan image-generation provider'ı değiştirilebilir.

---

## 4. MİMARİ KARAR TABLOSU

| Alan | Current State | Target State | Status |
|---|---|---|---|
| Music DNA | Implemented | Preserve | LOCKED |
| Music System (FACT→Interpretation→Pattern) | Implemented | Preserve | LOCKED |
| 8× mood-inference fix + grounded memo + contextText | Implemented | Preserve | LOCKED |
| Mood inference | Implemented | Preserve | LOCKED |
| Visual DNA | Distributed concepts (eraThemes, SCENE_SPECS, MOOD_SET, cardBlueprint, posterTheme, OrganicArtwork) | Unified VisualProfile | PROPOSED |
| Visual Intelligence | Missing as separate layer | VisualProfile üretici | PROPOSED |
| Visual Resolver | Missing | VisualSpec generation (runtime, GPT Image çağırmaz) | FUTURE |
| Reference Library | Missing | Controlled visual anchors | FUTURE |
| Asset Registry / AssetSpec | Missing | Metadata / asset lifecycle | FUTURE |
| Visual AI | Missing as unified layer | Separate generation layer | LOCKED / FUTURE |
| GPT Image | Not implemented | Provider behind adapter | FUTURE |
| Mood variation | Distributed concepts | Base visual universe × mood delta | PROPOSED |
| Runtime generation | Existing cardArtwork (Imagen→Gemini→HF) | Controlled generation boundary | FUTURE |

> Etiketler, audit'in kanıtladığını yansıtır: görsel tarafta şu an "LOCKED" olan yalnızca
> "AYRI VISUAL AI KATMANI OLSUN" yön kararıdır; Visual DNA/Resolver/Registry/GPT Image henüz LOCKED değil.

---

## 5. ARCHITECTURE PRINCIPLES

1. Music semantics ve visual generation AYRI sistemlerdir.
2. Music DNA görsel ÜRETMEZ.
3. Visual AI kullanıcının müziğini YENİDEN YORUMLAMAZ (yalnızca art-direction temsilini kullanır).
4. Referans görseller görsel GROUNDING sağlar; "bunun aynısını üret" değildir.
5. Bir visual universe birden çok mood ifade edebilir (base universe × mood delta).
6. Mood, görsel kimliği YOK ETMEZ, yalnızca görsel ifadeyi DEĞİŞTİRİR (ışık/kontrast/atmosfer/
   renk eğilimi/çerçeve/yoğunluk/doku/görsel gerilim).
7. Üretilen asset'ler metadata ile İZLENEBİLİR olmalıdır (Asset Registry).
8. Image-generation provider'ları değiştirilebilir kalmalıdır (adapter).
9. Runtime generation AÇIK bir mimari sınır GEREKTİRİR (Visual AI bundan sorumludur; Music System değil).
10. Visual architecture, personality/terapi/teşhis ANALİZİNE DÖNÜŞMEMELİDİR — art-direction temsilidir.
11. Mevcut Music System davranışı STABİL kalmalıdır (yeniden tasarlanmaz).
12. Mimari dokümantasyon, implement edilmiş davranışı gelecek tasarımdan HER ZAMAN ayırmalıdır.

---

## 6. NİHAİ TARGET PIPELINE (hedef; current değil)

```text
USER SONGS
  ↓
MUSIC AI                     (CURRENT)
  ↓
FACT → INTERPRETATION → PATTERN
  ↓
MUSIC DNA                    (CURRENT)
  ↓
MOOD / SEMANTIC SIGNALS      (CURRENT — mood inference)
  ↓
VISUAL INTELLIGENCE          (PROPOSED)
  ↓
VISUAL DNA / VISUAL PROFILE  (PROPOSED)
  ↓
VISUAL RESOLVER              (FUTURE — runtime, GPT Image çağırmaz)
  ↓
VISUAL SPEC                  (PROPOSED/FUTURE)
  ↓
REFERENCE LIBRARY + REFERENCE IMAGES   (FUTURE)
  ↓
VISUAL AI                    (LOCKED DECISION / FUTURE gerçekleme)
  ↓
GPT IMAGE / PROVIDER ADAPTER (FUTURE — bugün implemente DEĞİL)
  ↓
GENERATED VISUAL VARIANT     (FUTURE)
  ↓
ASSET REGISTRY               (FUTURE)
  ↓
POSTER / CARD / STORY VISUALS
```

Bu **target mimaridir**, mevcut durum değil. Mevcut durum ile arasındaki farklar
[§7 TARGET vs CURRENT](#7-target-vs-current) ve [VISUAL_ARCHITECTURE.md](./VISUAL_ARCHITECTURE.md) bölümlerinde açıktır.

---

## 7. TARGET vs CURRENT (dürüstlük korunur)

Mevcut repoda görselle ilgili PARÇALAR vardır:
- `src/lib/visual/eraThemes.ts` (era→palet overlay)
- `src/lib/art/cardArtwork.server.ts::SCENE_SPECS` (genre aileleri; Imagen→Gemini→HF üretimi)
- `src/lib/ai/moodInference.ts::MOOD_SET` (9 kapalı mood)
- `src/lib/art/cardBlueprint.ts` (multidim görsel brief: era×genre×memory/object vocab)
- `src/lib/soundmap/posterTheme.ts` (genre/era/duygu→metal/atmosfer)
- `src/components/results/OrganicArtwork.tsx` (composition)
- `src/lib/art/{hfImage,useCardArtwork}.ts` (runtime üretim + cache)
- `src/assets/room-backdrop-*.png` + `scripts/generate-room-backdrop.mjs` (statik background asset)

Ancak bunlar **dağınık mekanizmalardır, henüz birleşik Visual DNA / Visual Resolver mimarisi DEĞİLDİR**.
Ayrıca **`cardArtwork` şu an runtime görsel üretimi YAPIYOR** (Imagen→Gemini→HF); hedef mimari ise daha
kontrollü bir Visual AI / üretim sınırı getirir. Bu iki gerçek karıştırılmaz: bunların tamamı
mevcut/implemented düzeyidir; placeholder'lar değil.

Mevcut düzeyi "tamamlanmış mimari" olarak betimlemedik. Kod-vs-tasarım ayrımı her bölümde korunur.

---

## 8. Referanslar

- Doküman: bu dosya (kanonik) + [VISUAL_ARCHITECTURE.md](./VISUAL_ARCHITECTURE.md) (görsel derin daldırma).
- Karar kaydı: `STATE.md` → KARARLAR; `docs/HANDOFF.md` (anlık durum); `docs/ANA_YASA.md` (değişmez kurallar).
- Audit: `C:\Users\frontoffice\LifeInSound_ARCHITECTURE_AUDIT.md` (read-only, 2026-09-16).

_Son güncelleme: Hermes — 2026-09-16 (DOCUMENTATION-ONLY; hiçbir uygulama kodu/test/config/.env/deploy değişmedi)._