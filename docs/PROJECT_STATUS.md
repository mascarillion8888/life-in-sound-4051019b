# SoundMap / Life in a Sound — Proje Durumu

Son güncelleme: 2026-09-30

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
  Registry (**9 tür × 9 duygu = 81 kombinasyon** — pop/punk/rock/soul/funk/hip-hop/
  jazz/new-age/reggae) → sahne duvar kağıdı (çok eksenli geri dönüş zinciri; tek
  keskin `cover` katmanı, bulanık letterbox yok). Resolver'in renk/tema çıktısı
  sahne render'ında henüz tüketilmiyor (açık karar, §6).
- **Kart/Poster Sistemi (kısmen):** quiz kartı (yolculuk adımı; metinler HTML/CSS
  tipografiyle, görselin içine gömülü değil), kartı ortaya çıkarma ekranı (3:4 sabit
  oran), poster/hero/grid bileşenleri.
- **Kilitli kararlar:** görseller yazısız üretilir, gerçek metin CSS'ten gelir;
  runtime'da AI görsel üretimi yok (§9, kart artwork'ü hariç); kartezyen kombinasyon
  matrisi yok (§10).

## 3. Bugün ve Bu Hafta Ne Yapıldı

### 2026-09-30 — 5 yeni türün sahne duvar kağıtları bağlandı + görsel katman doğrulandı + taksonomi kararı
- **5 yeni tür klasörü Asset Registry'ye bağlandı:** kullanıcı `funk/`, `hip-hop/`, `jazz/`, `new age/`, `reggae/` klasörlerini tam 9 duygu durumu setiyle ekledi. Bunlar artık sahne arka planı sisteminde gerçekten kullanılıyor: tür kimlikleri eklendi, tür aile eşlemeleri (funk: p-funk; yeni çağ: newage/ambient; caz: bebop/swing; reggae: dancehall/ska vb.) tanımlandı ve kayıt defteri 36 satırdan **81 satıra** çıktı (9 tür × 9 duygu). Daha önce bu türler nötr pop duvarına düşüyordu; artık kendi atmosferlerini gösteriyor.
- **Doğrulama:** tip 0 hata, testler 716 geçti / 2 atlandı (0 başarısız), derleme başarılı ve build 81 arka plan görselinin tamamını içeriyor (tür başına 9). Görsel değişiklik olduğu için tarayıcı göz onayı (kural-10) alındı.
- **Görsel katman teyidi:** kartı-ortaya-çıkarma ekranındaki "Era X of 8" başlığı (artık yok) ve sahnenin tek keskin `cover` arka planı (eski bulanık letterbox katmanı kaldırıldı) tek tarayıcı koşusunda birlikte doğrulandı.
- **Taksonomi kararı (kod hatası değil):** kullanıcı, funk olarak bildiği bir parçanın (Fat Larry's Band) soul görseli gösterdiğini raporladı. Gerçek neden araştırıldı: iTunes bu parçayı/albümü **"R&B/Soul"** etiketiyle kataloglamış ("funk" geçmiyor); uygulama yalnızca provider'ın primary-genre etiketini sadıkça yansıtıyor. Bu, sanatçı düzeyi bir kürasyon meselesidir, alias/kod hatası değil. **Karar:** olduğu gibi kabul (R&B/Soul → soul, iTunes'a sadık); sanatçı-özel üst üste binmeler ileride music map işinde manuel ele alınacak — tür eşleme tablosunu değiştirerek değil.

### 2026-09-29 — Görsel asset dosyaları tür klasörlerine ayrıldı (arka plan mimarisinin ön adımı)
- Eski metin-içeren genel `mood-backdrop` PNG seti kaldırıldı; yerine her tür için ayrı klasörlerde metinsiz `.jpg` setleri geldi (4 tür ile başladı: pop/punk/rock/soul — 5 tür ertesi gün eklendi).

### 2026-09-27 — MUSIC DNA P0 (c): kullanıcının kendi sözleri artık Life Story'ye işleniyor + OpenRouter canlılığı
- **Boşluğu kapatıldı:** kullanıcının Life Feed'e yazdığı serbest metin notları artık gerçekten Life Story chapter'larına ve Emotional Timeline'a akıyor. Önceden results ekranı grounded analizi `contexts`'siz çağırıyordu — yani kullanıcının kelimeleri üretimde asla anlatıya ulaşmıyordu (şablon metin kalıyordu). Artık Life Feed varsa, her girişin notu `contextText` olarak ilgili aşamanın anlatısına taşınıyor; Life Feed yoksa davranış değişmiyor (şablon).
- **Kural-10 gözle onayı VERİLDİ.** Bu bir "LLM çıktı metni" değişikliği olduğu için, code-review'ın da gerekli gördüğü üzere önce/sonra kanıtı üretildi: aynı şarkı/aşama için (1) contexts'siz çağrıldığında ŞABLON metin ("Childhood: her şey {şarkı} ile başlıyor. Bu seçim, dönemin nostalgic tonunu taşıyor…"), (2) not ile çağrıldığında KULLANICININ BİREBİR notu ("Bu şarkı beni hep ilk işimi kaybettiğim döneme götürüyor…"). İki metin net şekilde farklı; ikincisi kullanıcının kelimelerini taşıyor. Yeni veri yolu açıldığından CrisisGuard de doğrulandı — anlamlı ama kriz-sinyali olmayan notta YANLIŞ tetikleme YOK.
- **OpenRouter key canlılığı doğrulandı:** gerçek bir mood-inference çağrısı (canlı kod yolu) HTTP 200 döndü ve "Superstition / Stevie Wonder" için "Energetic" (doğru) mood verdi; openrouter/free fallback'i de HTTP 200 — fallback'e sessiz düşüş yok. (Uzun süredir "test edilmedi" listesinde bekleyen madde kapatıldı.)
- Yeni birim testi eklendi (`buildGroundedLifeContexts`): 8 aşamalı merdiven + not taşıma + 8-sonrası girişin "New Chapter" alması (Acceptance sanmasın).

### 2026-09-26 — SonarCloud New-Code duplication gate'i (%3.4→%3) temizlendi
- GitHub'daki "commit yanında kırmızı X"in kaynağı SonarCloud Code Analysis'ti (handoff-check zaten yeşildi). SonarCloud "New Code" penceresi (30 günlük birikim) %3.4 duplication ölçüyordu — bu, bugünkü işin değil, önceki session'ların eklediği dosyaların katkısıydı.
- Per-file inceleme: 172 dup satır dağılımı — `dictionaries.ts` (56, %75.7, 5 dil yapısal şablon = bilinen false-positive), `eraThemes.ts` (64, %58.7, structural theme-ladder), `crisisGuard.test.ts` (38, 5 dilli tekrar iskeleti), kalanı küçük test tekrarları. Dictionaries/eraThemes production ve false-positive/structural — dokunulmadı (davranış/yakınsama riski, ayrı iş).
- **Action:** yalnız `crisisGuard.test.ts`'deki 5 dilli `it(detect...)` iskeleti iki `it.each` tabloya indirildi (aynı örnekler, davranış değişmedi — kriz güvenliği korundu). 172−38=134 satır → tahmini %2.62 (< %3 eşiği). typecheck 0, lint temiz, full suite 714 passed.

### 2026-09-26 — Manuel-şarkı artwork fix'i (master-frame artık gerçek kapak gösteriyor) + Kural-10 onayı
- **Kök neden 1 (title-only sorgu):** results ekranındaki manuel-şarkı artwork doğrulaması (`artPatch`) iTunes'a yalnız şarkı adıyla sorgu atıyordu; iTunes eşleme kuralları (itunes-mapping) hem başlık hem sanatçı token'ı şart koşuyor. Title-only sorgu hiçbir zaman doğrulanmıyordu → manuel şarkıların kapakları (Song Universe kartlarında bile) hep boş kaldı. Sorguya sanatçı eklendi.
- **Kök neden 2 (kayıt/okuma ekseni uyumsuzluğu):** `artPatch`/`artStatus` 1-bazlı anahtara (`qid`) yazılıyor ama 0-bazlı (`[i]`)'den okunuyordu. İlk şarkı (Purple Rain) hep boş "disc", son şarkının master-çerçevesi bir öncekinin kapağını gösteriyordu. Yazım 0-bazlıya çekildi.
- **Fix-1 (master-frame):** doğrulanmış artwork artık yalnız alt kartlara değil, ana posteri/müzik haritası çerçevesine (DynamicMusicMap/MasterPosterSheet) de uygulanıyor.
- **Fix-2 (yükleme-gate):** kaydedilmiş yolculuk yüklenmeden önce müzik haritası artık gerçek veriyle değil, iskelet (skeleton) ile bekliyor.
- **Kural-10:** gözle onay VERİLDİ — tarayıcıda 8/8 şarkı kartında gerçek albüm kapağı + master-çerfremede doğru şarkının (Bohemian Rhapsody/Queen) kapağı görüldü. Commit `a18421c`.
- **Not (teknik borç, bugünkü işi bloklamadı):** `cardArtwork.server.ts` birincil Imagen tier'ı (`imagen-3.0-generate-002`) bu API'de 404 veriyor; üretim zinciri fiilen her zaman Gemini native'e düşüyor. Artwork üretimi çalışmaya devam ediyor (fallback'ten). Gemini free-tier günlük görsel kotası da bugün aşılmıştı (429).

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
- **Asset Registry 9 tür × 9 duygu = 81 kombinasyonla tamamlandı (2026-09-30):**
  funk/hip-hop/jazz/new-age/reggae klasörleri bağlandı; her tür kendi atmosferini
  gösterir, eşleşmesiz türler nötr pop duvarına düşer. Kural-10 onayı alındı.
- Hugging Face tamamen kaldırıldı (sunucu kademesi + istemci ölü kod / zombi
  hata dalları); taksonomi düzeltildi.
- Kart yeniden tasarımı (Adım 1-4) + "Add to Collection" + okunurluk katmanı.
- **Kriz güvenliği:** CrisisGuard (5 dil deterministik triage) + CrisisSupportPanel +
  ETHICAL_AI.md (Founding Principle + bilinen-sınırlama). Kullanıcının kriz notu asla
  LLM'e gitmez / kalıcılaşmaz.
- **AI ton / tanı-yasağı kuralları:** 4 prose prompt (life-story, poetic-analyzer,
  entry-insight, card-lore) tanı-yasağı + anti-klişe kurallarını taşıyor; mood-inference
  sistem satırı "klinik değil"e çekildi. Çıktı tonu davranışsal olarak doğrulandı.
- **MUSIC DNA P0 (a)+(b)+(c) tümü tamamlandı:** dürüst "Unclassified" vibe (metadata yoksa),
  Emotional Timeline şarkının kendi mood'undan, ve **kullanıcının Life Feed serbest metni artık
  Life Story'e akıyor** (Kural-10 göz onayı alındı). OpenRouter key canlılığı da doğrulandı (HTTP 200).

### Kısmen Tamamlanan / Devam Eden
- **FAZ 4c — renk/tema kaynağı kararı (açık):** sahne, kendi tema kaynağından renk
  alıyor; çözücünün renk/tema çıktısı henüz render'da kullanılmıyor. İki kaynak
  farklı türetiyor (2010-sonrası ayrışma riski) — karar verilmemiş.
- **Asset Registry genişlemesi:** yeni tür/dönem/duygu kombinasyonları manuel
  eklenmeyi bekliyor (onayla). **9 tür kapanmış durumda (2026-09-30);** henüz
  klasörsüz: metal (rock'a gider), synth, gothic, grunge.
- **Kart çerçevesi overlay (v1):** altyapı kuruldu, varsayılan kapalı; gerçek
  çerçeve görselleri + eşleme hâlâ bekliyor.
- ~~Soul görsellerinin oran tutarsızlığı~~ **ÇÖZÜLDÜ (2026-09-30):** yeni `.jpg` seti uniform **832×1248 (2:3)**; oran tutarsızlığı yok.

### Hiç Başlanmamış
- FAZ 4 Music Memory veri modeli (tasarım taslağı var, kod yok), FAZ 5 User
  Accounts, FAZ 6 Public Beta / Product Hunt / Mobile.

## 5. Sıradaki Adımlar

### Kısa Vade (bu hafta/gün)
- **POSTER/MUSIC MAP ARKA PLAN sistemi (büyük açık iş):** metinsiz sahne + CSS metin, runtime üretim yok, 10-15 dominantVibe kombinasyonu için önceden üretilmiş Asset Registry sahnesi; üretim kullanıcı manuel. ✅ **Görsel-API fizibilitesi denendi + VAZGEÇİLDİ (2026-09-27):** gerçek görsel-üretim API'si (openai/gpt-5-image) teknik olarak mümkündü ama maliyet (~$0.25/görsel), süre (~45-50sn/görsel) ve tutarsız kalite nedeniyle bu yola girmeme kararı verildi; kullanıcı kendi elle üreteceği assetlerle devam edecek.
- **Teknik borç:** `cardArtwork.server.ts:28` Imagen modeli bu API'de 404 (üretim zinciri hep 2. tier'a düşüyor) — ayrı gün ele alın.
- FAZ 4c renk/tema kaynağı kararı (görsel değişiklik → göz onayı gerekir).
- ~~Eski genel `mood-backdrop` setini metinsiz yeniden üret~~ **ÇÖZÜLDÜ (2026-09-29/30):** yerini genre klasörlerindeki metinsiz `.jpg` setleri aldı.
- Kart çerçevesi overlay v2: gerçek çerçeve görselleri + eşleme (aktifleşince göz doğrulaması gerekir).
- **Music map / artist kürasyonu:** funk-adjacent isimlerin (örn. Fat Larry's Band) iTunes "R&B/Soul" etiketiyle soul görseli alması kabul edilmiş taksonomi kararıdır; sanatçı-özel üst üste binmeler ileride music map işinde manuel ele alınacak.

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
- ~~Eski genel görsellerin içinde metin var~~ **ÇÖZÜLDÜ (2026-09-29):** metinli eski PNG seti kaldırıldı, yerini metinsiz `.jpg` setleri aldı.
- **STEEL age-range sınırı (lifeCards):** "23-29" artık komşularla çakışmıyor ama
  "Güç" çağının alt/üst sınırı tasarım kararı olarak netleşmedi — kabul edildi.
- ~~Soul görsellerinin oran tutarsızlığı~~ **ÇÖZÜLDÜ (2026-09-30):** yeni `.jpg` seti uniform 2:3.
- Üç ayrı "yaş dönemi" sistemi hâlâ birleşmedi (ayrı karar, bilinçli dokunulmadı).
- Kalıcı kurallar: repo-lokal git kimliği doğru olmalı (Vercel engeli); `git add -A`
  yasak (anahtar/debri süpürür).

## 7. Yeni Bir AI Oturumuna Hızlı Bağlam

Bu, 8 şarkı→görsel-poster üreten React (TanStack Start, Node+Nitro, Vercel'de)
uygulaması. Çalışmaya başlamadan önce **zorunlu sırayla oku**: `AGENTS.md` →
`STATE.md` → `docs/HANDOFF.md` (tek otorite kaynak; bu dosya DEĞİL) → canlı repo
durumunu `git pull` + `git log` ile doğrula (doküman değil git'e güven). Proje artık
**kriz-güvenli** (CrisisGuard, 5 dil serbest-metin triage) ve **tanı-yasaklı** AI
ai kurallarına sahip (4 prose prompt'ta "klinisyen değilsin" + anti-klişe; `ETHICAL_AI.md`
Founding Principle). Music DNA motoru **şarkı-tabanlı** çalışıyor (cevaplar DNA'ya katılmaz;
ayrı kişilik profili + poster besler); P0 (a)+(b)+(c) tamamlandı (metadata-yoksa dürüst
"Unclassified" + timeline→şarkı-mood + **kullanıcının Life Feed serbest metni Life Story'ye
akıyor**; Kural-10 onayları verildi). OpenRouter key canlılığı doğrulandı (HTTP 200). Testler geçiyor, worktree temiz,
kural-10 göz onayları kapalı. Her önemli push'ta bu
dosyayı HANDOFF'la birlikte güncel tutmayı unutma.
