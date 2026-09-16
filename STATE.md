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
10. **🖼️ Görsel Doğrulama Kuralı (ihlal edilemez, 2026-08-19'da eklendi):** Sebep: bir UI hatası (journey wizard'da state kirliliği + MusicBrainz sonuç metni bitişik yazılması + uyarı mesajının görsel render durumu belirsizliği) sadece `npm test`/`tsc` yeşil olduğu için fark edilmedi — kullanıcı kendi gözüyle test edince ortaya çıktı. Kural: (1) Hiçbir UI/arayüz değişikliği sadece terminal çıktısına (test/tsc/build yeşil) bakılarak "tamamlandı" ilan edilemez. (2) Her UI değişikliğinde gerçek tarayıcıda (Web Preview / Playwright) GERÇEK etkileşimle (tıklama, form doldurma, modal açma) akışın sonuna kadar görsel olarak doğrulanır, ekran görüntüsü alınır. (3) Rapor formatı: "E2E tarayıcı testinde [X] butonuna basıldı, [Y] ekranına geçildi, akış tamamlandı" — soyut "çalışıyor" ifadesi yetmez. (4) Kullanıcı ekranda görüp "Arayüz Onaylandı" demeden hiçbir görev STATE.md/docs/HANDOFF.md'de "TAMAMLANDI" olarak işaretlenmez. (5) Bu kural sadece tek bir oturuma değil TÜM gelecekteki AI oturumlarına (Claude/Gemini/ChatGPT/OpenHands) uygulanır — STATE.md'de yaşadığı için.

---

## 📌 KARARLAR

- **§9 gerilimi çözümü (13 Eylül):** Song.mood alanı Song tipinde kalır
  (persistence zaten hazır), ama değeri HER ZAMAN pipeline'daki ayrı bir
  inference katmanından (moodInference.ts) gelir — Song'a UI'dan veya
  başka bir yerden doğrudan mood yazılmaz. Song yine nötr taşıyıcı;
  türetme mantığı ayrı, izlenebilir bir modülde izole edilir. Bu, §9'un
  "Song'a derived alan ekleme" yasağının ruhuna (rastgele/izlenemez
  türetme) uygun, lafzına değil.

- **OpenRouter geçişi (13 Eylül):** Tüm LLM çağrıları (mood inference + poetic
  analyzer) Gemini native SDK yerine OpenRouter üzerinden yapılıyor —
  `src/lib/openrouter.server.ts`: primary `google/gemini-2.5-flash-lite`,
  fallback `openrouter/free`; HTTP 429/5xx'te tek retry, istemci hatalarında
  (400/401) throw (transient değil, fallback anlamsız); key server-only
  `OPENROUTER_API_KEY` (asla `VITE_` prefix'i değil), hiçbir yere loglanmaz.
  Neden: tek modele bağımlılık + kredi sınırları; OpenRouter tek anahtarla
  çoklu model + fallback zinciri sağlıyor. `@google/genai` kaldırıldı.
  (commit `eee319d`)

- **Visual DNA kararı (15 Eylül):** GPT Image (2.5 Flare/Sunburst) runtime'da
  asla görsel ÜRETMEZ — kullanıcıya anlık görsel veren bir servis DEĞİL.
  İşlevi offline **Asset Factory**'dir: master'ları üretir, art-review'dan
  geçen `APPROVED` asset'ler Supabase Storage + Asset Registry'ye yazılır;
  runtime'daki **Visual Resolver** yalnızca onaylı asset'lerden deterministik
  seçim yapar (üretim çağrısı yok, ANA_YASA §0 uydurma yasağı kapsamında).
  Görsel evren, `STYLE_CORE` (değişmez) + era + genre(pop) + 9 MOOD_SET
  katmanından oluşur; mood yalnızca ışık/kontrast/atmosferi değiştirir.
  İlk benchmark: **1980s × Pop × 9 Mood** — golden master onaylanmadan
  era/genre genişlemesi yok. (Bu, golden-benchmark PRODUCTION'dır, ancak
  bugün üretim YOK — karar repo karar defterine işlendi, spec üretilmedi:
  kullanıcı "üretim yapmıyoruz" dedi.)

- **AYRI VISUAL AI KATMANI kararı (16 Eylül — LOCKED/PROPOSED):** Büyük, elle
  üretilmiş `era × genre × mood` asset matrisi ÜRETİLMEZ. Bunun yerine ayrı bir
  **Visual AI katmanı** kontrollü bir reference-image kütüphanesinden (style/era/
  genre/lighting/object anchors — kopyalama DEĞİL, visual grounding) GPT image
  generation ile görsel varyasyonlar üretir. Mimaride 4 sorumluluk AYRI tutulur:
  Music AI (FACT→MusicDNA→mood, görsel üretmez) → Visual Intelligence (DNA+
  constraints→VisualProfile) → Visual Resolver (VisualProfile→VisualSpec; runtime'da
  GPT Image ÇAĞIRMAZ) → Visual AI (VisualSpec+approved references→generated variant;
  provider adapter arkasında, değiştirilebilir). Kararlar dokümana işlendi:
  `docs/TECH/ARCHITECTURE.md` (kanonik) + `docs/TECH/VISUAL_ARCHITECTURE.md` (görsel
  derin daldırma). **Kod gerçeklemesi YOK — bugün yalnızca doküman:** 8× fix, Music DNA,
  deterministik çekirdek, mevcut `cardArtwork` runtime üretimi (Imagen→Gemini→HF) DEĞİŞMEDİ.
  Yeni doküman kararları kullanıcı onayıyla; implementation gelecek fazda.

- **ANA_YASA §9 uzlaştırması (16 Eylül):** `cardArtwork.server.ts`'nin runtime'da
  (kullanıcı şarkı seçtiğinde Imagen→Gemini→HF) görsel ürettiği artık §9'da açıkça
  CURRENT/IMPLEMENTED **geçici istisna** olarak işaretlendi (gizlenmeden); hedef ise
  Visual AI katmanı devreye girince runtime'da YENİ üretim YAPILMAMASI, yalnızca onaylı
  Asset Registry'den deterministik Visual Resolver seçimi. Referans:
  `docs/ANA_YASA.md §9`, `docs/TECH/ARCHITECTURE.md`, `docs/TECH/VISUAL_ARCHITECTURE.md`.

- **Deployment netleştirmesi (16 Eylül, kanıta dayalı):** Repoda Dockerfile/docker-compose
  şu an YOK (HEAD'de hiç olmadı); Docker migration yalnızca `remotes/origin/migration/
  node-docker-v1` dalında kaldı, main'e girmedi (4c90958/f30b857 HEAD'in atası DEĞİL).
  **Aktif/güncel deployment = Vercel serverless (Node + Nitro react-start runtime):** vercel.json
  commit'i (`ad93ea5`, 22 Ağu) HEAD'in doğrudan atası; `npm run build` →
  `vite build && node scripts/postbuild-vercel-spa.mjs` (Vercel SPA, Nitro `.vercel/output`);
  `src/start.ts`/`src/server.ts` fetch-style server entry; keep-alive cron `/api/keep-alive`.
  Yani "Node + Nitro + Docker" STATE'in üst kısmındaki vizyon satırıdır; main'in GERÇEĞİ
  Node + Nitro üzerinde **Vercel**'dir. (Vercel=production aktif; Docker=main dışı, geçmemiş dal.)
  Kod/config değişmedi — yalnızca kayıt.

## 📝 NOTLAR

- **2026-09-13 (Claude):** HEAD'in görsel zenginliği (istatistik kartları, gradient) kaybedildi çünkü uydurma fallback değerleri (Timeless, Eclectic Explorer, diversity??100) içeriyordu — ANA_YASA §0 ihlali. Aynı görsel zenginlik, gerçek veri yokken placeholder/skeleton göstererek ayrı bir görevde geri kazanılabilir.
- **2026-09-13 (Claude):** SongUniverseCard merge çakışması: origin/dev/next tutuldu. HEAD'in stageName='Life Stage', vibeLabel='Grounded Reflection', temporalArcPosition=0 fallback'leri ANA_YASA §0 gereği reddedildi — bunlar gerçek analiz verisi olmadan sabit değer gösteriyordu.
- **2026-09-13 (Claude):** mood inference pipeline'a entegre edildi, musicDnaEngine mood-coverage gate'i kuruldu. P1'in mood kısmı tamamlandı.
- **2026-09-13 (Claude, akşam):** Yerel klon eskiydi (75a1589) — `git pull origin main` ile bugünün 4 commit'i geldi (b42e605 merge, 3a97968 mood, 95a9d9c docs, eee319d OpenRouter). Doğrulama: `tsc` 0 hata, vitest 631 passed / 2 skipped. `docs/HANDOFF.md` yenilendi, OpenRouter kararı KARARLAR'a işlendi. Ders: bir işin "yokluğunu" ilan etmeden önce daima fetch/pull — yerel klon yanıltabilir.
- **2026-09-13 (Claude, akşam #2):** (a) Key rotasyonu tamam ve doğrulandı — eski OpenRouter key iptali (401), yeni key `settings.json`+`.env`'de aktif (200). (b) Debri temizliği yapıldı — 21 untracked kalıntı (`soundtrack-ai/` iç içe klonu, `.next/`, `app/`, Next artıkları, `*.txt`) karantinaya taşındı (`Temp\soundtrack-ai-cleanup-20260913\`); repo kökünde yalnızca `settings.json` untracked (harness config, bilerek). Zombi `eslint .` süreçleri kullanıcının onayıyla kapatıldı — `eslint .`'nin asılı kalma nedeni buydu. (c) `*.tsbuildinfo` .gitignore'a eklendi. (d) UI görsel doğrulama (kural 10) hazırlandı: `.env` dolu, vibe testleri 14/14, dev sunucu ayakta — kullanıcının "Arayüz Onaylandı" demesi bekleniyor.

_Son güncelleme: Hermes — 2026-09-16 (DOCUMENTATION-ONLY: ARCHITECTURE.md + VISUAL_ARCHITECTURE.md oluşturuldu; AYRI VISUAL AI KATMANI + ANA_YASA §9 uzlaştırması + Deployment netleştirmesi (Vercel=Nitro aktif, Docker=main dışı) KARARLAR'a işlendi; kod/test/config/.env/deploy değişmedi, commit/push yok)_
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log + docs/HANDOFF.md gerçektir._
