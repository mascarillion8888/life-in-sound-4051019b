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
Testler:   88/88 geçti — 2026-08-20
tsc/build: temiz
Worktree:  temiz (vite.config.ts hariç tutuldu — DEV-ONLY, commitleme)
LLM anahtarı: BU ORTAMDA YOK — GROQ/GEMINI/MISTRAL/OPENROUTER boş, .env yok.
              Canlı LLM Life Story doğrulaması KULLANICI makinesinde yapılmalı.
```
Doğrula: `git status && git log --oneline -3 && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

**Life Story prompt'unda grounding ayrımı netleştirildi (TAMAMLANDI +
prompt-içerik testleri + 3 gate yeşil; canlı LLM okuma doğrulaması
KULLANICI'DA BEKLEMEDE).**

Kullanıcı ChatGPT'nin orijinal deneyimdeki derinliği kanıtladı:
"Operation: Mindcrime"i kimlik sorgulama teması olarak yorumlamıştı çünkü
albümün gerçek içeriğini biliyordu. Eski GROUNDING_RULES bunu yasaklıyordu:
"Treat the supplied song titles as user-provided labels, not as evidence".
Bu kural iki farklı şeyi karıştırıyordu: (a) kullanıcının gerçek hayatını
uydurma (YASAK kalmalı), (b) şarkının/albümün gerçek, bilinen anlamını
kullanma (bu uydurma DEĞİL, LLM'in gerçek dünya bilgisidir — İZİN verilmeli).

Değişen dosyalar:
- `src/lib/llm/prompts.ts` — GROUNDING_RULES'te eski tek satır ("Do not
  invent song titles or artists. Treat the supplied song titles as
  user-provided labels, not as evidence about the user's actual life.")
  ikiye bölündü:
  1. "Do not invent song titles or artists that were not supplied." (yoksa
     uydurma — korundu)
  2. "If you have genuine knowledge of a supplied song's or album's real
     theme, mood, lyrical content, or cultural context, USE IT to enrich
     the interpretation — this is not fabrication, it is real-world
     knowledge about an existing work. What you must not do is invent facts
     about the USER's personal life (their real relationships, locations,
     dates, or events) — the song's own meaning is fair game, the user's
     biography is not." (yeni — izin veren + biyografiyi yasaklayan)
  TASK bloğuna eklendi: "Where you recognize the song or album, draw on its
  real, known themes and emotional tone to deepen the interpretation - don't
  just weave the title into generic prose. If you don't recognize a song,
  interpret it through the supplied personality profile instead, without
  pretending to know it."
  Diğer kurallar (kişisel hayat/ilişki/tarih uydurma yasağı) DEĞİŞMEDİ.
- `src/lib/llm/lifeStory.test.ts` — 2 yeni test: (i) yeni kural metninde
  "USE IT to enrich"/"fair game"/"user's biography is not" geçtiğini
  doğrular; (ii) TASK bloğunda "draw on its real, known themes"/"without
  pretending to know it" geçtiğini doğrular. Eski "invent facts" testi
  korundu.

**Güvenlik ilkesi korundu:** Şarkı/albüm hakkında gerçek bilgi kullanmak
"hallucination" değil — halka açık, doğrulanabilir bir gerçektir. Yasak
olan tek şey kullanıcının GERÇEK HAYATI hakkında (hiç sağlanmamış) bilgi
uydurmak. Bu ayrım netleştirildi; kullanıcı biyografisi yasağı değişmedi.

**Doğrulama kapıları:** tsc=0, npm test 86→88/88 (7 dosya, +2 yeni test),
build=0. **Prompt-içerik doğrulaması:** yeni cümleler `buildLifeStoryPrompt`
çıktısında test assertion'larıyla kanıtlandı (`prompts.ts` satır 37-38 +
97; anılabilir album adıyla üretilen prompt'ta kurallar mevcut).

**CANLI LLM DOĞRULAMASI — BEKLEMEDE:** Bu ortamda hiçbir provider anahtarı
(GROQ/GEMINI/MISTRAL/OPENROUTER) dolu değil ve `.env` yok. Bu yüzden
gerçek LLM Life Story çıktısını burada çalıştıramadım — uydurma çıktı
göstermeyi grounding ilkesi gereği reddettim. Kullanıcı kendi makinesinde
`git pull` + `npm run dev` (GROQ_API_KEY dolu) ile "Operation: Mindcrime"
/ "Painkiller - Judas Priest" gibi tanınır albumler girip Life Story
çıktısında o albümün gerçek temasına dair yorum var mı GÖZLE KONTROL
ETMELİ. Bu adım AI tarafından yapılamadı — kullanıcı onayı bekleniyor.

**Önceki checkpoint (7b27cd3):** MusicBrainz arama UI'dan tamamen
kaldırıldı. Bu checkpoint onun üstüne prompt derinliğini geri getirdi.

---

## 3. Şu an açık/bekleyen tek şey

Prompt ayrımı TAMAMLANDI ve push edildi. BEKLEYEN: canlı LLM okuma
doğrulaması (kullanıcı makinesinde). Sıradaki gerçek öncelik hâlâ
**Validation Gate** (Faz 4 öncesi): ürün akışını 5+ gerçek kişiye gösterme.

**Sıradaki tek adım:**
```
1) KULLANICI: git pull + npm run dev (GROQ_API_KEY dolu) → tanınır album gir →
   Life Story'de o albumun gerçek temasına dair yorum var mı GÖZLE KONTROL ET.
   Sonucu bildir; beklenen: "Operation: Mindcrime" → kimlik/iktidar teması
   yorumu görünür olmalı.
2) Validation Gate: 5+ kişiye ürünü göster, geri bildirim topla. AI adımı YOK.
   Kullanıcı onayı olmadan Faz 4 (User Accounts) başlatma.
```

---

## 4. Olası sonuçlar

**🅐 Kullanıcı canlı LLM çıktısında album teması yorumunu görür →** Doğrulandı.
Validation Gate'e geçebilir.

**🅑 Kullanıcı hâlâ generic yorum görürse →** Ayrım yeterli değil demektir;
prompt'u daha güçlü yap (örn. TASK'e "name the specific theme you recall"
talimatı). Yine de kullanıcı biyografi yasağını koru.

**🅒 Kullanıcı LLM'in yanılgı yaptığını (yanlış album bilgisi) bildirirse →**
"gerçek bilgi" izninin riski budur; prompt'a "if unsure, don't fabricate
song lore" nötr kalkanı ekle.

**🅓 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden
yaz, `checkpoint: [özet] — HANDOFF.md güncellendi` formatıyla push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**Grounding kuralları aşırı geniş yazılırsa gerçek derinliği boğar.** Eski
kural "song titles as labels, not evidence" kişisel-hayat uydurma yasağını
korurken, meşru "şarkının gerçek anlamı" bilgisini de yasaklıyordu — bu
LLM'i köreltiyordu. Ders: **yasak kapsamını net sınırla — yasak olan
"uydurulan kullanıcı biyografisi", izin verilen "mevcut eserin bilinen
anlamı".** Aynı kural içinde ikisini birden söyle: "X'i kullan AMA Y'yi
uydurma". Ayrıca: anahtarsız ortamda canlı LLM doğrulaması yapılamaz;
uydurma çıktı göstermek grounding ilkesini ihlal eder — kullanıcı makinesine
devret ve şeffaf bildir.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨 yasak).
- `vite.config.ts`'i commit etme — DEV-ONLY `allowedHosts` bulut preview içindir.
- MusicBrainz backend dosyalarını SİLME / UI'a geri getirme (kullanıcı kararı).
- Kullanıcının gerçek hayatına dair uydurma bilgi üretme — yeni kural şarkı/albüm
  bilgisine izin verir AMA kullanıcı biyografisine değil.

---

## 7. Devir kaydı (son 5 satır)

| Tarih | Kim | Ne | Commit |
|---|---|---|---|
| 2026-08-19 | Claude+OpenHands | QuestionCard manuel giriş (provider:"manual", buton) | 053bd4a |
| 2026-08-20 | OpenHands | metaLine + isValidSong artist restore fix | 482a292 |
| 2026-08-20 | OpenHands | Journey Step 4 UI tersine çevirme (text birincil, MB opsiyonel) | 7a8a56a |
| 2026-08-20 | OpenHands | MusicBrainz arama UI'dan tamamen kaldırıldı | 7b27cd3 |
| 2026-08-20 | OpenHands | Life Story prompt grounding ayrımı (şarkı bilgisi izin, biyografi yasak) | (bu checkpoint — `git log -1 --oneline` ile doğrula) |

---
_2026-08-20 OpenHands tarafından tamamen yeniden yazıldı. Life Story
prompt'unda şarkı/albüm gerçek bilgisi kullanımına izin verildi, kullanıcı
biyografisi uydurma yasağı korundu. Canlı LLM doğrulaması anahtar eksikliği
nedeniyle kullanıcı makinesine devredildi. Tek kaynak `docs/HANDOFF.md`._
