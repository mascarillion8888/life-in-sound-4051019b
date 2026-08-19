# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her operasyon sonunda TAMAMEN yeniden yazılır.
> `STATE.md` anayasa (kalıcı kurallar), bu dosya "şu an". Her AI oturumu
> ilk iş olarak bunu BAŞTAN SONA okur — 100 satırdan uzunsa kısalt.
> Eski hali: `git log -p -- HANDOFF.md`.

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      [bu commit] — checkpoint: QuestionCard manuel giriş + HANDOFF güncellendi
Senkron:  (push sonrası EVET)
Testler:   87/87 (8 dosya) — 2026-08-19
tsc/build: temiz (0, 0)
Worktree:  temiz
```
Doğrula: `git status && git log --oneline -3 && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

MusicBrainz manuel giriş düzeltmesi uygulandı. `Song.provider` literal union
yapıldı (`"musicbrainz" | "manual"`); `musicbrainz-mapping.ts` iç tipleri
buna hizalandı. QuestionCard seçici diyaloguna her zaman görünen
"Bulamadım, kendim yazacağım" butonu eklendi — tıklanınca arama kutusundaki
metni `provider:"manual"` + `crypto.randomUUID()` ile bir Song'a çevirip
`onChoose`'a gönderir, picker kapanır. MusicBrainz araması korundu (varsayılan
yol), sadece zorunlu olmaktan çıktı. `displayName` manuel girişte artist
boş olduğunda trailing dash üretmemesi için düzeltildi. 7 yeni test eklendi
(mevcut 10'a dokunulmadı); ROADMAP.md'ye "Validation Gate öncesi zorunlu bug fix"
notu düştü. Kalıcılık/F5 ekstra iş gerektirmedi (aynı Song tipi).

---

## 3. Şu an açık/bekleyen tek şey

MusicBrainz manuel giriş düzeltmesi TAMAMLANDI. Sıradaki gerçek öncelik
**Validation Gate** (Adım 5): ürün akışını 5+ gerçek kişiye gösterme, geri
bildirim toplama. Bu yapılmadan Faz 4'e geçilmez.

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
Faz 4 tasarımına (DATABASE_PLAN.md onayı + memories migration) geçmeden önce
kullanıcı onayı bekle.

**🅑 Kullanıcı manuel girişte bir sorun bildirirse →**
Sorunu teyit et, `QuestionCard.tsx` + testlerinde düzelt, HANDOFF'u yeniden yaz,
checkpoint commit.

**🅒 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden yaz,
`checkpoint: [özet] — HANDOFF.md güncellendi` formatıyla push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**Kaynak doğrulama disiplini:** Bu düzeltmenin spesifikasyonu (`FIX_manual_song_entry.md`)
repoda veya git geçmişinde **mevcut değildi** — önceki bir Claude sohbetinde
üretilmiş ama repoya hiç kaydedilmemişti. 7 kriterlik arama (find, git log --all,
git grep, tüm dallar, tüm docs/) NEGATİF dönünce DUR + kullanıcıya sor makul
karardı. Kullanıcı (a) cevabını + tam spesifikasyonu verince uygulandı. Ders:
**atfedilen bir dosya/spesifikasyon uygulanmadan önce mevcudiyeti mekanik olarak
doğrulanmalı** — "daha önce verildi" iddiası tek başına yetmez. Kaynağın nerede
olduğu (sohbet geçmişi mi, repo dosyası mı) kayıt altına alınmalı.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨 yasak).

---

## 7. Devir kaydı (son 5 satır)

| Tarih | Kim | Ne | Commit |
|---|---|---|---|
| 2026-08-19 | OpenHands | Bileşen testleri + testing-library (80/80) + microagent | a620ad5 |
| 2026-08-19 | OpenHands | HANDOFF sistemi: STATE bölündü, AGENTS sıra, handoff-check CI | 5ea6114 |
| 2026-08-19 | Claude+OpenHands | QuestionCard manuel giriş (provider:"manual", buton, 7 test) | [bu commit] |

---
_2026-08-19 OpenHands tarafından tamamen yeniden yazıldı._
_Kaynak notu: §2 düzeltme spesifikasyonu önceki bir Claude sohbetinde üretilmiştir; repoda `FIX_manual_song_entry.md` hiç olmadı. Bu satır tekrar karışıklığı önler._
