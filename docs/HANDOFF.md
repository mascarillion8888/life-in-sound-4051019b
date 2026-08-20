# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her operasyon sonunda TAMAMEN yeniden yazılır.
> `STATE.md` anayasa (kalıcı kurallar), bu dosya "şu an". Her AI oturumu
> ilk iş olarak bunu BAŞTAN SONA okur — 100 satırdan uzunsa kısalt.
> Eski hali: `git log -p -- docs/HANDOFF.md`.
> **TEK kaynak budur** — kök dizinde HANDOFF/ACTIVE_OPERATION dosyası TUTMA.

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (bu dosyanın içinde asla sabit yazılmaz — her zaman
            `git log -1 --oneline` ile kontrol et, bu doğru olan tek kaynak)
Senkron:   `git fetch && git status` ile doğrula
Testler:   86/86 geçti — 2026-08-20
tsc/build: temiz
Worktree:  temiz (vite.config.ts hariç tutuldu — DEV-ONLY, commitleme)
```
Doğrula: `git status && git log --oneline -3 && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

**Journey Step 4 — MusicBrainz arama UI'dan TAMAMEN kaldırıldı (TAMAMLANDI
+ görsel doğrulandı + kullanıcı onaylandı).**

Kullanıcı bir önceki checkpoint'te (serbest metin birincil, MusicBrainz
opsiyonel) sonra opsiyonel linki yine denedi: "Kapak görseli için ara"
tıklanınca hâlâ eski MusicBrainz modalı açılıyor ve hâlâ alakasız/obscure
sonuçlar dönüyor (aynı "Sting - Fragile" örneği). Net karar: **MusicBrainz'i
arayüzden tamamen kaldır** — opsiyonel olarak bile değil.

Değişen dosyalar:
- `src/components/journey/QuestionCard.tsx` — "Kapak görseli için ara
  (opsiyonel)" linki VE açtığı `SongPickerDialog` modalı VE `SearchState`
  tamamen kaldırıldı. Geriye tek akış: serbest metin kutusu + "Onayla"
  butonu + onay chip'i. Kullanılmayan importlar temizlendi (`useState`,
  `Loader2`, `Music2`, `Search`, Dialog bileşenleri, `searchSongs`,
  `SearchStatus`, `metaLine`, `songDisplay`). `manualSong()` korundu.
- `src/components/journey/QuestionCard.test.tsx` — `vi.mock(searchSong.server)`
  ve `searchSongs` importu kaldırıldı; tüm arama/modal testleri kaldırıldı.
  Kalan: serbest metin + onay akışı + "no search UI anywhere" regresyon
  kalkanı + trailing-dash chip render testi.
- `docs/MANAGEMENT/ROADMAP.md` — eski "Pre-gate bug fix (Bulamadım butonu)"
  notu "Pre-gate UI decision" olarak güncellendi: MusicBrainz UI'dan
  kaldırıldı (kullanıcı kararı, 2026-08-19), backend arşivde.

**Backend SİLİNMEDİ:** `searchSong.server.ts`, `musicbrainz-mapping.ts`
kodda duruyor — hiçbir UI bileşeni çağırmıyor. Gelecekte gerçek bir
kapak-görseli ihtiyacı çıkarsa farklı bir API ile yeniden
değerlendirilebilir (ayrı ve gelecekteki bir karar, şimdi değil).

**Doğrulama kapıları:** tsc=0, npm test 86/86 (7 dosya), build=0. **Görsel
doğrulama (STATE.md madde 10):** gerçek tarayıcıda Q1'de hiçbir arama
linki/butonu GÖRÜNMÜYOR (sadece metin kutusu + Onayla) ✅; E2E "Sting -
Fragile" yaz → Onayla → MusicBrainz beklemeden Next → Q2'ye geçti ✅;
localStorage `songs:{1:{provider:"manual",title:"Sting - Fragile",
artist:""}}` retain ✅. Ekran görüntüleri: `browser_screenshot_75c2aa82.png`
(temiz Q1, arama linki yok), `browser_screenshot_9c69f9d1.png` (Onayla
sonrası chip), `browser_screenshot_90f3c1cd.png` (Q2 advanced).

**Önceki checkpoint (7a8a56a):** serbest metin birincil + MusicBrainz
opsiyonel link. Bu checkpoint o opsiyonel linki de kaldırdı — kararlılık.

---

## 3. Şu an açık/bekleyen tek şey

MusicBrainz UI kaldırması TAMAMLANDI ve push edildi. Sıradaki gerçek öncelik
**Validation Gate** (Faz 4 öncesi): ürün akışını 5+ gerçek kişiye gösterme,
geri bildirim toplama. Bu yapılmadan Faz 4'e geçilmez.

**Sıradaki tek adım:**
```
Kullanıcı tarafından yönlendirilir — Validation Gate insan-ludik bir adımdır
(5+ kişiye ürünü göster), AI oturumu içinden çalıştırılabilir bir kod komutu
değil. AI adımı: YOK. Kullanıcı onayı olmadan Faz 4 (User Accounts) başlatma.
Kullanıcı kendi makinesinde `git pull` + `npm run dev` ile deneyecek.
```

---

## 4. Olası sonuçlar

**🅐 Kullanıcı Validation Gate'i yaptığını bildirir →**
Gerçek kullanıcı geri bildirimini topla, `docs/PRODUCT/` altına not düş.
Faz 4 tasarımına geçmeden önce kullanıcı onayı bekle.

**🅑 Kullanıcı serbest metin akışında bir sorun bildirirse →**
Sorunu teyit et, `QuestionCard.tsx`/`journey.tsx` + testlerinde düzelt,
HANDOFF'u yeniden yaz, checkpoint commit.

**🅒 Kullanıcı kapak görseli isterse →** Bu AYRI ve gelecekteki bir karardır.
MusicBrainz'i geri getirme; farklı bir API (örn. Spotify/Apple Music search
+ cover art) ile yeni bir değerlendirme yap. Şimdi değil.

**🅓 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden
yaz, `checkpoint: [özet] — HANDOFF.md güncellendi` formatıyla push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**Opsiyonel köprüyı bırakmak, kararı erteler.** Bir önceki checkpoint "MB
opsiyonel olsun, link kalsın" demişti — kullanıcı o linki yine tıkladı ve
aynı kötü sonucu gördü. Ders: **kullanıcı tutarsız bir kaynağı opsiyonel
olarak bile görmek istemiyorsa, köprüyü tamamen kaldır.** Yarım çözüm
(opsiyonel link) kullanıcıyı tekrar aynı hayal kırıklığına götürür.
Kararlılık: kök nedeni (MB bir arama motoru değil) kabul et, geri dönüş
yolunu kapat.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨 yasak).
- `vite.config.ts`'i commit etme — DEV-ONLY `allowedHosts` bulut preview
  içindir, kullanıcı kendi makinesinde çalışacak, repoda olmamalı.
- MusicBrainz backend dosyalarını (`searchSong.server.ts`,
  `musicbrainz-mapping.ts`) SİLME — arşivde dursun, hiçbir UI çağırmasın.
- MusicBrainz'i UI'a geri getirme — kullanıcı net karar verdi.

---

## 7. Devir kaydı (son 5 satır)

| Tarih | Kim | Ne | Commit |
|---|---|---|---|
| 2026-08-19 | OpenHands | HANDOFF sistemi: STATE bölündü, handoff-check CI | 5ea6114 |
| 2026-08-19 | Claude+OpenHands | QuestionCard manuel giriş (provider:"manual", buton) | 053bd4a |
| 2026-08-20 | OpenHands | metaLine + isValidSong artist restore fix | 482a292 |
| 2026-08-20 | OpenHands | Journey Step 4 UI tersine çevirme (text birincil, MB opsiyonel) | 7a8a56a |
| 2026-08-20 | OpenHands | MusicBrainz arama UI'dan tamamen kaldırıldı | (bu checkpoint — `git log -1 --oneline` ile doğrula) |

---
_2026-08-20 OpenHands tarafından tamamen yeniden yazıldı. MusicBrainz
arama UI'dan tamamen kaldırıldı; backend arşivde. Tek kaynak
`docs/HANDOFF.md`._
