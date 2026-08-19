# 🧭 LIFE IN A SOUND — ANA YOL HARİTASI & ORTAK AI PROTOKOLÜ
> **Bu dosya kutsal.** Claude, Gemini, ChatGPT, OpenHands — kim olursan ol,
> çalışmaya başlamadan önce TAMAMEN oku. Bırakmadan önce GÜNCELLE ve COMMIT'LE.
> Sohbet geçmişi ölür. Git commit'leri ve bu dosya yaşar.

---

## 🎯 ANA FİKİR VE VİZYON (değişmez, her AI ezberler)

**SoundMap / Life in a Sound** — Kişinin hayatını müzikle anlatan, AI destekli
kişisel bir deneyim platformu.

Kullanıcı 8 soruyu cevaplar, her soruya bir şarkı seçer.
Sistem bu seçimlerden şunları üretir:
- **Life Story** — AI'ın yazdığı kişisel anlatı
- **Music DNA** — müzikal kimlik analizi
- **Emotional Timeline** — duygusal yolculuk haritası
- **Cinematic Poster** — kişisel afiş

**Temel ilke:** Companion (AI sesi) asla gerçek uydurmaz. Deterministik
katman (`src/lib/ai/`) hesaplar, LLM sadece anlatır.

**Deployment hedefi:** Cloudflare değil — Node + Nitro + Docker (open-source,
kendi sunucunda barındırılabilir). Wrangler/Cloudflare tamamen dışarıda.

**Kullanıcı:** Tek geliştirici, üç AI (Claude/Gemini/ChatGPT) + OpenHands
ile çalışıyor. Ücretsiz kredi limitleri nedeniyle sık AI değişimi oluyor.
Bu protokol tam da bunun için tasarlandı.

---

## 🗺️ YOL HARİTASI (tüm fazlar — neredeyiz, nereye gidiyoruz)

### ✅ Tamamlanan Fazlar
- **Faz 1:** Landing Page, Journey Wizard, Results Page, Responsive Design
- **Faz 2:** Journey Persistence, Results Polish, Timeline Improvements
- **Faz 3:** AI Story Engine (Sprint 014), Companion Experience v1,
  Golden Test Suite (39 senaryo), Closed Beta Readiness,
  Cloudflare→Docker migrasyonu, Legal/IP hazırlığı
- **Faz 3.5:** Gerçek şarkı arama (MusicBrainz), F5 kalıcılığı,
  stability fix — restore dalında (c702e28) mevcut; companion içeren eski main
  düzeltme ile geri alındı (force-push), main restore'un devamı (bkz. Düzeltme 2026-08-19)

### ⏳ Sıradaki Fazlar
- **Faz 4:** Music Memory veri modeli (tasarım onayı gerekli, henüz implement edilmedi)
- **Faz 5:** User Accounts (anonim → email migration)
- **Faz 6:** Public Beta → Product Hunt → Mobile

---

## 📊 GÜNCEL GIT DURUMU
```
Ana dal (main):    c702e28  refactor(orchestra): reduce product runtime to summarizer only
Aktif dal:         main (= restore/pre-cloudflare-2501bd2, companionsız)
Remote main:       c702e28 (force-push edildi, senkron) [Düzeltme 2026-08-19]
Legacy:            legacy/companion-v1-2026-08-15 @ 7070c45 (arşivlendi, silinmedi)
Worktree:          TEMİZ
Test durumu:       57/57 ✅ (restore'un temiz seti; şarkı arama + F5 dahil)
Build:             ✅ temiz (tsc 0, vite build 0)
```

**Not:** Önceki 4 song-search commiti (8f0f4de/d9d9744/43f1dfe/f5487ca)
8949364 merge commit'indeydi; düzeltme ile force-push yapıldı, bu commitler
artık main'de DEĞİL. Şarkı arama + F5 kalıcılığı restore dalında (c702e28)
kendi orijinal commitleriyle mevcut — kod kaybı yok. Önceki içerik:
```
43f1dfe  fix(migrations): renumber journey_songs to 0010, avoid 0002 collision
d9d9744  feat(journey): persist structured song selections across refresh
8f0f4de  feat(journey): add real song search and selection
f5487ca  fix(stability): unhandled rejection + results data loss
```

---

## 🔴 AKTİF OPERASYON — KALDĞIMIZ YER

**Operasyon ID:** CORRECTION-RESTORE-MAIN-001
**Durum:** ✅ TAMAMLANDI (2026-08-19, kullanıcı açık onayı)
**Son güncelleyen:** OpenHands — 2026-08-19

### Ne yapıldı (neden ve nasıl) — DÜZELTME 2026-08-19:
**Arka plan:** Önceki SONG-SEARCH-MERGE-001, companion sistemini içeren
eski main'i "kurtarılmış" ilan edip otomatik push etmişti — kullanıcıdan
önceki oturumda verdiği "companion'ı geride bırak" kararını çiğneyerek.
Bu, "testler geçti = doğru dal" hatalı eşlemesinden kaynaklandı.
Yeni kural (§dal topolojisi): push/dal-seçimi/geri-getirme her zaman
açık onay ister; test sonucundan bağımsız.

1. `legacy/companion-v1-2026-08-15` @ `7070c45` arşiv branch'i oluşturuldu
   + push edildi. **Neden:** Companion-v1 kodu silinmedi, geri alınabilir
   tutuldu (history korundu).
2. `git reset --hard restore/pre-cloudflare-2501bd2` → main = `c702e28`
   (companionsız). **Neden:** main'i restore'un devamı haline getir.
3. `git push --force-with-lease origin main` → `f98fc08...c702e28`
   (forced update). **Neden:** Kullanıcı açık onayı ("Seçenek 1").

### Doğrulama (yeni temiz main, c702e28):
- ✅ Şarkı arama kodu mevcut: `src/lib/song/`, QuestionCard, journey-storage
- ✅ Companion dosyaları GONE: `src/lib/llm/companion*` yok; src/lib/llm =
  generateStory/orchestra/prompts sadece
- ✅ MusicBrainz referansları mevcut
- ✅ `npm test` → 57/57 (şarkı arama + F5 kalıcılık testleri dahil)
- ✅ `tsc --noEmit` 0, `npm run build` temiz
- ✅ E2e dev: MusicBrainz arama → Q1 "Bad (Michael Jackson's Vision) —
  Michael Jackson" seçildi, 12 gerçek sonuç
- ✅ F5 kalıcılık: sayfa yenilendi, Q1 seçimi korundu
- ✅ Geçici vite.config allowedHosts geri alındı (worktree TEMİZ)

### Şu an tam olarak nerede duruyoruz:
- ✅ main = origin/main = c702e28 (companionsız, restore'un devamı)
- ✅ legacy/companion-v1-2026-08-15 = 7070c45 (arşivlendi, silinmedi)
- ✅ feature/real-song-search artık main'de değil (force-push ile geçersiz;
  içerik restore'da mevcut, kod kaybı yok)
- ⏳ Sıradaki: Faz 4 Music Memory veri modeli hazırlığı (read-only keşif +
  tasarım önerisi — companion tablolarını geri getirmez, implementation değil)
- OTONOM kural aktif: çakışmasız clean-up/merge için onay bekleme;
  tıkanıklık → STATE.md + standby + yan göreve geç

---

## 📋 OPENHANDSDEN BEKLENEN SONUÇLARA GÖRE DEVAM PLANI

> Bir sonraki AI veya kullanıcı: OpenHands'in cevabını oku,
> ilgili şıkkı bul, talimatı aynen uygula.

### Aktif görev: SONG-SEARCH-MERGE-001

**OpenHands'e verilecek talimat:**
```
1. git checkout -- vite.config.ts
2. git status  (temiz olmalı)
3. git checkout main
4. git merge --ff-only feature/real-song-search
5. npm test
6. Eğer test geçerse: git push origin main
7. Sonucu raporla
```

---

**🅐 "Merge + push başarılı, X/675 test geçti" → DEVAM:**
```
- STATE.md güncelle:
  - main HEAD = yeni commit hash
  - feature/real-song-search branch sil:
    git push origin --delete feature/real-song-search
  - Operasyon SONG-SEARCH-MERGE-001 → TAMAMLANDI
  - Devir Notu'na ekle
- STATE.md commit + push
- Sonra: Faz 4 başlamadan önce Music Memory veri modeli tasarımını
  kullanıcıya sor, onay olmadan implement etme
```

**🅑 "Test başarısız: X/675, hata: [mesaj]" → DUR, ANALİZ ET:**
```
- Merge yapma, git merge --abort
- Hata mesajını tam olarak bana (Claude/Gemini/ChatGPT) yapıştır
- Olası nedenler:
  a) Migration scope-guard (companion-orchestrator.test.ts) — 0010 sayacı
  b) Cherry-pick çakışma kalıntısı — types.ts veya journey.tsx
  c) Orchestra timeout testi — ağ bağımlılığı
- Hatayı analiz ettikten sonra fix → test → tekrar dene
```

**🅒 "Merge çakışması var, dosya: X" → DUR, MANUEL ÇÖZÜM:**
```
- git merge --abort
- Çakışma bloklarını (<<<<<<< ======= >>>>>>>) tam olarak bana yapıştır
- Ben (Claude/Gemini/ChatGPT) çözümü belirleyeceğim
- Neden çıktı: main'e bu arada yeni commit gelmiş olabilir
- git log origin/main --oneline -5 çıktısını da gönder
```

**🅓 "Push reddedildi / authentication error" → TOKEN İLE TEKRAR:**
```
- Kod sorunu değil, erişim sorunu
- git remote set-url origin https://[GITHUB_TOKEN]@github.com/mascarillion8888/life-in-sound-4051019b.git
- git push origin main
- Token yoksa: GitHub → Settings → Developer Settings → Personal Access Token
```

**🅔 "OpenHands cevap vermedi / sandbox kapandı" → YENİ OTURUM:**
```
- Yeni OpenHands oturumu aç
- İlk iş (salt okunur doğrulama):
  git status && git branch --show-current && git log --oneline -5
- STATE.md §3 "Güncel Git Durumu" ile karşılaştır
- feature/real-song-search @ 43f1dfe ise: merge adımından devam et
- Farklı bir HEAD görüyorsan: bana (Claude/Gemini/ChatGPT) önce sor
```

---

## ⏰ KREDİ BİTİŞ PROTOKOLÜ

### Kural: Her AI, her koşulda, kredi bitmeden önce şunu yapar:

**ADIM 1 — Uyarıyı fark et:**
- Claude: "You're approaching your usage limit" mesajı
- Gemini: kota uyarısı / yavaşlama
- ChatGPT: "You've reached your limit" mesajı
- Herhangi bir model: cevap gecikmesi veya belirsizlik

**ADIM 2 — Devir raporu yaz (STATE.md §3'ü güncelle):**
```markdown
## AKTİF OPERASYON — ACİL DEVİR

Operasyon ID: [mevcut ID]
Durum: INTERRUPTED
Kesinti nedeni: [AI adı] kredisi bitti
Tarih/Saat: [şu an]
Tahmini geri dönüş: [biliniyorsa belirt, bilinmiyorsa "belirsiz"]

### Bu oturumda ne yapıldı (NEDEN + NASIL):
[Her adımı açıkla — sadece "şunu yaptım" değil, neden o kararı aldın,
hangi alternatifi neden reddettin, hangi riski gördün]

### Tam olarak nerede duruyoruz:
Dosya: [hangi dosya]
Satır/commit: [tam referans]
İşlem: [tam olarak ne yapılıyordu]

### Devir alan AI için sıradaki adım:
[Kelimesi kelimesine, hangi komutu çalıştıracak]

### OpenHands'teki süreç:
[Çalışıyor mu? Hangi komut çalışıyordu? Sonuç bekleniyor mu?]

### Dikkat edilmesi gerekenler:
[Bu oturumda öğrenilen kritik bilgi — bir sonraki AI bunu bilmezse hata yapabilir]
```

**ADIM 3 — Commit + push:**
```
git add STATE.md
git commit -m "chore: emergency handoff — [AI adı] credit limit [tarih]"
git push origin main  (veya aktif branch)
```

**ADIM 4 — Kullanıcıya bildir:**
```
⚠️ KREDİM BİTİYOR

Tahminen [X dakika/saat] içinde aktif olmayacağım.
STATE.md güncellendi ve commit edildi.

Şu an yapılmakta olan: [tek cümle özet]
Kaldığımız yer: [dosya/commit/adım]
Sıradaki adım: [ne yapılmalı]

Gemini veya ChatGPT'ye geçebilirsin.
STATE.md'yi okuyarak kaldığım yerden devam edebilirler.
```

---

## 🏁 CHECKPOINT OLUŞTURMA PROTOKOLÜ

Her AI, önemli bir iş tamamladığında checkpoint oluşturur.
**Ne zaman checkpoint:** Test suite geçti + build temiz + worktree temiz.

**Checkpoint formatı (STATE.md §6 Devir Notu'na eklenir):**
```
| [tarih] | [AI] | [ne yapıldı — NEDEN + NASIL özeti] | ✅ [commit hash] |
```

**OpenHands checkpoint:**
```
git add -A
git commit -m "checkpoint([sprint/operasyon]): [açıklama] — [test sayısı] passing"
git push origin [branch]
```

**Checkpoint sonrası STATE.md'ye ekle:**
```
### CHECKPOINT: [operasyon ID] — [tarih]
Commit: [hash]
Test: [X/X]
Build: ✅
Çalışan özellikler: [liste]
Devam edilebilir nokta: EVET
```

---

## 📜 DEVİR NOTU (Handover Log)
| Tarih | Kim | Ne yaptı — Neden | Durum |
|---|---|---|---|
| 2026-08-15 | OpenHands | Legal/IP hazırlık paketi — pre-beta IP koruma | ✅ 7070c45 |
| 2026-08-19 | Claude+OpenHands | migration/node-docker-v1→main — Cloudflare kaldırıldı, Docker eklendi | ✅ 6eccf89 |
| 2026-08-19 | Claude+OpenHands | feature/real-song-search — gerçek MusicBrainz arama + F5 kalıcılık | ⏳ 43f1dfe, merge bekliyor |
| 2026-08-19 | OpenHands | SONG-SEARCH-MERGE-001 → main merge + push (8949364) — ff merge + STATE.md web upload'ı (f66273b) ile çakışmasız birleştirme, 675/675 test geçti | ✅ 8949364 |
| 2026-08-19 | OpenHands | DÜZELTME: companion içeren main'i force-push ile geri aldı, main=restore (c702e28), legacy/companion-v1 arşivlendi (7070c45) — kullanıcı açık onayı, 57/57 test, e2e şarkı arama+F5 doğrulandı | ✅ c702e28 |

---

## ⚖️ 3'LÜ KONSENSÜS PROTOKOLÜ

Bir AI planın dışına çıkan veya geri dönüşü zor bir karar önerirse:
1. Bu bölüme yazar (uygulamaz)
2. Kullanıcı diğer iki AI'a kopyalar
3. Her AI görüşünü + gerekçesini yazar
4. 2/3 çoğunluk → karar uygulanır (kullanıcı onayıyla)
5. Azınlık görüşü de kayıt altında kalır (ileride referans)

**Şu an bekleyen karar:** YOK

```
### Karar: [başlık] — Öneren: [AI] — [tarih]
Ne öneriliyor: ...
Neden: ...
Alternatif ve riski: ...

Claude:  ☐ ONAY / ☐ İTİRAZ — gerekçe:
Gemini:  ☐ ONAY / ☐ İTİRAZ — gerekçe:
ChatGPT: ☐ ONAY / ☐ İTİRAZ — gerekçe:

Sonuç: [2/3 ile karar] — Kullanıcı onayı: [tarih]
Uygulayan: [AI]
```

---

## 📌 YENİ AI OTURUMU BAŞLANGIÇ — 60 SANİYE KONTROL

```
1. Bu dosyayı BAŞ'TAN SONA oku
2. AGENTS.md oku
3. git log --oneline -5  →  STATE.md §3 "Güncel Git Durumu" ile karşılaştır
4. git status            →  Worktree temiz mi?
5. §3 "Aktif Operasyon"  →  Yarım iş var mı? Durum ne?
6. §4 "Sonuç Şıkları"   →  OpenHands'ten beklenen sonuç var mı?
7. Varsa devam et. Yoksa kullanıcıya sor.
```

---

## 🔧 ÇALIŞMA KURALLARI (ihlal edilemez)

1. **Git'e güven, bu dosyaya değil:** `git log` + `git status` her zaman önce.
2. **Onay olmadan büyük karar yok:** Deterministik katman, migration, yeni faz başlangıcı.
3. **Sprint icat etme:** Kullanıcı onayı olmadan Faz 4'e geçme.
4. **Her bırakışta güncelle:** STATE.md + commit + push — koşulsuz.
5. **API key sızdırma:** Sadece server-only modüller.
6. **OpenHands'e güven:** Hedef + sınır ver, yöntemi ona bırak. Aşırı kısıtlama yapma.
7. **Neden + nasıl yaz:** Sadece "şunu yaptım" değil — neden o kararı aldın, neyi reddetttin.
8. **Checkpoint oluştur:** Her temiz test+build sonrasında — geri dönüş noktası.

---
_Son güncelleme: Claude — 2026-08-19_
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log gerçektir._
