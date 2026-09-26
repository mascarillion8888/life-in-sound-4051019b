# ANA YASA — Life in Sound / SoundMap

> Bu dosya, projeye ait tüm mimari/vizyon belgelerinin (Ana Mimari, Master
> Handoff 4 Eylül, Asset Raporu 5 Eylül, Gap Analysis 27 Ağustos) tek,
> çelişkisiz, tarihe göre süzülmüş halidir. Claude Code bu dosyayı her
> görev öncesi okumalı ve buradaki kurallara uymalıdır.
>
> **Statü etiketleri her bölümde açıkça belirtilmiştir:**
> - 🟢 **CANLI** — şu an production kodunda çalışıyor, doğrulanmış
> - 🟡 **KISMİ** — altyapı var, veri sözleşmesi tamamlanmamış
> - 🔴 **EKSİK** — hiç yok, öncelikli olarak inşa edilmeli
> - 🔵 **TASARIM** — sadece konsept/vizyon seviyesinde, kodda karşılığı yok,
>   mock veri production'a ASLA sızdırılmamalı
>
> Bu dosyadaki hiçbir cümle "kodun şu an ne yaptığının kanıtı" değildir.
> Bir iddia kodla çelişirse KOD esastır — çelişkiyi STATE.md'ye not et.

---

## 0. Değişmez Çalışma Prensibi

```
Önce mimariyi netleştir → read-only kod analizi → en küçük güvenli
değişiklik → test → diff review → ancak ondan sonra commit/push
```

- Geniş kapsamlı / kontrolsüz refactor ile ASLA başlanmaz.
- `main` branch korunur. Doğrudan `main`'e kod yazılmaz.
- Test geçmesi ≠ doğru branch ≠ merge izni. Üçü ayrı şeydir.
- Mock/uydurma veri production koduna ASLA sızdırılmaz. Eksik veri,
  eksik olarak bırakılır veya gerçek bir kaynaktan (API, LLM enrichment)
  türetilir — asla rastgele/sabit değerle doldurulmaz.

---

## 1. Ürünün Temel Zinciri (Hedef)

```
8 gerçek şarkı
      ↓
gerçek metadata (artist, era, genre*, mood*)
      ↓
gerçek Music DNA
      ↓
grounded Life Story
      ↓
gerçek Emotional Timeline
      ↓
Cinematic Visual Story (Poster + Card)
```

**Ana teşhis (27 Ağustos denetimi — KOD BU TESPİTİ AŞTI):** 27 Ağustos'taki
"seçilen gerçek şarkılar Music DNA'nın gerçek girdisi haline gelmemiş; mevcut
scoring sorulara önceden atanmış boyutlardan geliyor" tespiti o dönem doğruydu
(DNA soru-tabanlıydı). 13 Eylül'den beri `musicDnaEngine` bunu aştı ve ARTIK
`Song[]{releaseYear, artist, genre, mood}`'u doğrudan tüketir (temporal +
identity şarkıdan çıkar). Cevaplar DNA'ya katılmaz — legacy "kişilik profili"
(`analyzeUserJourney`) ayrı bir katman olarak poster/sosyal paylaşımı besler;
`LifeContext.contextText` Life Story'e taşınır (production'da henüz kullanılmıyor,
açık iş). Yani hedef `Music DNA = Actual Music Selection DNA` büyük ölçüde
CANLI'dır; eksik kalan `LIFE CONTEXT` katmanıdır (§4, 🔵).

```
Kod bugün: Music DNA = Actual Music Selection DNA (CANLI) + ayrı cevap-tabanlı kişilik profili
Kalan:     Life Context (cevapların anlatıya akışı) — §4 tasarım, uygulanacak
```

---

## 2. Song Veri Sözleşmesi

### 🟢 Song modelinde CANLI olan alanlar
`title`, `artist`, `album`, `artworkUrl`, `releaseYear`, `previewUrl`,
`isrc`, `provider`, `providerId`, `verified`

### 🔴 EKSİK — genre
`Song` modelinde `genre` güvenilir birinci sınıf alan **değil**.
iTunes API'den `primaryGenreName` muhtemelen geliyor ama mapping'e
girmiyor — doğrulanmalı, sonra gerçek kaynaktan eklenmeli.
**Genre uydurulmayacak.**

### 🔴 EKSİK — mood
Hiçbir veri kaynağı yok. LLM inference ile üretilmesi planlanan bir
sonraki fazın konusu. Şu an production'da **yok**.

### Persistence kuralı
`Song`'un TÜM alanları (releaseYear, previewUrl, genre, mood dahil)
hem localStorage hem Supabase round-trip'inde kayıpsız korunmalı.
Yeni bir Song alanı eklendiğinde, tek bir whitelist (`SONG_FIELDS`)
üzerinden hem local hem remote katman güncellenmeli — biri diğerinden
asla geride kalmamalı.

---

## 3. Music DNA Mimarisi (Hedef)

```
                 8 SONGS
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
      ARTIST       ERA       GENRE*
        │           │           │
        └───────────┼───────────┘
                    ↓
             MUSIC DNA ENGINE
                    ↓
       ┌────────────┼────────────┐
       ↓            ↓            ↓
   Emotional      Musical      Temporal
   Character      Identity      Pattern
```

### 🟢 CANLI — `src/engine/musicDnaEngine.ts`
- **Temporal pattern:** `primaryEra`, `eraDistribution`, `spanYears`,
  `earliestReleaseYear`, `latestReleaseYear` — şarkı yıllarından
  çıkarılıyor, deterministic.
- **Musical identity:** `topArtists`, `diversityScore`,
  `hasVerifiedTracks` üretiliyor.
- `dominantVibe` 13 Eylül'den beri GERÇEK genre+mood verisinden üretilir (katmanlı
  gate): mood-coverage ≥60 → "Genre · Mood"; genre-coverage ≥50 → "Genre & Beyond/
  Devotee"; yeterli gerçek sinyal yoksa dürüst **"Unclassified"** (P0 Seçenek A(a)
  uygulanıyor — eski "Eclectic Explorer"/"Focused Nostalgic" diversity-etiketleri
  ANA_YASA §0 gereği KALDIRILIYOR).

### Pipeline (🟢 CANLI)
```
src/lib/ai/pipeline.ts → generateGroundedAnalysis(songs, contexts?)
  → { dna, story, timeline }

musicDnaEngine → lifeStoryEngine → emotionalTimelineEngine
```

### Deterministic-first prensip (🟢 CANLI, korunmalı)
```
Deterministic Layer → calculates → LLM Layer → narrates
```
LLM hazır olmadığında veya başarısız olduğunda deterministic fallback
her zaman devrede kalmalı — kullanıcı hiçbir zaman boş/kırık ekran
görmemeli.

---

## 4. Sorunun Yeni Rolü (🔵 TASARIM — henüz kodda değil)

Sorular kaldırılmayacak, ama görevleri ayrışacak:

- **Şarkı** → müzikal gerçeklik
- **Soru / yaşam aşaması** → hayat bağlamı

```
8 SONGS + 8 LIFE CONTEXTS → MUSIC DNA + LIFE CONTEXT → LIFE STORY
  → EMOTIONAL TIMELINE → CINEMATIC POSTER
```

---

## 5. Music Multiverse / Visual Multiverse Engine (🔵 TASARIM — mock, production'a sızdırılmamalı)

Bu, 4-5 Eylül'de başlayıp en son (bugünkü) oturumda olgunlaşan
**gelecek vizyonu**. Şu an production kodunda karşılığı yok, kavramsal
olarak dokümante ediliyor ki ileride tutarlı inşa edilsin. Bu bölüm,
önceki taslağın (First Melody Hit, Emo-Location, Era+Cultural Theme)
yerini almaz — onları **kapsayan, genişleten** en güncel modeldir.

### 5.1 Sekiz boyutlu model

```
MUSIC MULTIVERSE
│
├── ERA                 1900s → 1910s → ... → 2020s
│                        (Era Master Style: dönemin görsel DNA'sı)
│
├── GENRE / SUBGENRE     Pop, Rock, Jazz, Soul/R&B, Hip-Hop,
│                        Classical, Electronic, Metal...
│                        (müziğin görsel DNA'sı)
│
├── LIFE-STAGE           Childhood, Adolescence, Young Adult,
│                        Adult, Midlife, Later Life
│                        (kişinin o müziği hayatının HANGİ
│                        döneminde yaşadığı — biyolojik yaş değil)
│
├── GENERATION           Birth Cohort (doğum yılına göre nesil)
│                        — aynı Life-Stage bile farklı Generation'da
│                        farklı anlam taşır
│
├── CULTURE / PLACE      Region / Country
│                        (1980s Pop Turkey ≠ 1980s Pop UK)
│
├── MEDIA / TECHNOLOGY   gramophone(1900s) → radio(1930s) →
│                        vinyl(1950s) → cassette/Walkman/MTV(1980s) →
│                        CD(1990s) → MP3/iPod(2000s) →
│                        streaming(2010s-2020s)
│                        (müziğin dönemde NASIL yaşandığı — Music
│                        Memory tarafıyla birleşir)
│
├── MOOD                 Energetic, Euphoric, Playful, Romantic,
│                        Melancholic, Dreamy, Nostalgic, Dark, World
│
└── PERSONAL MEMORY      Kullanıcının kendi anlattığı bağlam
                         ("babamın arabasında, 1987 yazı, yol
                         gezisi") — kişiselleştirilmiş multiverse
```

**Kilit içgörü (Generation ayrımı):** Aynı Era + aynı Genre + aynı
Mood ("Nostalgic") bile, farklı bir Birth Cohort/Life-Stage
kombinasyonunda **aynı nostalji değildir**:

```
ERA 1980s + BIRTH COHORT 1970s-doğumlu + LIFE STAGE Childhood
  + GENRE Pop + MOOD Nostalgic
        ≠
ERA 1980s + BIRTH COHORT 1950s-doğumlu + LIFE STAGE Adult
  + GENRE Pop + MOOD Nostalgic
```

Aynı şarkı (`Take On Me`, 1985), 10 yaşında dinleyen biri için
"okul / ilk kaset / çizgi filmler / aile arabası" dünyasına;
30 yaşında dinleyen biri için "gece hayatı / kariyer / kulüp / ilişki"
dünyasına açılır. **Aynı şarkı, farklı multiverse kapısı.**

### 5.2 Asset patlamasını önleme prensibi (🔴 kritik mimari kısıtlama)

**Bu boyutların kartezyen çarpımı için ayrı asset üretilmeyecek** —
aksi halde sistem asset sayısı patlamasıyla kısa sürede sürdürülemez
hale gelir. Onun yerine:

```
BASE ASSET (Era × Genre → Master Style, örn. "1980s × Pop")
      +
LIFE-STAGE VISUAL MODIFIER
      +
GENERATIONAL CONTEXT
      +
CULTURAL CONTEXT
      +
PERSONAL MEMORY
      ↓
VISUAL RESOLVER (deterministic, runtime'da AI YOK)
      ↓
PRE-GENERATED ASSET seçimi/kompozisyonu
      ↓
CARD
```

Örnek: `1980s × Pop` için **9 master asset** (mood başına bir tane)
üretilir. 10 yaşındaki kullanıcı ile 30 yaşındaki kullanıcı için ayrı
ayrı 9'ar yeni asset üretilmez — resolver, aynı base asset üzerine
life-stage/generation/culture modifier'larını (katman, skin,
kompozisyon değişikliği olarak) uygular.

### 5.3 Rollout stratejisi — pilot evren

Tüm Era × Genre matrisini aynı anda inşa etmek yerine, önce **tek bir
pilot universe** üzerinden mimari doğrulanacak:

```
MUSIC MULTIVERSE
   ├── 1900s...1970s  (henüz yok)
   ├── 1980s ← PİLOT
   │      └── Pop ← PİLOT  (9 mood × master style = proof of concept)
   ├── 1990s...2020s  (henüz yok)
```

Mimari doğrulandıktan sonra yeni bir Era×Genre (örn. `1970s Rock`,
`1990s Hip-Hop`) eklemek **yeni sistem yazmak değil, yeni bir universe
paketi eklemek** olmalı. Bu, mimarinin doğru kurulduğunun testidir —
eğer yeni bir dönem/tür eklemek büyük kod değişikliği gerektiriyorsa,
resolver mimarisi yanlış kurulmuş demektir.

### 5.4 Önceki taslak kavramlar (hâlâ geçerli, bu modele dahil)

- **First Melody Hit / İlk Kıvılcım:** "Seni önce ne yakaladı: melodi,
  ses, ritim, enstrüman, atmosfer, sözler?" — sözlerden önce melodinin/
  sesin etkisini yakalamayı hedefler. Personal Memory katmanına girdi
  sağlayabilir.
- **Emo-Location:** "Bu şarkı seni nereye götürüyor?" — Discovery
  Location (şarkıyı ilk duyduğun gerçek yer) ile Emotional Location
  (bugün dinlerken zihninde gittiğin yer) AYRI kavramlar, aynı olmak
  zorunda değil. Culture/Place ve Personal Memory katmanlarını besler.

**Asset üretim prensibi (🟢 karar verildi, uygulanacak):**
> Runtime'da AI görsel üretimi YOK. AI yalnızca asset tasarım stüdyosu
> olarak kullanılır. Uygulama, önceden üretilmiş hazır asset'ler
> arasından seçim yapar (Visual Universe Library → Visual Resolver).

5 katmanlı ekran yığını: Background (statik asset) → Kart iskeleti
(React) → Kart skin (şeffaf PNG/WebP) → [üst katmanlar rapor devamında].

### 5.5 Bu bölümün veri modeliyle ilişkisi — ÖNEMLİ UYARI

§2'de listelenen 🔴 EKSİK alanlar (`genre`, `mood`) bu 8 boyutlu
modelin sadece İKİ tanesini karşılıyor. `Generation/Birth Cohort`,
`Culture/Place`, `Media/Technology`, `Personal Memory` için
**Song modelinde veya kullanıcı profilinde HİÇBİR alan yok**. Bu
bölümdeki hiçbir boyut, önce P0-P1 (bkz. §8) tamamlanmadan koda
yazılmaya başlanmamalı — sıra: önce genre/mood gerçek veriyle
doldurulacak, ancak ondan sonra Generation/Culture/Memory katmanları
tasarlanacak.

---

## 6. Card Artwork Kontratı (🟢 CANLI — kilitli, değiştirilmemeli)

Son checkpoint'te (`7747a120`) kilitlenen kurallar:
- Portre **kaldırıldı** — insan yüzü / sanatçı portresi yasak.
- Tipografik plak kapağı yaklaşımı — soyut glyph/geometri.
- Görsel içine başlık çizme yasağı.

**Önemli:** Daha önce farklı bir yerde tanımlanan "şarkıyı temsil eden
fine-art sahne; odada sanatçının çerçeveli portresi" fikri bu kontratla
**AYNI ŞEY DEĞİL** ve onun yerine sessizce uygulanmamalı. Bu ayrı bir
ürün/tasarım kararı olarak ele alınmalı, mevcut kilitli kontrat
onaysız değiştirilmemeli.

---

## 7. Master → Code Durum Tablosu (27 Ağustos denetiminden, doğrulanmalı)

| Özellik | Durum |
|---|---|
| Landing | 🟢 |
| 8 soru | 🟢 |
| Gerçek şarkı seçimi | 🟢 |
| Şarkı doğrulama | 🟢 |
| Artwork | 🟢 |
| 30 sn preview altyapısı | 🟢 CANLI — previewUrl `SONG_FIELDS` whitelist'inde + `COERCE_TO_PERSISTED`'te; local (`journey-storage`) ve remote (`journey-remote`) tier aynı whitelist; round-trip testleri var (2026-09-24 doğrulandı) |
| Journey persistence | 🟢 |
| Music DNA | 🟢 song-tabanlı (13 Eylül) — genre > mood katmanlı gate; metadata-yoksa dürüst "Unclassified" (P0 A(a)) |
| Life Story | 🟡 mimari doğru, veri temeli güçlendirilmeli |
| Emotional Timeline | 🟡 mevcut, Music DNA düzeltmesi sonrası yeniden beslenmeli |
| Cinematic Poster | 🟢 teknik olarak güçlü |
| Card Gallery | 🟡 Supabase migration/RLS bağımlılığı var |
| Music Memory | 🟢 doğru şekilde Future (henüz yapılmaması doğru) |
| Music Companion / Tell Me My Life | 🟢 doğru şekilde Future |

> ⚠️ Bu tablo 27 Ağustos'ta çıkarıldı. Claude Code her yeni görevde bu
> tabloyu güncel kod üzerinden yeniden doğrulamalı, olduğu gibi
> güvenmemeli.

---

## 8. Öncelik Sırası (P0 → P5)

```
P0 — Music DNA:        Song[] → SongFeatures → gerçek Music DNA
P1 — Metadata enrichment: genre, era, artist metadata, musical
                        characteristics — gerçek kaynaktan, uydurma yok
                        → mood inference + gate tamamlandı ✅ (13 Eylül).
                        Kalan: çoklu-kaynak genre (iTunes tekelini kır),
                        artist metadata, musical characteristics
P2 — Life Story:        Music DNA + 8 songs + 8 life contexts
                        → Grounded Life Story
P3 — Emotional Timeline: gerçek Music DNA üzerinden yeniden üretilmeli
P4 — Song-specific visual scenes: Song meaning + user context +
                        Music DNA → fine-art scene
P5 — Master Poster:     mevcut güçlü sistem yeni analitik çıktılarla
                        beslenmeli
```

**Kural:** Yeni özellik eklemek yerine önce mevcut MVP'nin analitik
çekirdeği (P0) düzeltilmeli. P4/P5'e (görsel/poster) P0-P1
tamamlanmadan geçilmemeli.

---

## 9. Kesin YAPMA Listesi

- Song tipine yeni "derived" alan (genre-inference sonucu, emotion,
  visual state) doğrudan ekleme — bu türetilmiş veriler ayrı motor
  katmanlarında üretilir, Song nötr/ham veri taşıyıcısı kalmalı.
- Card artwork kontratını (bkz. §6) onaysız değiştirme.
- MİMARİ YASAL (hedef): Visual AI katmanı/AI görsel üretimi, KULLANICI
  runtime'da beklerken her talep için yeni görsel üreten bir servis DEĞİLDİR.
  Hedef, kontrollü bir üretim sınırıdır: `Visual AI (offline/üretim katmanı)
  → GPT Image → Candidate Visuals → QA/Approval → onaylı Asset Registry →
  runtime'da yalnızca deterministik Visual Resolver seçimi`. Bu hedef
  devreye girince runtime'da YENİ üretim YAPILMAZ (üretim çağrısı yok;
  ANA_YASA §0 uydurma yasağı kapsamında). Bu gelecek-geçiş yönüdür, bugünün
  durumu değildir.
- CURRENT/IMPLEMENTED İSTİSNA (geçici, gizlenmez): `src/lib/art/cardArtwork.server.ts`
  (Imagen→Gemini→HuggingFace zinciri) ŞU AN runtime'da — kullanıcı şarkı
  seçtiğinde — görsel üretmektedir (Era Card fine-art). Bu, mevcut/kalıcı
  tasarım değil, Visual AI katmanı devreye girene kadar süren GEÇİCİ ve
  bilinen bir istisnadır; üretim yapanları yeni modüllerle ÇOĞALTMA. Bu
  ayrım için: `docs/TECH/ARCHITECTURE.md` + `docs/TECH/VISUAL_ARCHITECTURE.md`.
- Mock genre/mood/emotion verisini production koduna veya UI'a sızdırma.
- Visual Multiverse Engine (§5) kavramlarını "zaten var" gibi ele alıp
  üstüne kod yazma — bunlar tasarım aşamasında, önce P0-P1 bitmeli.
- 8 boyutlu Music Multiverse modelinin (Era/Genre/Life-Stage/
  Generation/Culture/Media/Mood/Personal Memory) her kombinasyonu için
  ayrı asset üretme — bkz. §5.2, kartezyen çarpım YASAK, Base Asset +
  Modifier + Resolver mimarisi zorunlu.
- Büyük/kontrolsüz refactor ile başlama; her zaman en küçük güvenli
  diff.
- `main` branch'e doğrudan yazma.

---

## 10. Belge Kaynakları ve Tarihleri

Bu ANA_YASA aşağıdaki belgelerin tarihe göre süzülmüş, çelişkisi
çözülmüş halidir. Çelişki durumunda en güncel belge esas alınmıştır:

1. Gap Analysis — 27 Ağustos 2026 (checkpoint `7747a120`)
2. Master Handoff Report — 4 Eylül 2026 (checkpoint `432aea8`)
3. Visual Multiverse Asset Report — 5 Eylül 2026 (checkpoint `783635f`,
   push edilmedi)
4. Ana Mimari (en güncel hedef mimari dokümanı)

Ham beyin fırtınası notları (masterro.docx'ün büyük kısmı) bu
belgelerin öncesindeki düşünce sürecidir; buraya damıtılmış maddeler
dışında ayrıca referans alınmamalıdır.
