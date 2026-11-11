# Asset Rehberi — backdrop dosyaları

Bu dosya, sahne **backdrop** görsellerinin adlandırma sözleşmesini, nasıl
ekleneceğini ve teknik kuralları anlatır. Kayıt ELLE tutulmaz: dosyalar
`src/assets` altında olduğu sürece `import.meta.glob` ile otomatik bulunur
(`src/lib/visual/backdropRegistry.ts`). **Kod değişikliği gerekmez.**

> **Metinsiz kuralı (ZORUNLU):** Backdrop görselleri **TAMAMEN METİNSİZDİR** —
> üzerinde yazı, harf, logo, marka, gerçek albüm kapağı veya gerçek kişi
> yüzü OLMAZ. Tüm tipografi uygulama tarafından (CSS/canvas) ayrı katmanda
> çizilir. Gerekçe: `docs/ARCHITECTURE.md` §6 (Katman Ayrımı, Okunabilirlik) ve
> `docs/ANA_YASA.md` §0 (uydurma yasak).

## 1. Dosya adı sözleşmesi

| Biçim                                | Örnek                                | Anlamı                                                                                    |
| ------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `mood-backdrop-<mood>.jpg`           | `rock/mood-backdrop-melancholic.jpg` | **Eski** biçim (dönemsiz). Registry bunu **1980s** sayar. Mevcut 207 dosya bu biçimdedir. |
| `{genre}-{mood}-{decade}.{jpg,webp}` | `rock-melancholic-1970s.webp`        | **Yeni** dönemli biçim.                                                                   |

- `<mood>` / `{mood}`: 9 kapalı mood'dan biri, **küçük harf**: `energetic`,
  `euphoric`, `playful`, `romantic`, `melancholic`, `dreamy`, `nostalgic`,
  `dark`, `world`.
- `{decade}`: `1960s`, `1970s`, `1980s`, `1990s`, `2000s`, `2010s`, `2020s`
  (küçük `s`). Dönem eklenmezse dosya **1980s** sayılır.
- `{genre}`: kanonik tür kimliği (`pop`, `rock`, `hiphop`, `new age`, …).
  Klasör adıyla aynı; **tek istisna** `hiphop` → klasör `hip-hop/`.
- Dönemli dosya `src/assets/<klasör>/` içine **veya** doğrudan
  `src/assets/` köküne konabilir.

### Nasıl yeni backdrop eklenir

1. Dosyayı yukarıdaki adla `src/assets/...` içine bırak (örn.
   `src/assets/rock-melancholic-1970s.webp`). **Kod/migration/commit yeter**;
   registry bir sonraki build'de dosyayı kendisi bulur.
2. `npm test -- --run src/lib/visual/visualSpec.test.ts` çalıştır — "her
   assetRef diske karşılık gelir" testi yeni dosyayı da doğrular.
3. Aynı tür+dönem için tüm mood'ları eklemek zorunlu DEĞİLDİR; eksik mood'lar
   deterministik fallback'e iner (bkz. §3).

## 2. Teknik özellikler (mevcut dosyalardan okundu)

| Özellik              | Değer                                     | Kaynak                                             |
| -------------------- | ----------------------------------------- | -------------------------------------------------- |
| Ölçü                 | **832 × 1248** (px)                       | `src/assets/*/mood-backdrop-*.jpg` — 207/207 dosya |
| En-boy oranı         | **2:3** (dikey)                           | 832/1248 = 2/3                                     |
| Biçim (mevcut)       | **JPG**                                   | 207/207 dosya                                      |
| Biçim (yeni, tercih) | **WebP** (daha küçük; aynı ad sözleşmesi) | `docs/ARCHITECTURE.md` §7 üretim hedefi            |
| Metin                | **YOK** (metinsiz)                        | §0                                                 |

> Not: `docs/ARCHITECTURE.md` §7 hedefi "1920×1080 WebP" der (16:9). Sahnedeki
> backdrop katmanı `background-size: cover` ile kırpıldığı için dikey 2:3
> kaynaklar da çalışır; **bugünkü gerçek dosyalar 832×1248 (2:3) JPG'dir.**
> Yeni dosya eklerken bu ölçüye/orana sadık kal (kırpma güvenliği).

## 3. Çözüm sırası (deterministik)

`resolveBackdrop` (`src/lib/visual/backdropRegistry.ts`) istenen
`{genre, mood, decade}` için sırayla dener:

1. **exact** — tam `genre+mood+decade`
2. **mood** — aynı `genre+decade`, en yakın mood
3. **decade** — aynı `genre+mood`, en yakın dönem (eşitlikte **sonraki** dönem)
4. **genre-decade** — aynı `genre`, en yakın dönem, herhangi mood
5. **default** — nötr varsayılan (pop mood duvarı)

Kayıt BOŞ olsa bile fonksiyon **throw etmez**; her zaman bir varsayılana iner.
Çözüm ayrıca `matchedDecade` ve `exact` (istenen dönem tam eşleşti mi) döner —
ileride bir dönem renk/grain katmanı bu bayrağa göre uygulanabilir (bu katman
henüz UYGULANMADI).

## 4. İlgili dosyalar

- `src/lib/visual/backdropRegistry.ts` — dosyadan türetilen kayıt + çözüm.
- `src/lib/visual/assetRegistry.ts` — 23 tür, genre eşanlamlıları, klasör eşlemesi.
- `src/lib/visual/visualResolver.ts` — `resolveSceneVisualSpec` (backdrop + tema + era).
- `src/components/scene/moodBackdrop.ts` — nötr (pop) mood duvarı, glob yardımcıları.
- `docs/TECH/VISUAL_ARCHITECTURE.md` §8 — Asset Registry kavramsal modeli.
