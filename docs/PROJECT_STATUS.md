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

### 2026-09-25 — Kod tabanı hijyeni: lint/format mimarisi sıfırlandı
- **Önceki oturumun sağlık raporu** üç dikkat noktası üretmişti: untracked `bun.lock`,
  Windows/Linux satır-sonu (CRLF) ayrışması ve "prettier'i kapatarak koş" kuralı,
  9 taşınan lint uyarısı. Kullanıcı "ana mimariye göre düzelt" dedi; ilke:
  **bastırmak değil, kök-nedeninden çözmek.**
- **CRLF ayrışması config'ten çözüldü:** Prettier artık `endOfLine: "auto"` ile
  hem Windows (CRLF) hem Linux (LF) checkout'ta aynı kararı veriyor. Böylece
  "lint'i prettier-off ile koş" geçici kuralı kaldırıldı — artık `npm run lint`
  tek başına kanonik ve **tamamen temiz (0 hata / 0 uyarı)**.
- **Birikmiş format sapması temizlendi:** Bu arada ortaya çıktı ki sahte 167 hata
  dediğimiz şeyin önemli kısmı son commit'lerde birikmiş **gerçek** format
  driftiydi; 48 dosya yalnızca check'in işaretlediği ölçüde formatlandı (geniş
  `prettier --write .` koşulmadı).
- **Uyarılar üç sınıfa ayrılıp kökünden çözüldü:** (1) shadcn `ui/` bileşenleri
  vendored olduğu için fast-refresh kuralı config'de o klasör için kapandı;
  (2) galeri hata dili (`gothicArt.tsx`) ve dil-context (`LanguageContext.tsx`)
  bilinçli ortak-modül dosyaları — gerekçeleri kod içinde dosya-başı notu olarak
  kaydedildi; (3) results ekranındaki şarkı listesi memo'sunun içerik-parmak-izi
  deseni, mood LLM çift-çağrısı regresyonunu (eski hata) koruyan bilinçli bir
  karardır — gerekçesi kodda, dep listesine `answers` eklemeyin.
- **Yabancı lockfile kapatıldı:** `bun.lock` artık `.gitignore`'da (proje npm
  kullanıyor; o dosya bu ortamda yanlışlıkla koşulan `bun install` artığıydı).
- **Doğrulama:** tip 0 hata, lint 0/0, prettier yeşil, testler 693/693 —
  formatlama hiçbir davranışı değiştirmedi. Görsel iş olmadığı için göz-onayı
  (kural-10) gerekmedi.

### 2026-09-24 — Durum katmanı kuruldu + hızlı kazanç turu (Option A)
- İlk kez bu **anlatısal durum dosyası** (`docs/PROJECT_STATUS.md`) oluşturuldu;
  HANDOFF'la aynı commit'te güncellenmesi kalıcı alışkanlık olarak kaydedildi.
- **Hızlı kazanç turu (Option A) — 4 küçük, kural-10-açmayan iş, tek tur:**
  - Age aralıkları çakışması düzeltildi: STEEL "18-28" hem "18-22" hem "23-30" ile örtüşüyordu.
    Kesintisiz, kesişmeyen bant getirildi ("23-29 / 30-39 / 40+"), kart (EN+TR) ve
    progress-bar (`data.ts`) birlikte — iki yüzey artık tutarlı.
  - `intensityLabel` ölü i18n alanı **zaten kaldırılmış** bulundu (eskiden "açık" sanılıyordu);
    yalnız kaydı kapatıldı.
  - Preview (`previewUrl`) veri sözleşmesi **zaten sağlam** doğrulandı: tek `SONG_FIELDS`
    whitelist'i hem local hem remote katmanda, round-trip testli. Kod yok, kapandı.
  - Görsel mimari dokümanlarında drift düzeltildi: "Visual Resolver / Asset Registry
    FUTURE – kodda yok" etiketleri CANLI gerçeğine, eski HF-zinciri referansları Imagen→Gemini'ye.

### 2026-09-24 — AI ton / tanı-yasağı kuralları gerçek promptlara (Option C #2)
- **4 prose prompt'a tanı-yasağı + anti-klişe kuralları eklendi:** life-story,
  poetic-analyzer, entry-insight ve card-lore artık "hiçbir zaman klinisyen/
  terapist değilsin, teşhis etme, etiketleme; duygu haritaları teşhis değil
  yansımadır" ve "spesifik ol, horoskop/fortune-cookie/jenerik iltifat yazma"
  kurallarını taşıyor. mood-inference'ın sistem satırı da "klinik değil, yalnız
  şarkının mood'unu etiketlersin"e çekildi.
- **Neden:** bu kurallar yalnız vizyon dokümanlarında duruyordu; gerçek çıktı
  tonuna etki etmiyordu. Artık modelin gördüğü prompt'ta var.
- **Davranış kanıtı:** aynı 8-şarkılık journey ile gerçek LLM çağrısıyla
  önce/sonra çıktısı karşılaştırıldı — yeni prompt'ta "testament to... define
  your spirit" türü jenerik/fortune-cookie satırları azaldı, anlatı şarkı
  gerçekliğine daha demirli. Kural-10 değil (propmt içeriği).

### 2026-09-24 — Kriz güvenliği (Option C)
- **Founding Principle eklendi** (`docs/ETHICAL_AI.md` §0): ürünün önceliği
  ticari değil; kriz/güvenlik anlarında kullanıcının gerçek iyiliği, uygulamada
  kalmasından veya herhangi bir metrikten hep önceliklidir. Kullanıcının gerçek
  yardıma ulaşıp uygulamayı terk etmesi başarıdır, başarısızlık değil.
- **CrisisGuard** (`src/lib/safety/crisisGuard.ts`): kullanıcının kendi yazdığı
  serbest metinde (Life Feed notu) açık intihar/kendine zarar niyetini 5 dilde
  (EN/TR/ES/DE/FR) deterministik tespit eder — LLM'e hiçbir şey gitmeden.
  Tespit olursa not ne LLM'e iletilir ne kalıcılaştırılır; yerine sakin, insani
  bir **CrisisSupportPanel** gösterilir (güvenilen kişi / yerel acil numara /
  findahelpline.com). Panel kullanıcıyı uygulamada tutmaya değil, gerçek
  insana/kaynağa yönlendirmeye çalışır. İlk açık görsel iş değil — ilk **kriz** işi.
- Kural-10 değil; yalnız kriz-durumuna özgü panel, normal akış değişmedi.

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
- **Kriz güvenliği:** CrisisGuard (5 dil deterministik triage) + CrisisSupportPanel +
  ETHICAL_AI.md (Founding Principle + bilinen-sınırlama). Kullanıcının kriz notu asla
  LLM'e gitmez / kalıcılaşmaz.
- **AI ton / tanı-yasağı kuralları:** 4 prose prompt (life-story, poetic-analyzer,
  entry-insight, card-lore) tanı-yasağı + anti-klişe kurallarını taşıyor; mood-inference
  sistem satırı "klinik değil"e çekildi. Çıktı tonu davranışsal olarak doğrulandı.

### Kısmen Tamamlanan / Devam Eden
- **FAZ 4c — renk/tema kaynağı kararı (açık):** sahne, kendi tema kaynağından renk
  alıyor; çözücünün renk/tema çıktısı henüz render'da kullanılmıyor. İki kaynak
  farklı türetiyor (2010-sonrası ayrışma riski) — karar verilmemiş.
- **Asset Registry genişlemesi:** yeni tür/dönem/duygu kombinasyonları manuel
  eklenmeyi bekliyor (onayla).
- **Kart çerçevesi overlay (v1):** altyapı kuruldu, varsayılan kapalı; gerçek
  çerçeve görselleri + eşleme hâlâ bekliyor.
- **Soul görsellerinin oran tutarsızlığı** (energetic/euphoric/playful 2:3 vs 3:4) — asset üretiminde düzeltilecek.

### Hiç Başlanmamış
- FAZ 4 Music Memory veri modeli (tasarım taslağı var, kod yok), FAZ 5 User
  Accounts, FAZ 6 Public Beta / Product Hunt / Mobile.

## 5. Sıradaki Adımlar

### Kısa Vade (bu hafta/gün)
- FAZ 4c renk/tema kaynağı kararı (görsel değişiklik → göz onayı gerekir).
- **Music DNA P0 (büyük mimari iş, ayrı oturum):** gerçek şarkı verisi üzerinden
  analitik çekirdek — şu an ürün büyük ölçüde soru-tabanlı; şarkı gerçekliği henüz
  tam bağlı değil. (Kapatılan Music Map poster bulgusu — aşağı.)
- ~~Music Map poster bulgusu — DOĞRULANMADI~~ **ÇÖZÜLDÜ (Bulgu 1, kapalı):** canvas hem local hem production'da dolu ölçüldü (nonZero=1.0); "boş kahverengi çerçeve" repro edilemedi, hydration-timing anıydı. Açık iş değil; posterAlt "Placeholder" metni ayrı temizlik notu.
- Eski genel `mood-backdrop` setini metinsiz yeniden üret (açık görsel iş).
- Kart çerçevesi overlay v2: gerçek çerçeve görselleri + eşleme (aktifleşince göz
  doğrulaması gerekir).

### Orta Vade (bu ay)
- Asset Registry genişletmesi; çoklu tür kaynağı (iTunes/MusicBrainz tekeli kırma),
  sanatçı metadata, müzikal karakteristikler.

### Uzun Vade (vizyon, aylar)
- Node + Nitro + Docker ile kendi sunucusunda barındırma (şu an Vercel'de), müzik
  hafızası veri modeli, kullanıcı hesapları, beta + Product Hunt, mobil.

## 6. Bilinen Riskler / Açık Kararlar

- **FAZ 4c renk/tema kaynağı** için kanonik kaynak seçilmedi (çözücü vs sahne;
  post-2010 ayrışması bilinen risk). **Karar henüz verilmedi.**
- **CrisisGuard TR pattern sınırlaması:** `canımı\s+(yak|almak)` olumsuz kullanımda
  ("canımı yakma") yanlış-pozitif tetikleyebilir — bilinçli recall lehine bırakıldı
  (kriz güvenliği önceliği). Gelecekte negation-aware pattern ile iyileştirilebilir.
- Eski genel görsellerin içinde metin var (metinsiz yeniden üretim gerekiyor).
- **STEEL age-range sınırı (lifeCards):** "23-29" artık komşularla çakışmıyor ama
  "Güç" çağının alt/üst sınırı tasarım kararı olarak netleşmedi — kabul edildi.
- **Soul görsellerinin oran tutarsızlığı (energetic/euphoric/playful 2:3 vs 3:4):**
  contain'da ince boşluk; asset üretiminde (kullanıcı) düzeltilecek.
- Üç ayrı "yaş dönemi" sistemi hâlâ birleşmedi (ayrı karar, bilinçli dokunulmadı).
- Kalıcı kurallar: repo-lokal git kimliği doğru olmalı (Vercel engeli); `git add -A`
  yasak (anahtar/debri süpürür).

## 7. Yeni Bir AI Oturumuna Hızlı Bağlam

Bu, 8 şarkı→görsel-poster üreten React (TanStack Start, Node+Nitro, Vercel'de)
uygulaması. Çalışmaya başlamadan önce **zorunlu sırayla oku**: `AGENTS.md` →
`STATE.md` → `docs/HANDOFF.md` (tek otorite kaynak; bu dosya DEĞİL) → canlı repo
durumunu `git pull` + `git log` ile doğrula (doküman değil git'e güven). Proje artık
**kriz-güvenli** (CrisisGuard, 5 dil serbest-metin triage) ve **tanı-yasaklı** AI
kurallarına sahip (4 prose prompt'ta "klinisyen değilsin" + anti-klişe; `ETHICAL_AI.md`
Founding Principle). Music DNA hâlâ büyük ölçüde soru-tabanlı — gerçek şarkı verisine
henüz tam bağlı değil; **sıradaki büyük hedef Music DNA P0** (ayrı, mimari oturum).
Testler geçiyor, worktree temiz, kural-10 göz onayları kapalı. Her önemli push'ta bu
dosyayı HANDOFF'la birlikte güncel tutmayı unutma.
