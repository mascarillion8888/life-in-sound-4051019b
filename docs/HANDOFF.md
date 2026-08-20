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
Testler:   90/90 geçti — 2026-08-20
tsc/build: temiz
Worktree:  temiz (vite.config.ts hariç tutuldu — DEV-ONLY, commitleme)
```
Doğrula: `git status && git log --oneline -3 && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

**Journey Step 4 — manuel şarkı girişi UI tersine çevirmesi (TAMAMLANDI +
görsel doğrulandı + kullanıcı onaylandı).**

Kullanıcı MusicBrainz arama kalitesini 3. kez raporladı: "Sting - Fragile"
aratınca Sting'in orijinali yerine "Tomi Paldanius" gibi obscure cover'lar
üstte çıkıyor. Karar: MusicBrainz bir metadata DB'sidir, tüketici arama
motoru değil — **serbest metin girişi BİRİNCİL, MusicBrainz araması
OPSİYONEL/ikincil** yapıldı.

Değişen dosyalar:
- `src/components/journey/QuestionCard.tsx` — birincil serbest-metin `<Input>`
  (placeholder "örn. Bad - Michael Jackson", aria-label "Şarkı ve sanatçı
  adını yaz") + "Onayla" butonu (boşken disabled; Enter da commit eder).
  MusicBrainz araması artık ikincil link "Kapak görseli için ara (opsiyonel)".
  Modal içi "Bulamadım, kendim yazacağım" butonu **kaldırıldı** (manuel giriş
  artık birincil olduğu için modalda gerek yok). Yeni yardımcılar
  `manualSong(text)` (provider:"manual", title=text, artist:"") ve
  `songDisplay(song)` ("title — artist" prefille). `onChoose`/Song tipi/
  kalıcılık değişmedi.
- `src/routes/journey.tsx` — `draft` state parent'a taşındı; Next butonu
  pending draft'ı senkron commit eder (blur/setState race yok). `canAdvance`
  pending draft'ı hesaba katar. Restore + soru-değişim effect'leri draft'ı
  prefille; `startNewJourney` draft'ı temizler.
- `src/components/journey/QuestionCard.test.tsx` — her iki describe bloğu
  yeni davranışa hizalandı; trailing-dash selected-render testi korundu.

**Doğrulama kapıları:** tsc=0, npm test 90/90 (7 dosya), build=0. **Görsel
doğrulama (STATE.md madde 10):** E2E "Sting - Fragile" yaz → Onayla →
MusicBrainz beklemeden Next → Q2'ye geçti ✅; localStorage'da
`songs:{1:{provider:"manual",title:"Sting - Fragile",artist:""}}` retain
edildi; Q1'e geri dönünce chip görünüyor ✅. Ekran görüntüleri:
`browser_screenshot_e9bdbb4a.png` (AFTER UI), `browser_screenshot_37083548.png`
(commit+chip), `browser_screenshot_0e2efb0c.png` (Q2 advanced).

**Önceki checkpoint (482a292, hâlâ geçerli):** `metaLine()` yardımcı fn
(sonuç kartı bitişik metin fix) + `isValidSong` artist sözleşmesi uyumu
(manuel restore kaybı fix). Bu UI tersine çevirmesi onun üzerine inşa edildi.

---

## 3. Şu an açık/bekleyen tek şey

Journey Step 4 UI tersine çevirmesi TAMAMLANDI ve push edildi. Sıradaki
gerçek öncelik **Validation Gate** (Faz 4 öncesi): ürün akışını 5+ gerçek
kişiye gösterme, geri bildirim toplama. Bu yapılmadan Faz 4'e geçilmez.

**Sıradaki tek adım:**
```
Kullanıcı tarafından yönlendirilir — Validation Gate insan-ludik bir adımdır
(5+ kişiye ürünü göster), AI oturumu içinden çalıştırılabilir bir kod komutu
değil. AI adımı: YOK. Kullanıcı onayı olmadan Faz 4 (User Accounts) başlatma.
```

---

## 4. Olası sonuçlar

**🅐 Kullanıcı Validation Gate'i yaptığını bildirir →**
Gerçek kullanıcı geri bildirimini topla, `docs/PRODUCT/` altına not düş.
Faz 4 tasarımına geçmeden önce kullanıcı onayı bekle.

**🅑 Kullanıcı yeni UI'da bir sorun bildirirse →**
Sorunu teyit et, `QuestionCard.tsx`/`journey.tsx` + testlerinde düzelt,
HANDOFF'u yeniden yaz, checkpoint commit.

**🅒 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden
yaz, `checkpoint: [özet] — HANDOFF.md güncellendi` formatıyla push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**UI önceliklendirmesi kararlılık gerektirir.** MusicBrainz arama kalitesi
3 kez raporlanmıştı; her seferinde "arama iyileştirme" yerine kök karar
"aramayı birincil olmaktan çıkar" doğruydu. Bir arama motoru olmayan bir
metadata DB'sini birincil arama yolu olarak konumlamak, UX hatasının
tekrarını üretür. Ders: **kullanıcı tekrar eden bir şikayet bildiriyorsa,
düzeltme değil önceliklendirmeyi sorgula.**

Ayrıca: `draft` state'i component içinde değil parent'ta tutulmalı —
aksi halde Next onClick ile input blur'unun async setState'i arasında race
oluşur (Next eski `answers`'ı görür, "cevap yok" uyarısı verir).

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨 yasak).
- `vite.config.ts`'i commit etme — DEV-ONLY `allowedHosts` bulut preview
  içindir, kullanıcı kendi makinesinde çalışacak, repoda olmamalı.

---

## 7. Devir kaydı (son 5 satır)

| Tarih | Kim | Ne | Commit |
|---|---|---|---|
| 2026-08-19 | OpenHands | Bileşen testleri + testing-library + microagent | a620ad5 |
| 2026-08-19 | OpenHands | HANDOFF sistemi: STATE bölündü, handoff-check CI | 5ea6114 |
| 2026-08-19 | Claude+OpenHands | QuestionCard manuel giriş (provider:"manual", buton) | 053bd4a |
| 2026-08-20 | OpenHands | metaLine + isValidSong artist restore fix | 482a292 |
| 2026-08-20 | OpenHands | Journey Step 4 UI tersine çevirme (text birincil, MB opsiyonel) | (bu checkpoint — `git log -1 --oneline` ile doğrula) |

---
_2026-08-20 OpenHands tarafından tamamen yeniden yazıldı. Kök dizindeki
`HANDOFF.md`/`ACTIVE_OPERATION.md` geçici dosyaları silindi; tek kaynak
`docs/HANDOFF.md`._
