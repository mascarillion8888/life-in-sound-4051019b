# 🧭 LIFE IN A SOUND — ANA YOL HARİTASI & ORTAK AI PROTOKOLÜ

> Anlık durum için: `docs/HANDOFF.md`'ye bak. Bu dosya sadece kalıcı
> kuralları içerir. Claude, Gemini, ChatGPT, OpenHands — kim olursan ol,
> çalışmaya başlamadan önce TAMAMEN oku. Sohbet geçmişi ölür; git
> commit'leri, `docs/HANDOFF.md` ve bu dosya yaşar.

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

## 🗺️ YOL HARİTASI (tüm fazlar)

### ✅ Tamamlanan Fazlar
- **Faz 1:** Landing Page, Journey Wizard, Results Page, Responsive Design
- **Faz 2:** Journey Persistence, Results Polish, Timeline Improvements
- **Faz 3:** AI Story Engine, Companion Experience v1 (ardından düzeltme ile
  kaldırıldı — `legacy/companion-v1-2026-08-15`'de arşivlendi), Cloudflare→Docker
- **Faz 3.5:** Gerçek şarkı arama (MusicBrainz), F5 kalıcılığı, stability fix

### ⏳ Sıradaki Fazlar
- **Faz 4:** Music Memory veri modeli (tasarım onayı gerekli — `docs/TECH/DATABASE_PLAN.md` DRAFT, henüz implement edilmedi)
- **Faz 5:** User Accounts (anonim → email migration)
- **Faz 6:** Public Beta → Product Hunt → Mobile

---

## 🚨 DAL TOPOLOJİSİ KURALI (ihlal edilemez)

1. **Rutin çakışmasız git senkronizasyonu** (merge/rebase/ff) — otonom, onay
   gerekmez.
2. **Her zaman dur + kullanıcıya sor:** bir merge/rebase sonucunda
   `companion`/`memory`/`pattern`/`event`/`chapter` dosyaları ortaya çıkarsa,
   VEYA hangi dalın "asıl" olduğu değişiyorsa — "divergence var mı" sorusundan
   bağımsız olarak. Kaldırılmış sistemi otonom olarak geri getirme = yasak.
3. **Force-push / history yeniden yazma** — her zaman açık tek satırlık onay.
4. **Testler geçti = doğru dal** hatalı eşlemesidir. Test sonucu dal seçimini
   meşrulaştırmaz; doğru dalı kullanıcı belirler.

---

## ⏰ KREDİ BİTİŞ PROTOKOLÜ

### Kural: Her AI, her koşulda, kredi bitmeden önce şunu yapar:

**ADIM 1 — Uyarıyı fark et:** Claude "usage limit", Gemini kota/yavaşlama,
ChatGPT "reached your limit", veya cevap gecikmesi/belirsizlik.

**ADIM 2 — `docs/HANDOFF.md`'yi TAMAMEN yeniden yaz (ekleme değil, üzerine yaz):**
- §1 doğrulanabilir gerçek (dal, HEAD, test, worktree)
- §2 son biten iş (NEDEN + NASIL)
- §3 açık/bekleyen tek şey + sıradaki çalıştırılabilir adım
- §4 olası sonuçlar (ABC şıkları)
- §5 bu oturumda öğrenilen kritik bilgi
- §6 yapılmaması gerekenler
- §7 devir kaydının son 5 satırı

**ADIM 3 — Commit + push (checkpoint formatı):**
```
git add docs/HANDOFF.md
git commit -m "checkpoint: [özet] — HANDOFF.md güncellendi"
git push origin main
```

**ADIM 4 — Kullanıcıya bildir:** Tek cümle özet + kaldığı yer + sıradaki adım.
"docs/HANDOFF.md güncellendi mi? Commit hash'ini göster." sorusuna hazır ol.

---

## 🏁 CHECKPOINT PROTOKOLÜ

**Ne zaman checkpoint:** Test suite geçti + build temiz + worktree temiz.

**Checkpoint = HANDOFF.md güncellemesini içerir (ayrı/opsiyonel değil):**
```
git add -A
git commit -m "checkpoint: [özet] — HANDOFF.md güncellendi"
git push origin [branch]
```
Checkpoint sonrası `docs/HANDOFF.md` zaten yeniden yazılmış olmalı.

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

## 🔧 ÇALIŞMA KURALLARI (ihlal edilemez)

1. **Git'e güven, dosyaya değil:** `git log` + `git status` her zaman önce.
2. **Onay olmadan büyük karar yok:** Deterministik katman, migration, yeni faz başlangıcı.
3. **Sprint icat etme:** Kullanıcı onayı olmadan Faz 4'e geçme.
4. **Her bırakışta `docs/HANDOFF.md`'yi TAMAMEN yeniden yaz + commit + push** — koşulsuz.
5. **API key sızdırma:** Sadece server-only modüller.
6. **OpenHands'e güven:** Hedef + sınır ver, yöntemi ona bırak. Aşırı kısıtlama yapma.
7. **Neden + nasıl yaz:** Sadece "şunu yaptım" değil — neden o kararı aldın, neyi reddettin.
8. **Checkpoint oluştur:** Her temiz test+build sonrasında — HANDOFF.md güncellemesi dahil.
9. **Her checkpoint (temiz test+build sonrası) otomatik olarak şunu içerir: docs/HANDOFF.md'yi tamamen yeniden yaz, commit+push et, güncel içeriğini kullanıcıya göster. Bu, checkpoint'in ayrılmaz parçasıdır, opsiyonel bir ek adım değildir.
---
_Son güncelleme: OpenHands — 2026-08-19 (STATE.md bölündü: anlık durum → docs/HANDOFF.md)_
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log + docs/HANDOFF.md gerçektir._
