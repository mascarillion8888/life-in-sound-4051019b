# SoundMap / Life in a Sound — Proje Durumu

Son güncelleme: 2026-09-24

> **Bu dosya ne:** Her önemli push'ta (kod değişikliği içerenler; yalnızca
> docs-only checkpoint'lerde şart değil) güncellenen, insan dilinde yazılmış
> **anlatısal durum katmanı**. Commit hash'leri ve dosya satır numaraları
> burada YOKTUR (onlar `docs/HANDOFF.md` ve skill'de tutulur; o dosya kanonik,
> tek otorite kaynaktır). Bu dosya onu tamamlar: "ne, neden, ne durumda" anlatısı.
>
> Kurallar: (1) her önemli push'ta §3'e o günün özeti eklenir, §4/§5 güncel
> duruma göre revize edilir; (2) insan dili — commit hash / satır numarası yok;
> (3) uydurma yasak — yalnız gerçekten yapılmış/yapılmamış şeyler; (4) bu dosya,
> HANDOFF.md ile AYNI commit'te güncellenir (ayrılma yok).

---

## 1. Proje Ne Yapıyor (30 saniyede özet)

Kullanıcı 8 soruya 8 şarkı seçiyor; sistem her şarkının müzikal kimliğini ve
duygu durumunu (mood) çıkarıyor, kişiselleştirilmiş bir hayat hikâyesi, duygusal
zaman çizelgesi ve görsel poster üretiyor. Görsel taraf deterministik çalışır:
şarkının `mood + genre + decade` bileşimi, kullanıcının **manuel ürettiği**
onaylı görsellerden oluşan kayıt defterinden (Asset Registry) eşleşir — runtime'da
yeni AI görseli üretilmez (yalnız kart artwork'ü için geçici istisna var). Vizyon:
"müziğin görsel tarihi" — her tür+dönem+duygu kombinasyonu kendi atmosferini yaşar.

## 2. Mimari Ana Hatları

- **Müzik Sistemi (CANLI):** şarkı arama (iTunes/MusicBrainz) → Music DNA + mood
  çıkarımı → hayat/duygu motorları. Mood bir kez hesaplanıp kalıcılaştırılır.
- **Görsel Sistem (kısmen CANLI):** deterministik çözücü (resolver) + Asset
  Registry (pilot: 1980'ler × Pop, tamamı; Soul 9/9 mood) → sahne duvar kağıdı
  (çok eksenli geri dönüş zinciri). Resolver'in renk/tema çıktısı sahne render'ında
  henüz tüketilmiyor (açık karar, §6).
- **Kart/Poster Sistemi (kısmen):** quiz kartı (yolculuk adımı; metinler HTML/CSS
  tipografiyle, görselin içine gömülü değil), kartı ortaya çıkarma ekranı (3:4 sabit
  oran), poster/hero/grid bileşenleri.
- **Kilitli kararlar:** görseller yazısız üretilir, gerçek metin CSS'ten gelir;
  runtime'da AI görsel üretimi yok (§9, kart artwork'ü hariç); kartezyen kombinasyon
  matrisi yok (§10).

## 3. Bugün ve Bu Hafta Ne Yapıldı

### 2026-09-24 — Durum katmanı kuruldu + ageRanges bug'ı belgelendi
- İlk kez bu **anlatısal durum dosyası** (`docs/PROJECT_STATUS.md`) oluşturuldu;
  HANDOFF'la aynı commit'te güncellenmesi kalıcı alışkanlık olarak kaydedildi.
- **Yeni bulunan, ayrı küçük iş:** kartların yaş aralığı dizisinde bir çakışma —
  STEEL dönemi "Ages 18-28" etiketi hem bir önceki ("18-22") hem bir sonraki
  ("23-30") dönemle çakışıyor. Henüz düzeltilmedi; gözle görünür bir arıza yaratmıyor,
  yalnız içerik tutarlılığı. HANDOFF'a açık iş olarak eklendi.

### 2026-09-23 — Kural-10 kapanışı + başlık metni + oran doğrulaması
- Soul görselleri için **gözle onay turu kapandı**: bir soul efsanesi (Stevie Wonder
  "Superstition") gerçek bir seçimle doğrulandı; sistemin kayıtlı Soul görselini
  gösterdiği (normalize + exact-match yolu canlı) teyit edildi. Aynı turda kart
  başlık metin değişikliği de kapandı.
- Kartı ortaya çıkarma ekranı başlığına küçük "Life Chapter" üst satırı eklendi ve
  soğuk yaş-aralığı alt başlığı, şiirsel dönem satırlarıyla değiştirildi (demodek
  alan silinmedi — başka ekranlar hâlâ kullanıyor).
- 3:4 sabit-oran kilidinin zaten uygulanmış olduğu, gerçek tarayıcı ölçümüyle
  doğrulandı (hangi ekran genişliği olursa olsun tam 3:4). Ayrıca 3 Soul görselinin
  (energetic/euphoric/playful) geri kalanlardan farklı oranda (2:3) üretildiği
  kaydedildi — kırpma değil ama ince boşluk, asset üretiminde düzeltilecek.

### 2026-09-20 → 22 — Soul görselleri + tür eşleme düzeltmesi + kart iyileştirmeleri
- **Soul asset seti tamamlandı:** 9/9 duygu durumunun tamamı için özel Soul
  duvar kağıdı kayıt defterine eklendi.
- **Kök neden bulundu ve düzeltildi:** soul efsanelerinin hep aynı eski (ve içinde
  metin olan) genel görsele düşme nedeni, iTunes'un tür etiketini ("R&B/Soul")
  kayıt defterindeki anahtarla ("soul") birebir eşleyememesiydi. Tür etiketleri bir
  normalizasyon katmanından geçirilerek çözüldü; artık Soul seçildiğinde gerçek Soul
  görseli geliyor.
- **Kart yeniden tasarımı (Adım 1-4) tamamlandı ve onaylandı:** puan rozeti
  kaldırıldı, önizleme görünür bir "Play/Mute" butonuna dönüştü, yolculuktan bağımsız
  bir "Add to Collection" ekledi, metinlerin okunurluğu için bir katman eklendi.
  Kural-10 (gözle onay) alındı.
- Bilinen açık görsel iş: eski genel `mood-backdrop` setinin içinde metin var
  ("1980s • POP", sanatçı adları vb.). Bunlar metinsiz yeniden üretilmeli (kullanıcı
  asset işi). Soul'da artık görünmüyor çünkü orada yeni set geçerli.

### 2026-09-18 → 19 — Görsel sözleşme + kayıt defteri
- Görsel kararın tek eksenden üçlü bileşime (mood+genre+decade) taşınan kanonik
  girdisi kuruldu ve deterministik görsel sözleşmesi inşa edildi.
- Manuel üretilen kombinasyonları tam-eşleşmeyle tanıyan Asset Registry eklendi
  (öncü bir kombinasyonla başladı ve davranış kademeli olarak canlı akışa bağlandı).

### Daha önce (iz bırakan dönemler)
- Müzik/hayat/duygu motorları ve pipeline; tür+duygu çıkarımını OpenRouter'a
  taşıyan köprü; şarkı arama ve kalıcılık; Hugging Face'in tüm katmanları
  (sunucu + istemci ölü kod) tamamen kaldırıldı; taksonomi düzeltildi (gothic
  ailesi daraltıldı, "acoustic" ailesi ayrıştırıldı).

## 4. Genel İlerleme Durumu (kümülatif)

### Tamamlanan
- Tam yolculuk akışı: 8 soru / 8 şarkı → Life Story + Music DNA + Emotional
  Timeline + görsel poster; kalıcılık (kayıt yüklendi/yerel) ve F5 direnci.
- Görsel sözleşme + deterministik çözücü + Asset Registry (1980'ler×Pop tam,
  Soul 9/9) + tür normalizasyonu; kural-10 gözle onayı kapandı.
- Hugging Face tamamen kaldırıldı (sunucu kademesi + istemci ölü kod / zombi
  hata dalları); taksonomi düzeltildi.
- Kart yeniden tasarımı (Adım 1-4) + "Add to Collection" + okunurluk katmanı.

### Kısmen Tamamlanan / Devam Eden
- **FAZ 4c — renk/tema kaynağı kararı (açık):** sahne, kendi tema kaynağından renk
  alıyor; çözücünün renk/tema çıktısı henüz render'da kullanılmıyor. İki kaynak
  farklı türetiyor (2010-sonrası ayrışma riski) — karar verilmemiş.
- **Asset Registry genişlemesi:** yeni tür/dönem/duygu kombinasyonları manuel
  eklenmeyi bekliyor (onayla).
- **Kart çerçevesi overlay (v1):** altyapı kuruldu, varsayılan kapalı; gerçek
  çerçeve görselleri + eşleme hâlâ bekliyor.
- **Soul görsellerinin oran tutarsızlığı** + **ageRanges çakışması** (§3).

### Hiç Başlanmamış
- FAZ 4 Music Memory veri modeli (tasarım taslağı var, kod yok), FAZ 5 User
  Accounts, FAZ 6 Public Beta / Product Hunt / Mobile.

## 5. Sıradaki Adımlar

### Kısa Vade (bu hafta/gün)
- Eski genel `mood-backdrop` setini metinsiz yeniden üret (açık görsel iş).
- ageRanges çakışmasını düzelt (küçük, ayrı içerik işi).
- Kart çerçevesi overlay v2: gerçek çerçeve görselleri + eşleme (aktifleşince göz
  doğrulaması gerekir).

### Orta Vade (bu ay)
- FAZ 4c renk/tema kaynağı kararı (görsel değişiklik → göz onayı gerekir).
- Asset Registry genişletmesi; çoklu tür kaynağı (iTunes/MusicBrainz tekeli kırma),
  sanatçı metadata, müzikal karakteristikler.

### Uzun Vade (vizyon, aylar)
- Node + Nitro + Docker ile kendi sunucusunda barındırma (şu an Vercel'de), müzik
  hafızası veri modeli, kullanıcı hesapları, beta + Product Hunt, mobil.

## 6. Bilinen Riskler / Açık Kararlar

- **FAZ 4c renk/tema kaynağı** için kanonik kaynak seçilmedi (çözücü vs sahne;
  post-2010 ayrışması bilinen risk).
- Eski genel görsellerin içinde metin var (metinsiz yeniden üretim gerekiyor).
- 3 Soul görseli farklı oranda (2:3); ageRanges küçük çakışma.
- Üç ayrı "yaş dönemi" sistemi hâlâ birleşmedi (ayrı karar, bilinçli dokunulmadı).
- Kalıcı kurallar: repo-lokal git kimliği doğru olmalı (Vercel engeli); `git add -A`
  yasak (anahtar/debri süpürür).

## 7. Yeni Bir AI Oturumuna Hızlı Bağlam

Bu, 8 şarkı→görsel-poster üreten React (TanStack Start, Node+Nitro, Vercel'de)
uygulaması. Çalışmaya başlamadan önce **zorunlu sırayla oku**: `AGENTS.md` →
`STATE.md` → `docs/HANDOFF.md` (tek otorite kaynak; bu dosya DEĞİL) → canlı repo
durumunu `git pull` + `git log` ile doğrula (doküman değil git'e güven). Şu an
kural-10 gözle onayları kapalı, worktree temiz, testler geçiyor. En kritik açık
noktalar: FAZ 4c renk/tema kaynağı kararı ve eski görsellerin metinsiz yeniden
üretimi. Her önemli push'ta bu dosyayı HANDOFF'la birlikte güncel tutmayı unutma.
