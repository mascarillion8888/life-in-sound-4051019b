# 🏗️ SoundMap (Life in Sound) — Technical & Visual Architecture

> **Document Version:** 1.0.0  
> **Target Path:** `docs/ARCHITECTURE.md`  
> **Status:** Active Standard  

---

## 1. System Overview & Vision

**SoundMap**, kullanıcıların müzik geçmişini yalnızca listelemekle kalmayan, seçilen gerçek şarkılar üzerinden **Music DNA**, **Life Story** ve **Visual Multiverse** katmanlarını işleyerek kişisel bir müzik biyografisi çıkaran full-stack web uygulamasıdır.



### Core Value Proposition
> *"We don't just show what you listened to. We show where that music lived in your life."*

### Analytical & Visual Pipeline Blueprint

```text
               8 REAL SONGS (Song[])
                         +
            8 LIFE CONTEXTS (Q1..Q8 Answers)
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
┌───────────────────────┐     ┌───────────────────────┐
│   MUSIC DNA ENGINE    │     │   PERSONAL CONTEXT    │
│  - Temporal Pattern   │     │ - Life Stage          │
│  - Musical Identity   │     │ - First Spark         │
│  - Genre & Emotion    │     │ - Emo-Location        │
└───────────┬───────────┘     └───────────┬───────────┘
            │                             │
            └──────────────┬──────────────┘
                           ▼
              ┌─────────────────────────┐
              │  VISUAL PROFILE ENGINE  │
              │  - Identity & Behavior  │
              │  - Atmosphere & Motifs  │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │     VISUAL RESOLVER     │
              │ - Background (World)    │
              │ - Card (Artifact)       │
              └────────────┬────────────┘

---

##2. Technical Stack & Data Contracts

###2.1 Core Stack

- **Framework:** React / Vite / TypeScript
- **State & Persistence:** LocalStorage + Journey Storage Architecture
- **External APIs:** iTunes Search & Preview API
- **Backend Services:** Supabase (Auth, RLS, Storage, Card Gallery)
- **Testing & Quality:** Vitest (440+ passing unit/integration tests)

###2.2 Data Contracts

```ts
export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string; // Standard artwork field (iTunes / External)
  releaseYear?: number;
  previewUrl?: string;
  isrc?: string;
  provider: 'itunes' | 'custom' | 'spotify';
  verified: boolean;
}
```

---

##3. Core Engine Architectures

###3.1 Music DNA Engine (`src/engine/musicDnaEngine.ts`)

- **Temporal Pattern:** Şarkı çıkış yıllarından `primaryEra`, `eraDistribution`, `spanYears`, `earliestReleaseYear`, `latestReleaseYear` hesaplar.

- **Musical Identity:** Top artistler, `diversityScore`, `hasVerifiedTracks` ve `dominantVibe` üretir.

- **Deterministic Baseline:** LLM erişimi olmasa dahi güvenilir fallback analiz sağlar.



###3.2 Derived Engines

- **Life Story Engine (`lifeStoryEngine.ts`):** Deterministic analiz sonuçlarını alır, 8 yaşam aşamasıyla harmanlayarak anlatı bölümleri (`chapters`) ve `dominantEra` çıkarır.

- **Emotional Timeline Engine (`emotionalTimelineEngine.ts`):** Zamansal ve duygusal yörüngeyi (Emotional Trajectory) oluşturur.



##4. Visual Multiverse Engine & Visual Resolver

Sistem "statik dönemsel arka plan" yaklaşımı yerine dinamik bir **Visual Multiverse Engine** kullanır.



###4.1 Multi-Layered Visual Profile

Bir görsel, **4 ana katmanın** birleşimiyle türetilir:

- **Identity Layer:** era, subEra, genre, genreBlend, culturalThemes.
- **Behavior Layer (0.0 — 1.0):** motion, visualIntensity, contrast, warmth, tension, intimacy, scale.
- **Atmosphere Layer:** environment, timeOfDay, lighting, spatialCharacter, socialDensity.
- **Personalization Layer:** lifeStage, discoveryAge, firstAttraction, discoveryLocation, emotionalLocation.



###4.2 Era & Cultural Theme Model

- **Era DNA Profile:** Sadece görsel bir estetik değil; teknoloji, medya, mimari ve sosyal temaların matematiksel koordinatlarıdır (Technologicality, Saturation, MediaIntensity, Consumerism}. 
- **Cultural Themes:** Döneme ait objeler (ör. kaset, CRT TV, walkman) rastgele "etiket" olarak değil, duygu ve tür filtresinden geçmiş **Contextual Motif** olarak eklenir.



###4.3 Visual Resolver Logic

- **Background vs. Card Rule:**
  - **Background (World):** Atmosfer, duygu, era ve mekan hissini yansıtan geniş sinematik dünya.

  - **Card (Artifact):** Koleksiyon niteliğinde, tipografik, gerçek albüm kapağını (`artworkUrl`) koruyan yapılandırılmış obje



- **Artwork Protection:** Gerçek albüm kapakları AI tarafından yeniden çizilmez; orijinal görsel çerçeve, gölge ve ölçekleme ile korunur.



##5. Conceptual Innovations

###5.1 First Melody Hit (First Spark)

Kullanıcının müzikle bağ kurma sırası çoğu zaman **Melodi → Ses → Sözler** şeklindedir.


**Tanım:** Kullanıcıyı çocukluk veya gençlik döneminde ilk kez durdurup büyüleyen o ilk tını.


**First Attraction Categories:** melody, voice, rhythm, instrument, atmosphere, lyrics.



###5.2 Emo-Location (Emotional Location)

Bir şarkının dinlendiği andaki gerçek lokasyon ile zihinde yarattığı mekan farkı:

- **Discovery Location (THEN):** Şarkının ilk keşfedildiği yer (ör. 90'larda loş bir rock bar, headbang yapan kitle).
 
- **Emotional Location (NOW):** Şarkının bugün dinlenirken hissettirdiği zihinsel mekan(ör. yağmurlu gecede yalnız araba sürüşü.



##6. Master Visual Language Standards (15 Core Rules)

1. **Brand Identity:** Life in Sound her Universe'te tanınabilir kalmalıdır.


2. **Layer Separation:** Identity ve Emotion ayrı katmanlardır.


3. **Artwork Preservation:** Orijinal album artwork korunur.



4. **Card Architecture:** Kartlar sistemik artifact'lerdir.



5. **Role Division:** Background = World, Card = Artifact.



6. **Focus:** Her sahnede tek bir dominant görsel fikir bulunur.



7. **Motifs:** Obje kullanımı dekoratif değil, bağlamsal olmalıdır.



8. **Negative Space:** UI alanları için bilinçli boşluk bırakılır.



9. **Readability:** Okunabilirlik süslemeden önce gelir.



10. **Era Authenticity:** Dönem tanınabilir olmalı, klişeye kaçmamalıdır.



11. **Genre Representation:** Türler estetik klişelerle değil, görsel sözlükle temsil edilir.



12. **Emotional Modifier:** Emotion markayı değil, görsel davranışı değiştirir.



13. **Personal Context:** Kişisel hafıza ögeleri jenerik olmamalıdır.



14. **Coherence:** Görsel bütünlük (coherence), tekil parametrelerden üstündür.



15. **Family Alignment:** Tüm evrenler aynı Life in Sound tasarım ailesine aittir.



##7. Delivery & Asset Specifications

| Aşamalar | Ölçü | Format | Kullanım Amacı |
|--------------------|---------------------------|--------------------|----------------------------------------|
| 🎨 AI Master Source  | 3840×2160 (16:9) | PNG | Yüksek kaliteli master referans |
| 🖼️ Production Background | 1920×1080 | WebP (~80 quality) | Ana uygulama arka planı (200–400 KB) |
| 📱 Mobile Screen View | 1920×1080 | WebP (CSS Cover) | 9:16 mobil uyumlu kırpma |
| 🪪 Card Skins | 2048×2048 | PNG / WebP | Şeffaf/Tipografik kart kaplamaları |
| 🖼️ Master Poster Export | 2048×3072 (2:3) | PNG | Yüksek çözünürlüklü sinematik poster |



##8. Implementation Roadmap & Guardrails

###8.1 Phased Implementation Plan

- **Phase 1 (Current Milestone):** Result Screen üzerinde `MusicUniverseHero` + `SongUniverseCard[]` entegrasyonu (Engine ve Type'lara dokunmadan}.
- **Phase 2:** Music DNA'yı dinamik `VisualProfile` çıktısına bağlama.


- **Phase 3:** First Spark, Emo-Location ve MemoryCard modüllerinin eklenmesi.




- **Phase 4:** Tam kapsamlı Visual Resolver motorunun bağlanması.



###8.2 Strict Operational Guardrails

1. **No Uncontrolled Refactoring:** Kod değişiklikleri daima küçük, ölçülebilir ve geriye dönük testlerle doğrulanarak yapılmalıdır.




2. **Main Branch Protection:** Doğrudan main branch üzerinde deneysel kod yazılmaz. Değişiklikler önce `dev/next` veya ilgili feature branch'lerinde geliştirilip onaylandıktan sonra birleştirilir.



3. **No Fabricated Data:** Modelde karşılığı olmayan genre veya emotion verileri uydurma/mock değerlerle kod içerisine sızdırılmaz.

###8.3 Phase 1 Integration Example

```tsx
import { MusicUniverseHero } from '@/components/results/MusicUniverseHero';
import { SongUniverseCard } from '@/components/results/SongUniverseCard';

// Component render içerisinde:
<div className="space-y-8">
  {/* Hero / Header Alanı */}
  <MusicUniverseHero 
    analysis={musicDnaAnalysis} 
    journeyState={journeyState} 
  />

  {/* Şarkı Evreni Kartları */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4 my-8">
    {songs.map((song, index) => (
      <SongUniverseCard 
        key={song.id || `${song.artist}-${song.title}-${index}`} 
        song={song} 
        index={index} 
      />
    ))}
  </div>
</div>
```

---
