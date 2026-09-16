# Life in Sound — Visual System Architecture (Visual DNA, Reference Library, Visual AI, Asset Registry)

> **Statü:** CANONICAL mevcut + hedef görsel mimarisi. Kanonik üst katman için
> [ARCHITECTURE.md](./ARCHITECTURE.md) — bu dosya, Visual System'in derin tarifidir.
> Hiçbir şey Production kodu değildir; etiketler (§0) her bölümde açıktır.
> **DOCUMENTATION-ONLY güncelleme** — uygulama kodu, test, config, `.env`, `settings.json`,
> deployment değişmedi.

---

## 0. Kapsam ve Durum Etiketleri

Bu doküman yalnızca **Visual System**'i anlatır. Etiketler: **CURRENT / IMPLEMENTED**,
**LOCKED DECISION**, **PROPOSED**, **FUTURE** (anlam: [ARCHITECTURE.md §0](./ARCHITECTURE.md#0-durum-etiketleri)).

Ana mimari ayrım (LOCKED):
- **Music System** (Music DNA + mood inference + story/reflection) görsel ÜRETMEZ. → [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-music-system)
- **Visual System** aşağıda tarif edilir: VisualDNA → Visual Profile → Resolver → VisualSpec →
  Reference Library → Visual AI → Asset Registry → Resolver → APP.

---

## 1. Visual DNA (PROPOSED — tek sistem olarak kodda YOK)

**Visual DNA, Music DNA'nın görsel karşılığıdır.**
- Music DNA → "kullanıcının seçtiği müzik, müzikal DESEN hakkında ne söylüyor?"
- Visual DNA → "o müzikal/özellik desenini HANGİ görsel dil temsil etmeli?"

Visual DNA **kişilik analizi DEĞİLDİR**; bir **art-direction temsilidir.** Terapi/teşhis/psikoloji dışındadır.

Bugün Visual DNA'nın kapsayabileceği BOYUTLAR (tamamı mevcut kodda bulunmak zorunda değil; mimaride TANIMLI olması önemlidir):

```
Style Core        — değişmez marka/görsel çekirdek (Life in Sound kimliği)
Era               — dönemsel art-direction (eraThemes.ts: deka→palet overlay)
Genre             — tür görsel sözlüğü (SCENE_SPECS: 7 aile; posterTheme)
Mood              — 9 kapalı mood (MOOD_SET) → görsel davranış modu
Life Stage        — hayat dönemi bağlamı (Journey aşamaları; cardBlueprint life-stage room)
Cultural Context  — bölge/kültür art-direction (şimdi yok; ileride)
Lighting          — ışık dili (posterTheme atmosphere; cardBlueprint lighting)
Texture           — doku/medium dili (cardBlueprint; dynamicThemes texture)
Depth             — mekânsal derinlik kompozisyonu (OrganicArtwork)
Object Vocabulary — sahnedeki nesne sözlüğü (cardBlueprint objects; eraStyle mounts)
Composition       — kompozisyon dili (OrganicArtwork; MasterPosterSheet)
UI Safe Area      — güvenli/güvenli-görsel alan (UI kısıtı; şimdi yok)
Crop / aspect     — kırpma/en-boy kuralları (card 1:1, poster 2:3, background 16:9)
```

**Durum: PROPOSED.** Kodda dağınık parçalar vardır (yukarıdaki bağıntılar), ama "Visual DNA" adında
ve Standard üzerinde UNIFIED kavram kanonik düzeyde YOKTUR. Bu doküman, tek sistem olarak TANIM'dır.

---

## 2. VisualProfile (PROPOSED — kodda yok)

Visual Intelligence'ın çıktısı. Music DNA (+era/genre/mood/scene/context + visual constraints) →
**VisualProfile**:

```text
VisualProfile {
  era direction          (dönem yönü)
  genre direction        (tür yönü)
  mood family            (mood ailesi)
  environment            (mekân/ortam)
  composition language   (kompozisyon dili)
  lighting language      (ışık dili)
  palette tendency       (palet eğilimi)
  texture/material lang  (doku/material dili)
  object vocabulary      (nesne sözlüğü)
  reference family       (referans ailesi)
  variation constraints  (varyasyon sınırları)
}
```

> NOT: ANA_YASA §9 "Song'a derived alan ekleme" yasağının ruhu gereği VisualProfile bir
> SONG alanı DEĞİLDİR; ayrı bir türetme katmanıdır. Bu doküman YALNIZCA kavram tanımlar, kod değil.

---

## 3. Visual Resolver (FUTURE — kodda yok; kavramsal)

**Sorumluluk:** VisualProfile'dan görsel KESİNLİKLERİ belirler → **VisualSpec**:

- visual vocabulary, composition, lighting, atmosphere, palette direction, objects,
  environment, **reference family**, **mood variation rules**

**ZORUNLU davranış:** Resolver **runtime'da GPT Image ÇAĞIRMAZ.** Yalnızca kayıtlı/onaylı
asset'ler arasından seçim/kompozisyon yapar ve fallback hiyerarşisi tanımlar:

```text
Song Metadata → Era/GENRE/Mood/Life-Stage → Visual Resolver
     → Exact approved asset → Fallback hierarchy → APP
```

---

## 4. Reference Library (FUTURE — kodda yok; kavramsal)

Proje, her `era × genre × mood` kombinasyonu için elle/ayrı asset üretmeye dayanmamalıdır.
Bunun yerine Reference Library **kontrollü görsel anchor'lar** içerir:

- era references
- genre references
- location/environment references
- composition references
- lighting references
- object vocabulary
- texture/material references
- photographic / art-direction references

**Kritik prensip:** Referanslar SON KULLANICIYA YÖNELİK nihai asset DEĞİLDİR; Visual AI için
**görsel grounding materyalidir.** Anlamı:

- ✅ "bunun GÖRSEL DİLİ/TUN/Stil'i referans al" (style guidance / benchmark)
- ❌ "bunun AYNISINI üret" (kopyalama değil)

Amacı: yeni özgün üretimi yönlendirmek.

```text
REFERENCE IMAGE → Visual characteristics → Visual DNA → new original generation
```

---

## 5. Visual AI (LOCKED DECISION / FUTURE — ayrı katman olarak gerçeklemesi yok)

Şu an ayrı ve birleşik bir Visual AI katmanı YOKTUR. Bu doküman hedefi TANIMLAR.

```text
Reference Images
  +
Visual DNA
  +
Era + Genre + Mood + Life Stage
        ↓
      VISUAL AI
        ↓
      GPT IMAGE
        ↓
Mood / Visual Variations
```

**Mimari olarak:** Visual AI, `VisualSpec + onaylı referans görseller → Generated Visual Variant`
üretir. Bu, Music AI ile AYNI SORUMLULUĞU TAŞIMAZ:
- Music AI sertifika FİZİKSEL/semantik analiz yapar (görsel değil).
- Visual AI yalnızca art-direction temsilini görsel materyale çevirir; müziği yeniden yorumlamaz.

---

## 6. GPT IMAGE Rolü & Provider Adapter (FUTURE — bugün implemente DEĞİL)

GPT Image, hedef Visual AI teknolojisidir. **Ancak:**

> ⚠️ Şu an UYGULANMAZ: API çağrısı YOK, environment variable YOK, production kodu YOK.

Bu repoda `cardArtwork.server.ts` Imagen→Gemini→HF kullanır (CURRENT, mevcut bir çizgi). GPT Image
henüz hiçbir kodda yoktur.

Hedef (FUTURE): provider'ı Music DNA / Visual Intelligence'a DOKUNMADAN DEĞİŞTİRMESİNE OLANAK VEREN
adapter modeli:

```text
VisualSpec → provider adapter → image generation model
```

Yani sistem tek bir provider'a sıkı bağlanmaz; GPT Image şu an "FUTURE / PLANNED VISUAL AI
GENERATION LAYER" olarak etiketlenir.

---

## 7. Mood Variation Modeli (PROPOSED)

**Prensip:** Bir visual universe birden çok mood ifadesi üretebilir.

```text
1980s + Pop (aynı visual universe)
   → melancholic, nostalgic, euphoric, intimate,
     restless, hopeful, reflective, ...
```

**Hedef:** 9 tamamen bağımsız asset koleksiyonu DEĞİL; aynı universe içinde varyasyon:

```text
BASE VISUAL UNIVERSE
  *
MOOD DELTA
  ↓
VISUAL VARIANT
```

Mood, şunları değiştirir (kimliği koruyarak): *lighting, contrast, atmosphere, color tendency,
framing, density, emotional spatial quality, texture, visual tension.* Altta yatan görsel
kimlik (base universe) korunur.

---

## 8. Asset Registry (FUTURE — kodda yok; kavramsal metadata modeli)

Mimari, üretilen görsellerin YALNIZCA dosya olması yerine **metadata ile yönetilmesini** hedefler.

Toplam 3 asset türü ayrılır:
- **Reference Asset** — generation'ı YÖNLENDİRİR (grounding).
- **Generated Asset** — Visual AI tarafından ÜRETİLİR.
- **Runtime Asset** — uygulama tarafından SEÇİLİR/RENDER edilir.

Kavramsal **AssetSpec / Registry** metadata modeli (kod değil):

```
asset_id
asset_type            (reference | generated | runtime)
reference family
era
genre
mood compatibility
visual vocabulary
composition
lighting
atmosphere
source/provider
generation metadata   (model, prompt_version, seed, timestamp)
version
status                (draft | candidate | approved | rejected)
```

Hedef: üretim — QA/onay — katalog — runtime seçim döngüsünü izlenebilir kılmak.

---

## 9. Final Target Pipeline (Visual System perspektifinden)

```text
USER SONGS
  ↓
MUSIC AI                 (CURRENT)
  ↓
FACT → INTERPRETATION → PATTERN
  ↓
MUSIC DNA + MOOD/SEMANTIC SIGNALS
  ↓
VISUAL INTELLIGENCE         (PROPOSED)
  ↓
VISUAL DNA / VISUAL PROFILE (PROPOSED)
  ↓
VISUAL RESOLVER             (FUTURE — runtime, GPT Image ÇAĞIRMAZ)
  ↓
VISUAL SPEC                 (PROPOSED/FUTURE)
  ↓
REFERENCE LIBRARY + REFERENCE IMAGES   (FUTURE)
  ↓
VISUAL AI                   (LOCKED DECISION / FUTURE)
  ↓
GPT IMAGE / PROVIDER ADAPTER (FUTURE — bugün yok)
  ↓
GENERATED VISUAL VARIANT     (FUTURE)
  ↓
ASSET REGISTRY               (FUTURE)
  ↓
POSTER / CARD / STORY VISUALS
```

---

## 10. Combinatorial Asset Problemi (çözüm prensibi, PROPOSED/LOCKED)

Aşağıdaki devasa sabit matrisin OLUŞTURULMAMASI gerektiği ilkesi LOCKED karardır:

```text
13 eras × 15 genres × 9 moods × life stages × culture  →  YASAK (sabit matris)
```

Bunun yerine hedef:

```text
Visual DNA
  +
Composable visual rules
  +
Mood variation (base universe × mood delta)
  +
Resolver
```

(Ayrıca ANA_YASA §5.2 "kartezyen çarpım YASAK" ilkesiyle birebir uyumlu.)

---

## 11. Current Implementation (dürüst açıklama — CURRENT / IMPLEMENTED)

Mevcut kodda görsel ilgili PARÇALAR vardır ama **birleşik Visual DNA / Visual Resolver mimarisi
OLARAK TAMAMLANMAMIŞTIR.** Aşağıdakiler CURRENT/IMPLEMENTED olup yukarıdaki hedef kavramların
KISMİ öncülleridir; bunları "tamamlanmış hedef mimari" sanmayın.

| Dosya | Açıklama | Statü |
|---|---|---|
| `src/lib/visual/eraThemes.ts` | deka→palet overlay (era) | CURRENT |
| `src/lib/art/cardArtwork.server.ts::SCENE_SPECS` | 7 genre ailesi art-direction | CURRENT |
| `src/lib/ai/moodInference.ts::MOOD_SET` | 9 kapalı mood | CURRENT |
| `src/lib/art/cardBlueprint.ts` | multidim görsel brief (era×genre×memory/object vocab, deterministicLore) | CURRENT |
| `src/lib/soundmap/posterTheme.ts` | genre/era/duygu→metal/atmosfer/arka plan | CURRENT |
| `src/components/results/OrganicArtwork.tsx` | composition render dili | CURRENT |
| `src/lib/art/{hfImage,useCardArtwork}.ts` | runtime üretim (tag Imagen→Gemini→HF) + cache (server/localStorage) | CURRENT |
| `src/assets/room-backdrop-*.png` + `scripts/generate-room-backdrop.mjs` | statik background asset'ler | CURRENT |

> **Açık mimari not:** `cardArtwork` şu an **runtime görsel ÜRETİMİ** yapıyor.
> Hedef mimari, daha kontrollü bir Visual AI / üretim sınırı (adapter + Asset Registry +
> runtime Resolver) getirir. İki gerçek karıştırılmaz: mevcut runtime üretimi CURRENT,
> hedef kontrollü sınır FUTURE.

---

## 12. Sorumluluk Ayrımları (LOCKED doküman bölümü)

Özetle, dört ayrı görsel sorumluluk:

1. **Music AI** — FACT→MUSIC DNA→MOOD; görsel üretmez. *(CURRENT)*
2. **Visual Intelligence** — Music DNA+constraints → VisualProfile. *(PROPOSED)*
3. **Visual Resolver** — VisualProfile → VisualSpec (runtime, GPT Image yok). *(FUTURE)*
4. **Visual AI** — VisualSpec + approved references → generated visual (provider adapter). *(FUTURE)*

Birbirine karıştırılmaması esastır. Özellikle: Visual AI, Music AI ile aynı sorumluluğu taşımaz.

---

_Son güncelleme: Hermes — 2026-09-16 (DOCUMENTATION-ONLY; kod/test/config/.env/deploy değişmedi)._