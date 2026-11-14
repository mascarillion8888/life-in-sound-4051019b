# Sinematik Yaşam Posteri — Tasarım Dokümanı (Karar B)

> **Statü: TASARIM / DOCS-ONLY.** Bu dosya bir tasarım önerisidir. Hiçbir
> uygulama kodu, migration, `.env`, config veya asset değişmedi. Buradaki
> hiçbir cümle "kodun şu an ne yaptığının kanıtı" değildir; kod ile çelişirse
> **KOD esastır** (ANA_YASA §0).
>
> **Karar:** "Karar B" (sahip tarafından onaylandı) — mevcut poster altyapısı
> (`poeticPoster` / `MasterPoster`) temel alınarak sinematik yaşam posteri
> geliştirilecek. Karar VERİLDİ; **uygulama ONAYLANMADI** (bkz. HANDOFF §1b).
>
> **Etiketler:** `CURRENT` (kodda var, doğrulandı) · `ÖNERİ` (yön net, kod yok) ·
> `VARSAYIM` (doğrulanmadı — karar öncesi doğrula) · `TEK-KAYNAK` (tek kaynaktan
> alınan sayı — karar öncesi bağımsız doğrula).
>
> **Güncelleme (2026-11-14):** §8.2 ve §9'daki açık kararlar sahibi tarafından
> **ONAYLANDI** ("Önerilere katılıyorum"). Ayrıntı: **Karar kaydı** bölümü.
> Faz 0 serbest; Faz 1 yalnız S2 güvenlik PR'ı main'e alındıktan sonra.

---

## Karar kaydı (2026-11-14) — SAHİBİ ONAYLADI

> **Sahibin yanıtı (birebir):** "Önerilere katılıyorum" — §9'daki 8 önerinin
> TAMAMI onaylandı. Aşağıdaki kararlar bu tarih itibarıyla **APPROVED**'dır.
> §8.2 ve §9'daki seçenekler (A/B/C) SİLİNMEDİ; yalnız onay işaretlendi.

| #   | Karar                                        | Onaylanan karar                                                                                                                                                                                                       | Kaynak       |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Runtime görsel üretimi (Faz 1 hibrit)        | **EVET**, ama **yalnız S2 güvenlik PR'ı sonrası** (kota/authz/single-flight/concurrency). **Faz 0 önce.**                                                                                                             | §8.2/1, §9/1 |
| 2   | Faz 1 sağlayıcı                              | **Sağlayıcı-agnostik adapter** (Gemini Flash Image deprecated; dokümana göre 2027-03-15'te kapanır)                                                                                                                   | §8.2/2, §9/2 |
| 3   | Music Memory `note`/`feeling` kriz guard'ı   | **EVET** — AYNI mevcut `crisisGuard` (`detectCrisisNote`), **yeni desen yok**; herhangi bir LLM/görsel-sağlayıcı çağrısından ÖNCE çalışır; kanıt `crisisGuard.test.ts`. ETHICAL_AI §3e "kapsam dışı" statüsü DEĞİŞİR. | §8.2/3, §9/3 |
| 4   | Music Memory v1 şeması                       | **EVET** (uygulanırken `docs/TECH/DATABASE_PLAN.md` gerçek şemayla hizalanır)                                                                                                                                         | §8.2/4, §9/4 |
| 5   | Poster yeniden üretim tavanı                 | **5 / gün**                                                                                                                                                                                                           | §8.2/5, §9/5 |
| 6   | Poster çıktı ölçüsü                          | **2048×3072 (2:3)**                                                                                                                                                                                                   | §8.2/6, §9/6 |
| 7   | Kullanıcı notu sağlayıcıya gönderilsin mi    | **HAYIR** (veri minimizasyonu)                                                                                                                                                                                        | §8.2/7, §9/7 |
| 8   | Faz 1, S2 main'e alınmadan başlatılabilir mi | **HAYIR**                                                                                                                                                                                                             | §9/8         |

**Uygulama notu:** Kararlar onaylandı; **bu PR (docs) hiçbir kod/migration
değiştirmez.** Faz 0 veri modeli görevi **P0-1** (§8.3) bu kayda dayanır;
kriz-guard bağlama görevi **MM-3**'tür (bu PR'da DEĞİL).

---

## 0. Bu dokümanın sınırı ve dürüstlük notları

- **Kod yok.** Bu PR yalnız `docs/` içerir. `src/` değişmez.
- **Sayılar.** Her maliyet/gecikme sayısı `TEK-KAYNAK` veya `VARSAYIM` olarak
  etiketlidir. Hiçbir fiyat uydurulmadı; bulunan kaynaklar URL ile verildi,
  bulunamayanlar `bilinmiyor` yazıldı. Fiyatlar 2026-11-11'de okundu ve
  **değişebilir**.
- **Referans poster görseli.** Brief'te "kalite hedefi" olarak anılan ChatGPT
  yapımı poster görseli bu oturumda **erişilebilir değildi** (ek dosya ne
  repoda ne oturumda vardı). Bu yüzden §1.2'deki kalite hedefi, görselin
  incelenmesinden değil, sahibin brief metninden türetilen **tasarım
  ilkeleridir** (`VARSAYIM`). Gerçek görselle karşılaştırma ayrı bir iştir.
- **Gerçek sanat/marka kopyalanmaz.** Bu doküman hiçbir gerçek albüm kapağı,
  grup logosu veya marka görseli içermez ve içermemelidir.
- **Anahtar sızıntısı yok.** Hiçbir API anahtarı, token veya env değeri bu
  dosyada yok. Sağlayıcı anahtarları yalnız server-only modüllerde tutulur
  (STATE kural 5).

---

## 1. Amaç, kapsam dışı, başarı kriterleri

### 1.1 Amaç

Uygulama bir kerelik quiz değil, **hayat boyu süren müzikal bir fotoğraf
albümüdür**. Kullanıcı:

1. 8 soruluk journey'yi (ürünün **ön kapısı**) tamamlar, her soruya gerçek bir
   şarkı seçer (MusicBrainz arama → provider-neutral `Song`).
2. Journey sonrası **istediği an** hayatında iz bırakan bir şarkıyı ekleyebilir
   (Music Memory; bkz. §6).

Nihai çıktı: kullanıcının müzikal hayatının **sinematik bir posteri** —
ChatGPT-poster kalitesinde, **düşük maliyetle**. Lore metni Gemini tarafından
sinematik bir sesle yazılır (mevcut `loreEngine.ts`: ikinci tekil şahıs "sen",
yaş sayısı yok, şarkı adı/yılı cümle içinde).

### 1.2 Kalite hedefi (`VARSAYIM` — görsel incelenmedi)

"ChatGPT-poster kalitesi"ni ölçülebilir kılmak için hedef, aşağıdaki
**tasarım ilkeleri** olarak tanımlanır (brief metninden türetildi):

| Boyut                   | Hedef ilke                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Kompozisyon**         | Tek baskın görsel fikir; dikey 2:3; net üst/orta/alt bölge ayrımı                                               |
| **Katmanlama**          | Arka plan (dünya) → atmosfer/ışık → orta katman (sembol/çizgi) → metin katmanı; her katman ayrı, üst üste biner |
| **Tipografi bölgeleri** | Başlık üstte; bölüm/lore metinleri orta-alt; künye/mühür altta; okunabilirlik süslemeden önce gelir             |
| **Ton**                 | Sinematik, duygusal, gizemli; reklam dili ve klişe yok; jenerik değil                                           |
| **Tutarlılık**          | Tüm posterler aynı "Life in Sound" tasarım ailesinde; tema veriye göre deterministik değişir                    |
| **Metin**               | Görselde metin **yok** (textless görsel + CSS/canvas metin); metin her zaman ayrı katman                        |

> **Not:** Bu ilkeler mevcut `docs/ARCHITECTURE.md` §6 "Master Visual Language
> Standards" (15 kural) ve §7 çıktı ölçüleriyle uyumludur.

### 1.3 Kapsam dışı (non-goals)

- Yeni bir **ikinci poster motoru** kurmak — mevcut `poeticPoster` /
  `MasterPoster` genişletilir (HANDOFF §1b).
- Varsayılan hatta **runtime görsel üretimi** eklemek (ANA_YASA §9).
- Gerçek albüm kapağı / grup logosu / marka görselini postere **gömmek**
  (lisans doğrulanmadan; dış kapak yalnız runtime URL + harmanizasyon).
- Kullanıcı verisinde olmayan yaş/duygu/olay/şarkı ilişkisi **uydurmak**
  (ANA_YASA §0).
- Kartezyen asset matrisi üretmek (era × genre × mood × … tam çarpım YASAK).

### 1.4 Başarı kriterleri — "ChatGPT kalitesi, düşük maliyet" ölçülebilir hâlde

| Kriter                             | Faz 0 (deterministik)                       | Faz 1 (hibrit)                               | Etiket                                |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------- | ------------------------------------- |
| Poster başına birim maliyet        | **$0 marjinal** (mevcut asset + CSS/canvas) | **< $0.05 / poster** (tek görsel çağrısı)    | `VARSAYIM` — fiyat §2'ye göre doğrula |
| Uçtan uca gecikme (p95)            | **< 1 sn** (istemci render, ağ yok)         | **< 10 sn** (tek görsel çağrısı + CSS metin) | `VARSAYIM`                            |
| Yeniden üretme (regenerate) limiti | **Sınırsız** (ücretsiz, deterministik)      | **Günde 5** (kullanıcı başına kota)          | `VARSAYIM` — sahip onayı              |
| Kalite rubriği                     | §1.2 ilkelerinin tümü sağlanır              | §1.2 + "görsel sinematik, metin kusursuz"    | `ÖNERİ`                               |
| Metin hatası                       | **0** (metin kod tarafından çizilir)        | **0** (metin CSS/canvas, görselde değil)     | `ÖNERİ`                               |
| Uydurma                            | **0** (deterministik)                       | **0** (lore LLM; görsel metin içermez)       | Zorunlu (ANA_YASA §0)                 |

> Gecikme ve kota sayıları birer **hedef/varsayımdır**, ölçülmüş gerçek değildir.
> Faz 1'e geçmeden önce sağlayıcıyla gerçek bir uçtan uca ölçüm yapılmalıdır.

---

## 2. Üç üretim stratejisi (karşılaştırma)

### 2.1 Maliyet/gereksinim kaynakları (etiketli)

| Kalem                                                            | Sayı                                                                                                                            | Kaynak                                                               | Etiket       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------ |
| Gemini 2.5 Flash Image (`gemini-2.5-flash-image`) çıktı          | **$0.039 / görsel**; giriş $0.30/1M (metin/görsel)                                                                              | https://ai.google.dev/gemini-api/docs/pricing (2026-11-11)           | `TEK-KAYNAK` |
| Gemini 2.5 Flash Image durumu                                    | **deprecated**, 15 Mart 2027'de kapanır → `gemini-3.1-flash-lite-image`'e geçiş önerilir                                        | aynı sayfa                                                           | `TEK-KAYNAK` |
| Gemini 3.1 Flash Lite Image çıktı                                | $30/1M token (Standard); 1K≈1120 token≈**$0.0336/görsel**, 2K≈**$0.0504**, 4K≈**$0.113**                                        | aynı sayfa                                                           | `TEK-KAYNAK` |
| OpenAI `gpt-image-2.6-sunburst` / `-flare`                       | Görsel giriş **$8.00/1M**, çıktı **$30.00/1M**, cached $2.00; metin giriş $5.00/1M                                              | https://platform.openai.com/docs/pricing (2026-11-11)                | `TEK-KAYNAK` |
| OpenAI `gpt-image-2`                                             | Görsel giriş $4.00/1M, çıktı $15.00/1M, cached $1.00                                                                            | aynı sayfa                                                           | `TEK-KAYNAK` |
| OpenAI **görsel başına** birim fiyat                             | **bilinmiyor** (sayfa token başına fiyat veriyor, görsel başına token sayısı yayınlanmamış)                                     | —                                                                    | `VARSAYIM`   |
| Repo'nun kendi probe'u (görsel API fizibilite testi, 2026-09-27) | `openai/gpt-5-image` via OpenRouter `/api/v1/images`, 2:3 → 1024×1536, **~$0.25/görsel**, **~45–50 sn/görsel**, tutarsız kalite | HANDOFF §5/§9 (repo içi, tek oturum)                                 | `TEK-KAYNAK` |
| LLM lore (metin)                                                 | Sağlayıcı tarafında metin token fiyatı; repo'da çağrı başına `maxTokens` sınırı var (ör. kart lore 900)                         | `src/lib/art/generateCard.server.ts`, `src/lib/openrouter.server.ts` | `CURRENT`    |

> **Uyarı:** Yukarıdaki ücretler 2026-11-11'de okundu ve değişebilir. Repo'nun
> kendi `~$0.25/görsel` ölçümü tek bir oturumun tek ölçümüdür; bağımsız
> doğrulanmadan karar dayanağı yapılmamalıdır.

### 2.2 Karşılaştırma tablosu

| Kriter                    | **(a) Deterministik kompozisyon**                                                                           | **(b) Hibrit** (deterministik düzen + 1 görsel çağrısı)                                                      | **(c) Tam görsel-model posteri** (metin dahil)                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Ne üretir**             | Asset Registry (genre×mood, bkz. not) + CSS/SVG/canvas katmanları + LLM lore; **runtime görsel modeli YOK** | Deterministik düzen + **tek** textless hero/arka plan görseli (görsel modeli); metin CSS/canvas ile üstte    | Tek görsel modeli çağrısı, **metin dahil** tek görsel üretir (ChatGPT-stili) |
| **Kalite tavanı**         | Yüksek ama "elle küratörlü" hissi; asset'e bağlı                                                            | Yüksek; sinematik hero + kusursuz metin                                                                      | En yüksek olabilir, ama **metin hataları** ve tutarsızlık riski              |
| **Poster başına maliyet** | **$0 marjinal** (`CURRENT` asset'ler)                                                                       | Tek görsel çağrısı: §2.1 fiyatlarına göre **~$0.03–$0.05** veya sağlayıcıya göre `bilinmiyor` (`TEK-KAYNAK`) | Tek görsel çağrısı ama daha büyük/maliyetli olabilir; `bilinmiyor`           |
| **Gecikme**               | **< 1 sn** (ağ çağrısı yok)                                                                                 | Görsel çağrısı (repo ölçümü: ~45–50 sn; sağlayıcıya göre değişir) + CSS metin                                | Aynı görsel çağrısı + daha karmaşık prompt → daha yavaş olma eğiliminde      |
| **Risk**                  | Düşük; asset çeşitliliği sınırlı                                                                            | Orta; sağlayıcı kesintisi/kota, görsel içerik moderasyonu                                                    | **Yüksek**: metin render hataları, tutarsız kalite, telif/benzerlik, maliyet |
| **Gizlilik**              | En iyi: kullanıcı verisi üçüncü tarafa **gitmez**                                                           | Orta: prompt (şarkı/tür/duygu; **kullanıcı notu gönderilmezse** PII yok) görsel sağlayıcıya gider            | Yüksek risk: daha fazla bağlam sağlayıcıya; metin = ek sızıntı yüzeyi        |
| **İnşa eforu**            | **Düşük** (mevcut motorlar genişletilir)                                                                    | Orta (hero üretimi + cache + kota + moderasyon)                                                              | Yüksek (prompt mühendisliği + metin doğrulama + maliyet kontrolü)            |
| **Metin güvenilirliği**   | Kusursuz (kod çizer)                                                                                        | Kusursuz (kod çizer)                                                                                         | **Düşük**: model metni bozuk/yazım hatalı çizebilir                          |
| **Marka/lisans**          | Güvenli (kendi asset'lerimiz)                                                                               | Güvenli (textless hero)                                                                                      | **Riskli**: logo/kapak/gerçek kişi benzerliği sızabilir                      |

> **Asset Registry notu (repo gerçeği):** Registry bugün **207 satırdır**
> (23 tür × 9 mood, `src/lib/visual/assetRegistry.ts::SCENE_ASSET_REGISTRY`),
> dosyalar `src/assets/<tür>/mood-backdrop-<mood>.jpg` (832×1248 = 2:3).
> Brief'te geçen "81 backdrop" daha eski bir durumdur (9 tür × 9 mood); repo
> artık 207'dir. Bu, §2(a)'nın malzeme tabanını genişletir ama kartezyen
> matris YASAK ilkesini değiştirmez (ANA_YASA §5.2).

### 2.3 (c) neden riskli — özet

1. **Metin render hataları:** model harf/kelime bozabilir; Türkçe diakritikler
   (ş, ğ, ı, İ) ek risklidir. Posterde yanlış yazılmış bir şarkı adı ürünü
   güvenilmez gösterir.
2. **Maliyet:** her yeniden üretim tam bir görsel çağrısıdır; kullanıcı
   denemeleri maliyeti doğrusal artırır.
3. **Marka/benzerlik:** gerçek kişi benzerliği, grup logosu, albüm kapağı veya
   telifli karakter sızabilir — hukuki ve etik risk.
4. **Tutarsızlık:** aynı kullanıcı için iki üretim farklı estetik verebilir;
   "tasarım ailesi" tutarlılığı (ARCHITECTURE §6 kural 15) zedelenir.
5. **Gizlilik:** metni de üretmek için modele daha fazla kullanıcı bağlamı
   gönderilir; bu, veri minimizasyonu ilkesini zayıflatır.

---

## 3. Önerilen yol ve fazlı plan

**Öneri:** **Faz 0 → Faz 1 → (Faz 2 deneysel)** sırası. Gerekçe: Faz 0 bugün
**$0** ve **sıfır gizlilik riskiyle** değer üretir; hibrit (Faz 1) yalnız
ödeme yapan/sınırlı kullanıcılar için, kota ve moderasyon kontrolleriyle
eklenir; tam görsel-model posteri (Faz 2) yalnız **deneysel/preview** kalır ve
ayrı sahip onayı ister.

| Faz                  | İçerik                                                                                                                           | Maliyet                      | Ön koşul                                                           | Etiket                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| **Faz 0 (ücretsiz)** | Deterministik poster: mevcut Asset Registry + CSS/canvas katmanları + LLM lore. **Runtime görsel üretimi YOK.**                  | $0 marjinal                  | Mevcut motorlar (`poeticPoster`/`MasterPoster`) + veri modeli (§4) | `ÖNERİ`                       |
| **Faz 1 (hibrit)**   | Deterministik düzen + **tek** textless hero görseli; metin CSS/canvas. Ödeme yapan/sınırlı kullanıcı; kota + moderasyon + cache. | Görsel çağrısı başına (§2.1) | **S2 güvenlik PR'ı** (kota/authz/single-flight/concurrency) önce   | `ÖNERİ`                       |
| **Faz 2 (deneysel)** | ChatGPT / Apps SDK entegrasyon fikri; tam görsel-model posteri                                                                   | `bilinmiyor`                 | Ayrı sahip onayı; hukuki/etik gözden geçirme                       | `VARSAYIM` — belirsiz/preview |

> **Faz 2 uyarısı:** "ChatGPT / Apps SDK entegrasyonu" bir **fikirdir**, karar
> değildir. Sağlayıcı, sözleşme, gizlilik ve maliyet doğrulanmadan plana
> alınmamalıdır. Bu satır bilinçli olarak `preview/belirsiz` etiketlidir.

---

## 4. Veri modeli — "yaşam posteri" neden oluşur

### 4.1 Posteri oluşturan veri

Bir yaşam posteri **sıralı şarkı kayıtlarından** oluşur; her kayıt şu alanları
taşır:

| Alan           | Kaynak                                                | Zorunlu mu | Not                                                                      |
| -------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `song`         | MusicBrainz arama → `Song` (`src/lib/song/types.ts`)  | **Evet**   | Provider-neutral; tek zorunlu alan                                       |
| `encounterAge` | `resolveEncounterAge` (`src/lib/art/encounterAge.ts`) | Hayır      | `releaseYear - birthYear`; yoksa yaş bandı ortası; 0–100 dışı reddedilir |
| `mood`         | `moodInference` (`Song.mood`)                         | Hayır      | MOOD_FREEZE: bir kez hesaplanır, yeniden hesaplanmaz                     |
| `genre`        | `Song.genre` / `normalizeGenre`                       | Hayır      | Kanonik `GenreId` (23 tür)                                               |
| `era`          | `eraThemeForYear` / `primaryEra`                      | Hayır      | Dönem etiketi                                                            |
| `lore`         | `loreEngine.ts` (Gemini/OpenRouter → Groq → şablon)   | Hayır      | Sinematik metin; yaş sayısı yok                                          |
| `userNote`     | Kullanıcı (opsiyonel)                                 | Hayır      | **Kriz guard'ından geçmeli** (§6)                                        |

**Birleştirme:** Poster, Music Memory girdilerinden (varsa) + journey'nin 8
seçiminden deterministik olarak **kompoze edilir**. Eksik alan **eksik** kalır;
uydurulmaz (ANA_YASA §0). Sıralama: kronolojik (varsa `encounterAge`/tarih),
yoksa journey sırası.

### 4.2 Sürümleme / yeniden üretim / cache anahtarı

- **Stil sürümü:** Mevcut `LORE_STYLE_VERSION` (bugün `"lore-v6"`) deseni
  yeniden kullanılır → **`POSTER_STYLE_VERSION`** (`ÖNERİ`). Sürüm artırılınca
  eski poster cache'i geçersiz sayılır.
- **Cache anahtarı (mevcut deseni aynalar):** `useCardLore.cacheKey` bugün
  `${LORE_STYLE_VERSION}|${key}|${language}|${birthYear}|${encounterAge}|${mood}|${userMemory}`
  biçimindedir. Posteri için aynı mantık: `POSTER_STYLE_VERSION` + şarkı
  kimliği + dil + yaş + mood + (varsa) not.
- **Yeniden üretim:** Faz 0'da ücretsiz (deterministik, sınırsız). Faz 1'de
  **kotalı** (bkz. §7). Her yeniden üretim yeni bir `POSTER_STYLE_VERSION`
  altında değil, aynı sürüm içinde yeni bir görsel varyantı üretir.

### 4.3 Depolama (Supabase + RLS + Storage) — `ÖNERİ`

Mevcut desen birebir izlenir (`CURRENT`: `cards` tablosu + private
`card-artworks` bucket; RLS `auth.uid() = user_id`; storage yolu
`<user_id>/<file>` — ilk segment `auth.uid()` olmalı).

| Bileşen      | Öneri                                                                          | Mevcut eşdeğeri                         |
| ------------ | ------------------------------------------------------------------------------ | --------------------------------------- |
| Tablo        | `posters` (user_id, track_key/poster_key, state jsonb, image_path, created_at) | `cards` (migration 0003)                |
| RLS          | select/insert/update/delete `auth.uid() = user_id`                             | aynı desen                              |
| Bucket       | `poster-artworks` (**private**), yol `<user_id>/<uuid>.<ext>`                  | `card-artworks`                         |
| Okuma        | Signed URL (kısa ömürlü), raw URL 404                                          | `cards-remote.ts::resolveCardImageUrls` |
| Silme        | Hesap silinince `on delete cascade` + Storage objesi temizliği                 | migration 0001–0005 cascade             |
| Dışa aktarma | Kullanıcı kendi posterini PNG indirir; veri dışa aktarımı (export)             | `MasterPosterModal` indirme             |

> **Not:** Migration **yazılmaz**; şema onayı beklenir (STATE "onay olmadan
> migration yok").

---

## 5. Mimari uyum (değişmez kararlar)

### 5.1 Yeniden ifade edilen kalıcı kararlar

| Karar                                                                | Kaynak                                                                  | Bu işte anlamı                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| LLM yalnız **anlatır**, hesaplamaz                                   | STATE temel ilke; ANA_YASA §0                                           | Poster yapısını LLM belirlemez; lore metni LLM'den gelir      |
| Deterministik katman **hesaplar**                                    | `src/lib/ai/pipeline.ts`                                                | Yaş/mood/tür/dönem deterministik; poster düzeni deterministik |
| **Runtime görsel üretimi İSTİSNADIR** ve **açık sahip kararı** ister | ANA_YASA §9                                                             | Faz 1 görsel çağrısı bu istisnadır → **Açık Karar #1** (§8)   |
| Görseller **metinsizdir**; metin CSS'ten                             | HANDOFF §6 madde 4                                                      | Görselde metin olmaz; tipografi ayrı katman                   |
| Server route'ları **JWT ile doğrulanır**                             | `generateCard.server.ts` (`auth.getUser(token)`)                        | Poster üretimi de çağıranın JWT'siyle çalışır                 |
| **Per-user kota**                                                    | `generateCard.server.ts::DAILY_LIMIT`; PR #11 `reserve_card_generation` | Poster üretimi kotaya tabi                                    |
| İstemcide **service_role yok**                                       | HANDOFF §5b madde 5                                                     | Yalnız anon key + kullanıcının JWT'si                         |

### 5.2 Mevcut modüllere bağlanma noktaları (`CURRENT`)

| Modül                                                                     | Rol                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/visual/assetRegistry.ts`                                         | 207 kayıtlı backdrop (genre×mood) — Faz 0 malzemesi             |
| `src/lib/visual/visualResolver.ts` / `src/types/visualSpec.ts`            | Deterministik görsel çözüm (`fallbackTrace`)                    |
| `src/components/scene/SceneRoom.tsx`                                      | Mood/genre/dönem ışıklı "oda" arka planı                        |
| `src/components/journey/EraCardReveal.tsx`                                | Era kartı anı (kart + gizle/göster + poster)                    |
| `src/lib/art/loreEngine.ts`                                               | Lore metni hattı (aday seçimi + sert/yumuşak filtre + şablon)   |
| `src/lib/soundmap/poeticPoster.ts`                                        | Uzun PNG motoru (2400 geniş × ≥3600) — **ana geliştirme adayı** |
| `src/components/results/MasterPosterSheet.tsx` + `MasterPosterCanvas.tsx` | 2:3 DOM yüzeyi (1024×1536; export 2048×3072)                    |
| `src/lib/ai/posterRenderer.ts` + `posterModel.ts`                         | 1400×2000 canvas posteri (mevcut yüzey)                         |
| `src/lib/ai/pipeline.ts`                                                  | Deterministik Music DNA                                         |
| `src/lib/art/encounterAge.ts`                                             | Yaş-at-encounter çözümü                                         |

> **Kural:** Yeni bir poster motoru OLUŞTURULMAZ; yukarıdaki mevcut yüzeylerden
> biri (öneri: `poeticPoster` / `MasterPoster`) genişletilir (HANDOFF §1b).

---

## 6. Music Memory v1

### 6.1 Model (v1)

- **Şarkı zorunlu** (tek zorunlu alan). Opsiyonel: `date`, `place`, `feeling`,
  `note`.
- Kullanıcıya ait tablo, **RLS owner-only** (`auth.uid() = user_id`).
- **Zaman çizelgesi (timeline) görünümü:** kayıtlar zamana göre; kayıt zamanı
  değil, anın zamanı esas.

| Alan      | Zorunlu  | Not                                               |
| --------- | -------- | ------------------------------------------------- |
| `song`    | **Evet** | Provider-neutral `Song` veya serbest metin etiket |
| `date`    | Hayır    | Anın zamanı                                       |
| `place`   | Hayır    | Serbest metin / yer adı                           |
| `feeling` | Hayır    | **Kriz guard'ından geçer** (§6.3)                 |
| `note`    | Hayır    | **Kriz guard'ından geçer** (§6.3)                 |

> `docs/PRODUCT/MUSIC_MEMORY.md` ve `docs/TECH/DATABASE_PLAN.md` (DRAFT) bu
> modelin öncülüdür; ikisi de "henüz inşa edilmedi" der. Bu bölüm onları
> onaylamaz, yalnız posterle ilişkisini netleştirir.

### 6.2 ⚠️ AÇIK KARAR (sahip onayı gerekli) — kriz guard'ı

**Durum:** `note` ve `feeling` **serbest metin** alanlarıdır. Mevcut kural
(ETHICAL_AI §3a/§3b/§3c): kullanıcının kendi serbest metni, **herhangi bir LLM
çağrısından önce** aynı deterministik `crisisGuard`'dan (`detectCrisisNote`)
geçmelidir; tetiklenirse metin LLM'e **gitmez**, kalıcılaşmaz ve kullanıcıya
`CrisisSupportPanel` gösterilir.

**Sorun:** ETHICAL_AI **§3d** (çıktı-filtresi) ve **§3e** (`userMemory` kriz
koruması) şu an **kapsam dışı** işaretlidir ve "ONAYSIZ ekleme" yasaktır.
`userMemory` alanı kodda var ama QuizCard'dan beslenmiyor (dead-plumb).

**Gereken karar:** Music Memory v1'in `note` + `feeling` alanları da **AYNI
mevcut guard'dan** geçmeli — **yeni desen eklenmez**, `crisisGuard.ts` ve
`crisisGuard.test.ts` (5 dil) kanıt kabul edilir. Bu, ETHICAL_AI §3e'nin
"kapsam dışı" statüsünü değiştirdiği için **sahibin açık onayı şarttır** (bkz.
§8 Açık Karar #3).

**Onaylanırsa uygulama sırası:** metin → `detectCrisisNote` → (temizse) LLM'e →
(değilse) `CrisisSupportPanel`; hiçbir durumda ham metin LLM'e gitmez.

### 6.3 Gizlilik / rıza sonuçları

| Konu                       | Durum (`CURRENT` / risk)                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Doğum yılı**             | `profiles.birth_year` (migration 0004) kişisel veri; HANDOFF §5b madde 1: rıza metni + silme akışı **YOK**               |
| **Notlar**                 | Kişisel/serbest metin; minimizasyon ve silme gerekir                                                                     |
| **Hesap silinince silme**  | `on delete cascade` var (tablolar), ama uçtan uca silme akışı + Storage temizliği **YOK**                                |
| **Anonim hesap temizliği** | HANDOFF §5b madde 6: anonim kullanıcı birikimi temizliği **YOK**                                                         |
| **Dışa aktarma**           | Kullanıcının kendi verisini indirmesi/taşıması tasarlanmalı                                                              |
| **Veri minimizasyonu**     | Faz 1'de sağlayıcıya yalnız yapısal sinyal (şarkı/tür/mood) gönderilmeli; **kullanıcı notu gönderilmemeli** (varsayılan) |

---

## 7. Kötüye kullanım / maliyet kontrolleri

| Kontrol                         | Ne                                                   | Mevcut durum                                                                                |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Kullanıcı başına kota**       | Görsel üretimi başına günlük tavan                   | `CURRENT`: kart için `DAILY_LIMIT = 20`; PR #11 `reserve_card_generation` (24 saat, atomik) |
| **Regenerate tavanı**           | Poster yeniden üretimi günde N                       | `ÖNERİ` (§1.4)                                                                              |
| **Anonim hesaplar ücretsiz**    | Anon kullanıcı da üretebilir → kötüye kullanım riski | **IP bazlı düşünme + captcha** düşünülmeli (`ÖNERİ`)                                        |
| **Single-flight**               | Aynı istek için tek üretim                           | PR #11'de bounded single-flight var (`CURRENT` o dalda, main'de DEĞİL)                      |
| **Eşzamanlılık limiti**         | Kuyruk boyutu sınırı                                 | PR #11'de var (`CURRENT` o dalda, main'de DEĞİL)                                            |
| **Görsel moderasyonu**          | Üretilen görselin içeriği                            | Sağlayıcı tarafı + kendi kontrolümüz (`ÖNERİ`)                                              |
| **Gerçek kişi benzerliği**      | Ünlü/kişi yüzü olmamalı                              | Prompt kısıtı + moderasyon (`ÖNERİ`)                                                        |
| **Telifli karakter/logo/kapak** | Postere gömülmemeli                                  | Prompt kısıtı + lisans kuralı (HANDOFF §1b)                                                 |

> **Önemli:** Bu kontrollerin çoğu **PR #11 (`phase-1/generation-security`)**'de
> hazırdır ama main'e **birleştirilmemiştir** (Lovable geçmişi; HANDOFF §1 NOT).
> Faz 1 (hibrit), bu güvenlik katmanı **önce** main'e alınmadan başlatılmamalıdır.

---

## 8. Riskler, açık kararlar, görev kırılımı

### 8.1 Riskler

| #   | Risk                                                   | Etki          | Azaltma                                                    |
| --- | ------------------------------------------------------ | ------------- | ---------------------------------------------------------- |
| R1  | Runtime görsel üretimi ANA_YASA §9 istisnasını büyütür | Mimari sapma  | Açık Karar #1; varsayılan Faz 0                            |
| R2  | Görsel sağlayıcı maliyeti ölçümsüz                     | Bütçe         | Kota + gerçek ölçüm (§1.4)                                 |
| R3  | Metin render hatası (Faz 2)                            | Kalite/güven  | Faz 1'de metin kod çizer                                   |
| R4  | Kriz guard'ı serbest metne uygulanmazsa                | Etik/güvenlik | Açık Karar #3                                              |
| R5  | Kişisel veri (doğum yılı/not) için rıza/silme yok      | KVKK/GDPR     | HANDOFF §5b; ayrı iş                                       |
| R6  | Anonim kullanıcı kötüye kullanımı                      | Maliyet       | IP/captcha düşüncesi (§7)                                  |
| R7  | Telifli görsel sızması                                 | Hukuki        | Prompt kısıtı + moderasyon                                 |
| R8  | Asset çeşitliliği (207 kayıt) tekrara düşer            | Kalite        | Deterministik kompozisyon katmanları + küratörlü genişleme |

### 8.2 Açık kararlar (numaralı) — **2026-11-14: TÜMÜ ONAYLANDI (APPROVED)**

> **Durum:** Aşağıdaki 7 karar sahibi tarafından **ONAYLANDI** ("Önerilere
> katılıyorum"). Öneriler (`Öneri: …`) onaylanan karardır; özgün A/B/C
> seçenekleri KORUNDU. Ayrıntılı tablo: **Karar kaydı (2026-11-14)**.

1. **Runtime görsel üretimi (Faz 1) onaylanacak mı?** — **APPROVED (2026-11-14)**
   Seçenekler: (A) Hayır, yalnız Faz 0 · (B) Evet, Faz 1 hibrit (kota+moderasyon)
   · (C) Yalnız Faz 2 preview. **Öneri: (B)**, ama S2 güvenlik PR'ı sonrası.
   → **Karar: (B) EVET, yalnız S2 sonrası; Faz 0 önce.**
2. **Faz 1 hangi sağlayıcı?** — **APPROVED (2026-11-14)**
   (A) Gemini Flash Image · (B) OpenAI image · (C) sağlayıcı-agnostik adapter.
   **Öneri: (C) adapter** (ANA_YASA §9 "provider adapter" hedefiyle uyumlu).
   → **Karar: (C) sağlayıcı-agnostik adapter.**
3. **`note`/`feeling` kriz guard'ı (ETHICAL_AI §3d/§3e onayı).** — **APPROVED (2026-11-14)**
   (A) Onayla — aynı `crisisGuard`, yeni desen yok · (B) Reddet (v1'de serbest
   metin yok). **Öneri: (A)**, kanıt `crisisGuard.test.ts`.
   → **Karar: (A); ETHICAL_AI §3e statüsü DEĞİŞİR; uygulama görevi MM-3.**
4. **Music Memory v1 şeması onaylanacak mı?** — **APPROVED (2026-11-14)**
   (A) Evet · (B) Değişiklik iste. **Öneri: (A)**, `docs/TECH/DATABASE_PLAN.md`
   gerçek şemayla hizalanarak. → **Karar: (A) EVET.**
5. **Poster yeniden üretim tavanı?** — **APPROVED (2026-11-14)**
   (A) 5/gün · (B) 10/gün · (C) sınırsız. **Öneri: (A)** (`VARSAYIM`).
   → **Karar: (A) 5/gün.**
6. **Poster çıktı ölçüsü?** — **APPROVED (2026-11-14)**
   (A) 2048×3072 (2:3, mevcut master) · (B) 2400×3600 (poeticPoster).
   **Öneri: (A)** — mevcut master ile uyumlu. → **Karar: (A) 2048×3072 (2:3).**
7. **Sağlayıcıya kullanıcı notu gönderilsin mi?** — **APPROVED (2026-11-14)**
   (A) Hayır (varsayılan) · (B) Evet (rıza ile). **Öneri: (A)** — veri
   minimizasyonu. → **Karar: (A) HAYIR.**

### 8.3 Görev kırılımı (küçük PR'lar)

> **S2 = PR #11 `phase-1/generation-security`** (kota/authz/single-flight/
> concurrency). Faz 1 görevleri **S2 önce** işaretlidir.

| PR       | Başlık                                          | Kapsam                    | Kabul kriteri                                   | Testler                      | S2?             |
| -------- | ----------------------------------------------- | ------------------------- | ----------------------------------------------- | ---------------------------- | --------------- |
| **D1**   | `docs: sinematik yaşam posteri tasarımı`        | Bu dosya                  | Doküman repoda; `prettier --check` temiz        | — (docs)                     | —               |
| **D2**   | `docs(handoff): §1 güncelle`                    | HANDOFF §1                | Git gerçeğiyle uyumlu                           | — (docs)                     | —               |
| **P0-1** | `feat(poster): yaşam posteri veri modeli (saf)` | Tip + kompoze fonksiyonu  | Eksik alan uydurulmaz; birim test               | `posterModel.test.ts`        | —               |
| **P0-2** | `feat(poster): deterministik düzen çekirdeği`   | Layout spec               | Seed-deterministik; aynı girdi→aynı çıktı       | golden layout testi          | —               |
| **P0-3** | `feat(poster): canvas renderer + PNG export`    | `poeticPoster` genişletme | 2:3; metin textless katman üstünde              | renderer testi (jsdom)       | —               |
| **P0-4** | `feat(poster): results/journey yüzeyine bağla`  | UI wiring                 | Kural-10 göz onayı                              | bileşen testi                | —               |
| **P0-5** | `feat(poster): POSTER_STYLE_VERSION + cache`    | Cache anahtarı            | Sürüm artışı cache'i geçersiz kılar             | cache testi                  | —               |
| **MM-1** | `feat(memory): memories tablosu + RLS`          | Migration                 | Owner-only RLS; cascade                         | RLS testi                    | — (onay §8.2/4) |
| **MM-2** | `feat(memory): her an şarkı ekleme + timeline`  | UI                        | Şarkı zorunlu; opsiyoneller boş kalabilir       | bileşen testi                | —               |
| **MM-3** | `feat(safety): note/feeling crisis guard`       | Guard wiring              | **Yeni desen yok**; `crisisGuard.test.ts` kanıt | `crisisGuard.test.ts`        | — (onay §8.2/3) |
| **P1-1** | `feat(poster): hibrit hero üretimi`             | Tek görsel çağrısı        | Metin görselde değil                            | sağlayıcı mock + entegrasyon | **Evet**        |
| **P1-2** | `feat(poster): üretim kotası + single-flight`   | Kota                      | Anon dahil; eşzamanlılık sınırlı                | kota testi                   | **Evet**        |
| **P1-3** | `feat(poster): görsel moderasyon kısıtları`     | Moderasyon                | Kişi/logo/kapak reddi                           | prompt/moderasyon testi      | **Evet**        |

---

## 9. Sahibin karar vermesi gerekenler (en fazla 8) — **2026-11-14: TÜMÜ ONAYLANDI**

> **Sahibin yanıtı (birebir):** "Önerilere katılıyorum". Aşağıdaki 8 maddenin
> TAMAMI **APPROVED** (2026-11-14). Özgün seçenekler KORUNDU; onay işareti
> `→ **Karar:**` satırındadır. Ayrıntı: **Karar kaydı (2026-11-14)**.

1. Runtime görsel üretimi onaylanacak mı (Faz 1 hibrit)? **Evet / Hayır**
   → **Karar: EVET** (yalnız S2 güvenlik PR'ı main'e alındıktan sonra; Faz 0 önce).
2. Faz 1 sağlayıcısı: **A)** Gemini Flash Image · **B)** OpenAI image · **C)** adapter
   → **Karar: C) sağlayıcı-agnostik adapter** (Gemini Flash Image deprecated, 2027-03-15 kapanır).
3. `note`/`feeling` aynı `crisisGuard`'dan geçsin mi (ETHICAL_AI §3e onayı)? **Evet / Hayır**
   → **Karar: EVET** — aynı `detectCrisisNote`, yeni desen yok; her LLM/görsel-sağlayıcı çağrısından ÖNCE; kanıt `crisisGuard.test.ts`. Uygulama = MM-3.
4. Music Memory v1 şeması onaylanacak mı? **Evet / Değişiklik iste**
   → **Karar: EVET** (uygulanırken `docs/TECH/DATABASE_PLAN.md` gerçek şemayla hizalanır).
5. Poster yeniden üretim tavanı: **A)** 5/gün · **B)** 10/gün · **C)** sınırsız
   → **Karar: A) 5/gün.**
6. Poster çıktı ölçüsü: **A)** 2048×3072 (2:3) · **B)** 2400×3600
   → **Karar: A) 2048×3072 (2:3).**
7. Sağlayıcıya kullanıcı notu gönderilsin mi? **Evet / Hayır**
   → **Karar: HAYIR** (veri minimizasyonu; not modele girer ama sağlayıcıya GÖNDERİLMEZ).
8. Faz 1, S2 güvenlik PR'ı (#11) main'e alınmadan başlatılabilir mi? **Evet / Hayır**
   → **Karar: HAYIR.**

---

## 10. Referanslar

- `STATE.md` — kalıcı kurallar (vizyon, dal topolojisi, çalışma kuralları)
- `docs/ARCHITECTURE.md` §6–§7 — görsel dil standartları + çıktı ölçüleri
- `docs/TECH/ARCHITECTURE.md`, `docs/TECH/VISUAL_ARCHITECTURE.md` — görsel sistem
- `docs/ANA_YASA.md` §0, §9 — uydurma yasağı, runtime üretim istisnası
- `docs/ETHICAL_AI.md` §3a–§3e — kriz guard sözleşmesi
- `docs/PRODUCT/PRODUCT_VISION.md`, `docs/PRODUCT/MUSIC_MEMORY.md`
- `docs/TECH/DATABASE_PLAN.md` (DRAFT) — önerilen şema
- `docs/HANDOFF.md` §1, §1b, §5b — mevcut durum ve beta öncesi riskler
- Fiyat kaynakları: https://ai.google.dev/gemini-api/docs/pricing ·
  https://platform.openai.com/docs/pricing (2026-11-11 okundu)

_DOCUMENTATION-ONLY. Kod, migration, config, `.env`, asset değişmedi._
