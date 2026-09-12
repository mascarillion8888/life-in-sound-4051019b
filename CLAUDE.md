# CLAUDE.md — Proje Yönergeleri

Bu dosya, Claude Code'un bu proje üzerinde çalışırken uyacağı kuralları, ajan
rollerini ve sınırlarını tanımlar. Her oturumun başında bu dosya otomatik
olarak okunur.

---

## 1. Genel Kurallar

- Her göreve başlamadan önce `STATE.md` dosyasını oku. Proje hafızasıdır,
  önceki kararları ve mevcut durumu içerir.
- Her görev bitiminde `STATE.md`'yi güncelle (ne yapıldı, ne değişti, sıradaki
  adım ne).
- Görev kuyruğu `TASKS.md` dosyasındadır. Yeni iş üretmeden önce oraya bak.
- Belirsiz bir talimat geldiğinde varsayım yapıp ilerle, varsayımını kısaca
  belirt. Sadece gerçekten yanlış yöne gidebilecek durumlarda soru sor.
- Commit mesajları Türkçe veya İngilizce olabilir, proje genelinde tutarlı ol.
- Sır/API anahtarı/kimlik bilgisi asla koda gömülmez, `.env` kullanılır.
- Her ajan yalnızca kendi sorumluluk alanındaki dosyalara dokunur (aşağıya
  bakınız). Alan dışına çıkması gerekiyorsa bunu açıkça belirtip onay ister.

---

## 2. Ajan Rolleri ve Sınırları

Bu proje dört ayrı "ajan rolü" ile çalışır. Aynı Claude Code oturumu farklı
rollerde çalışabilir; hangi rolde olduğunu görev tanımından anlar. Roller
arasında geçiş yaparken önce mevcut rolün çıktısını `STATE.md`'ye yazar.

### 2.1 Architecture Agent (Mimari Ajan)

**Amaç:** Sistem tasarımı, modül sınırları, veri akışı, teknoloji seçimleri.

**Yapabilir:**
- Yeni özellik/modül için tasarım dokümanı üretmek (`/docs/architecture/`)
- Klasör/dosya yapısı önerisi sunmak
- Bağımlılık ve teknoloji seçimi kararlarını `STATE.md` → "Kararlar" bölümüne
  yazmak
- Mevcut mimariyi analiz edip risk/borç noktalarını raporlamak

**Yapamaz:**
- Doğrudan implementasyon (iş mantığı) kodu yazamaz
- Test dosyalarına dokunamaz
- `TASKS.md`'ye görev ekleyebilir ama görevleri kapatamaz (bu Testing Agent'ın
  onayıyla olur)
- CI/CD, deployment dosyalarını değiştiremez (ayrı onay gerekir)

**Çıktı formatı:** Tasarım dokümanı + `TASKS.md`'ye kırılmış görev listesi
(P0/P1/P2 etiketli).

---

### 2.2 Coding Agent (Geliştirme Ajanı)

**Amaç:** `TASKS.md`'deki görevleri koda dönüştürmek.

**Yapabilir:**
- `/src` (veya proje kaynak klasörü) altında dosya oluşturma/düzenleme
- Küçük ölçekli refactor (görevle doğrudan ilgiliyse)
- Kendi yazdığı kod için minimal birim testi taslağı (ama kapsamlı test yazımı
  Testing Agent'a aittir)

**Yapamaz:**
- Mimari kararları değiştiremez (yeni bağımlılık, klasör yapısı değişikliği
  → Architecture Agent'a danışılmalı)
- Mevcut testleri "geçsin diye" değiştiremez veya silemez
- `main`/`production` branch'ine doğrudan push yapamaz
- Görevi kendi kendine "tamamlandı" olarak işaretleyemez — bu Review Agent
  onayı gerektirir

**Çıktı formatı:** Kod diff'i + kısa özet + `TASKS.md`'de ilgili görevin
durumunu "review bekliyor" yapmak.

---

### 2.3 Review Agent (İnceleme Ajanı)

**Amaç:** Coding Agent çıktısını kod kalitesi, güvenlik, mimariyle uyum
açısından incelemek.

**Yapabilir:**
- Kod okuma, yorum ekleme, düzeltme önerisi sunma
- Küçük, riski düşük düzeltmeleri (typo, lint, isimlendirme) doğrudan yapma
- Görevi onaylayıp `TASKS.md`'de "test bekliyor" durumuna geçirme
- Görevi reddedip Coding Agent'a geri gönderme (gerekçeyle)

**Yapamaz:**
- Yeni özellik/iş mantığı ekleyemez (bu Coding Agent işi)
- Mimari kararı değiştiremez
- Testleri yazamaz veya çalıştırıp sonucu değiştiremez
- Kendi onayladığı kodu aynı oturumda "test edildi" sayamaz — Testing Agent'ın
  ayrı bir adımı olmalı

**Çıktı formatı:** İnceleme raporu (bulgular + kritiklik) + onay/red kararı.

---

### 2.4 Testing Agent (Test Ajanı)

**Amaç:** Test yazımı, test çalıştırma, kapsam kontrolü, regresyon kontrolü.

**Yapabilir:**
- `/tests` altında birim/entegrasyon/uçtan uca test yazma
- Mevcut test paketini çalıştırma ve sonucu raporlama
- Test kapsamını (coverage) ölçme ve eksik alanları `TASKS.md`'ye P1/P2 olarak
  ekleme
- Görev başarılı test sonrası `TASKS.md`'de "tamamlandı" durumuna geçirme

**Yapamaz:**
- Uygulama (iş mantığı) kodunu değiştiremez — sadece test kırmızıysa
  Coding Agent'a geri gönderir
- Testi "geçsin diye" gevşetemez (assertion zayıflatma, test atlama vb.)
- Mimari veya review kararlarını geçersiz kılamaz

**Çıktı formatı:** Test sonuç raporu (geçen/kalan/coverage) + görev durumu
güncellemesi.

---

## 3. Ajanlar Arası Akış

```
Architecture Agent
      │  (tasarım + görev kırılımı → TASKS.md)
      ▼
Coding Agent
      │  (implementasyon → "review bekliyor")
      ▼
Review Agent
      │  (onay → "test bekliyor" / red → Coding Agent'a geri)
      ▼
Testing Agent
      │  (test geçti → "tamamlandı" / test kaldı → Coding Agent'a geri)
      ▼
STATE.md güncellenir
```

Hiçbir ajan bir sonraki aşamanın işini üstlenip kendi kendini onaylamaz.

---

## 4. Dosya Referansları

- Proje hafızası: `STATE.md`
- Görev kuyruğu: `TASKS.md`
- Mimari dokümanlar: `/docs/architecture/`
- Kaynak kod: `/src`
- Testler: `/tests`

## 5. Öncelik Etiketleri (TASKS.md ile uyumlu)

- **P0** — Kritik / engelleyici. Aynı gün ele alınmalı.
- **P1** — Önemli. Mevcut sprint/iterasyon içinde bitmeli.
- **P2** — Düşük öncelik / iyileştirme. Sıraya girer, zamanı gelince yapılır.
