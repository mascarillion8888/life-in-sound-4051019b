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

**Ana teşhis (27 Ağustos denetimi, hâlâ geçerli):**
Kullanıcı akışı, 8 soru sistemi, gerçek şarkı seçimi, persistence,
artwork, card sistemi ve poster sistemi büyük ölçüde kurulu. Ancak
ürünün analitik çekirdeğinde kritik boşluk var: **seçilen gerçek
şarkılar, Music DNA'nın gerçek girdisi haline gelmemiş.** Mevcut
personality scoring ağırlıklı olarak sorulara önceden atanmış
boyutlardan geliyor; şarkı seçimi sadece sınırlı bir text/hash
varyasyonu olarak katkı sağlıyor.

```
Mevcut:  Music DNA ≈ Question DNA + answer variation
Hedef:   Music DNA = Actual Music Selection DNA
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
- `dominantVibe` şu an yalnızca **iki sabit etiket** kullanıyor
  ("Eclectic Explorer" / "Focused Nostalgic") — bu, gerçek genre/mood
  verisi gelene kadar geçici bir yer tutucu, genişletilmeli.

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

## 5. Visual Multiverse Engine (🔵 TASARIM — mock, production'a sızdırılmamalı)

Bu, 4-5 Eylül'de tasarlanan **gelecek vizyonu**. Şu an production
kodunda karşılığı yok, kavramsal olarak dokümante ediliyor ki ileride
tutarlı inşa edilsin:

```
SONG → MUSIC IDENTITY → EMOTIONAL PROFILE → ERA/CULTURE → LIFE STAGE
  → FIRST MELODY HIT → EMO-LOCATION → PERSONAL MEMORY
  → VISUAL PROFILE → VISUAL RESOLVER → VISUAL UNIVERSE
```

**Yeni kavramlar (🔵 TASARIM, henüz veri modeli yok):**
- **First Melody Hit / İlk Kıvılcım:** "Seni önce ne yakaladı: melodi,
  ses, ritim, enstrüman, atmosfer, sözler?" — sözlerden önce melodinin/
  sesin etkisini yakalamayı hedefliyor.
- **Emo-Location:** "Bu şarkı seni nereye götürüyor?" — Discovery
  Location (şarkıyı ilk duyduğun gerçek yer) ile Emotional Location
  (bugün dinlerken zihninde gittiğin yer) AYRI kavramlar, aynı olmak
  zorunda değil.
- **Era + Cultural Theme Model:** Era tek bir "80'ler estetiği" etiketi
  değil; visual language, technology, media, fashion, architecture,
  youth culture gibi çok boyutlu bir **Era DNA Profile**. Cultural
  Theme dekoratif obje değil, o dönemde gerçekten anlam taşıyan bağlam.
  İlk kapsam: 1950s–2020s (on yıllık dilimler).

**Asset üretim prensibi (🟢 karar verildi, uygulanacak):**
> Runtime'da AI görsel üretimi YOK. AI yalnızca asset tasarım stüdyosu
> olarak kullanılır. Uygulama, önceden üretilmiş hazır asset'ler
> arasından seçim yapar.

5 katmanlı ekran yığını: Background (statik asset) → Kart iskeleti
(React) → Kart skin (şeffaf PNG/WebP) → [üst katmanlar rapor devamında].

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
| 30 sn preview altyapısı | 🟡 veri sözleşmesi tamamlanmalı |
| Journey persistence | 🟢 |
| Music DNA | 🔴 gerçek müzik verisine yeterince dayanmıyor |
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
- Runtime'da AI görsel üretimi ekleme — asset üretimi offline/tasarım
  aşamasında olmalı.
- Mock genre/mood/emotion verisini production koduna veya UI'a sızdırma.
- Visual Multiverse Engine (§5) kavramlarını "zaten var" gibi ele alıp
  üstüne kod yazma — bunlar tasarım aşamasında, önce P0-P1 bitmeli.
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
