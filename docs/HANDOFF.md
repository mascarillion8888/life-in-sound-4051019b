# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her operasyon sonunda TAMAMEN yeniden yazılır.
> `STATE.md` anayasa (kalıcı kurallar), bu dosya "şu an". Her AI oturumu
> ilk iş olarak bunu BAŞTAN SONA okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (asla sabit yazılmaz — `git log -1 --oneline` ile doğrula)
Testler:   201/201 geçti — 2026-08-22 (14 dosya; +3 yeni komponent test dosyası)
tsc/build: temiz (tsc --noEmit = 0 hata; npm run build = 0)
Lint:      Yeni dosyalar temiz; 4 DOSYADA ÖNCEDEN VAR OLAN prettier drift'i
           (Results.tsx, SongPicker.tsx, Waveform.tsx, soundmap/data.ts)
           bilinçli dokunulmadı — minimal-değişiklik ilkesi.
LLM:       GEMINI_API_KEY BU ORTAMDA BOŞ — canlı Gemini çıktı doğrulaması
           (analiz + entry insight) KULLANICI makinesinde yapılmalı;
           deterministik fallback her durumda render olur.
Smoke:     /results SSR çıktısında "Life Feed" bölümü görüldü (dev server).
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

**Life Feed UI Suite & Dynamic Timeline Evolution (TAMAMLANDI + 201/201 test
yeşil; canlı Gemini doğrulaması KULLANICI'DA BEKLEMEDE).**

Kullanıcı talebi: 8. şarkıdan sonra kısıtsız "Life Feed" — kullanıcı sürekli
şarkı/not/anı ekleyebilsin; her eklemeye anında şiirsel (dost sesiyle) insight;
timeline dinamik bölümlere (haftalık/aylık portallar) gruplansın; poster
durmadan büyüsün.

Önceki oturumdaki temel (life-feed.ts state + persistence) bu oturumda UI
katmanıyla tamamlandı:

Yeni dosyalar:
- `src/components/feed/LifeFeedInput.tsx` — Quick Entry Bar: iTunes
  önerileri (`suggestSongs` server fn, Fuse.js re-rank — QuestionCard'ın
  ghost akışıyla aynı sınır) + serbest metin → manual Song fallback; bellek
  notu textarea'sı ("Bugün seni hangi şarkı anlatıyor?"). `suggester` DI
  prop'u testlerde gerçek fetcher değişimi sağlar (mock yok).
- `src/components/feed/LifeFeedTimeline.tsx` — sonsuz timeline: moment
  kartları (cover art / Disc3 fallback, başlık, sanatçı, tarih, not, şiirsel
  insight), `groupFeedEntries` ile haftalık (≤35 gün) / aylık dinamik
  portallar; inline not düzenleme + silme.
- `src/components/feed/LifeFeedSection.tsx` — orkestratör: mount'ta
  loadLifeFeed ?? graduateToLifeFeed (tek sefer), her mutasyonda kaydet,
  `onFeedChange` ile posteri besle; insight akışı = deterministik ANINDA +
  Gemini YERINDE upgrade (`insightFetcher` DI prop'u).
- Testler: `LifeFeedInput.test.tsx`, `LifeFeedTimeline.test.tsx`,
  `LifeFeedSection.test.tsx` (tam state-sync: add → anında deterministik
  insight → Gemini upgrade → localStorage persist).

Değiştirilenler:
- `life-feed.ts` — `insight` alanı (kalıcı), `updateLifeFeedEntry` (note/
  insight patch, eğriyi oynatmadan), `feedEntryIntensity` (deterministik
  0.35..0.95, song+addedAt hash; not/insight edit'i eğriyi DEĞİŞTİRMEZ),
  `groupFeedEntries` (haftalık/aylık portallar, undated güvenliği).
- `poetic-analyzer.ts` — `deterministicEntryInsight` (5 şablon, stableHash;
  not varsa notu örer — sadece gerçek girdiler, hiçbir şey uydurulmaz).
- `generateAnalysis.server.ts` — `generateEntryInsight` server fn (tek
  cümlelik prose insight; systemPrompt override + jsonMode=false desteği
  `callGeminiPoeticAnalyzer`'a eklendi).
- `PosterCanvas.tsx` — `feedEntries` prop'u: eğri 8+N nokta ("+1","+2"
  işaretleri, feed barları ters gradyan), "Life Feed — the map keeps growing"
  playlist bölümü; export `poeticPoster`'a feed'i iletir.
- `poeticPoster.ts` — export eğrisi base 8 + feed (feed barları accent
  renkte, "+n" etiketli).
- `results.tsx` — ResultsPage `journey` + `feed` state'i; DynamicMusicMap
  feedEntries alır; yeni "Life Feed" bölümü (Radio ikonu) Dynamic Music
  Map ile Emotional Timeline arasında.

Uyum: `vite.config.ts` allowedHosts (DEV-ONLY) commitlenmedi; orchestraya
dokunulmadı; companion/memory/pattern sistemi geri getirilmedi (STATE.md 🚨).

---

## 3. Şu an açık/bekleyen tek şey

Life Feed UI TAMAM ve push edildi. BEKLEYEN: canlı Gemini doğrulaması
(analiz + entry insight, kullanıcı makinesinde). Validation Gate (5+ gerçek
kişi) hâlâ geçerli öncelik; Faz 4 kullanıcı onayı olmadan başlamıyor.

**Sıradaki tek adım:**
```
1) KULLANICI: git pull → GEMINI_API_KEY=<key> ile npm run dev → journey
   tamamla → /results'ta:
   a) "Dynamic Music Map" bölümü Gemini-zengin mi (manifesto/chapter/duality)
   b) "Life Feed"de bir şarkı + not ekle → insight önce deterministik
      gelip sonra tek cümlelik Gemini prose ile yerinde değişiyor mu
   Anahtar yoksa deterministik davranış beklenendir — hata değil.
2) Validation Gate: 5+ kişiye ürünü göster, geri bildirim topla. AI adımı YOK.
```

---

## 4. Olası sonuçlar

**🅐 Kullanıcı Gemini-zengin analiz + entry insight görür →** Doğrulandı.
Validation Gate'e geçilebilir. Sıradaki olası iş: feed'e göre ana analizin
de evrilmesi (şu an PoeticAnalysis sadece 8 şarkı; feed eğri+playlist'e ekleniyor).

**🅑 Kullanıcı sadece deterministik çıktı görür →** GEMINI_API_KEY eksik veya
endpoint erişimi sorunu; her iki server fn de sessizce null/fallback döner.

**🅒 Entry insight cümlesi JSON/bozuk gelirse →** İlk boş olmayan satır
alınıyor; gerekirse prompt'a çıktı formatı sertleştirmesi küçük yama olur.

**🅓 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden
yaz, `checkpoint: [özet] — HANDOFF.md güncellendi` ile push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**Eğri kararlılığı = kimlikten türet.** Feed entry yoğunluğu `stableHash
(title+addedAt)`'ten geliyor; not/insight edit'i eğriyi kımıldatmaz, silme/
ekleme otomatik yeniden hesaplatır (PosterCanvas'daki curve türevlenmiş
değer — state değil). Ayrıca: DI prop'ları (`suggester`, `insightFetcher`)
server-fn sınırlarını mock'suz test edilebilir kıldı — deferred Promise ile
"anında deterministik → sonra Gemini" yarışı deterministik olarak test edildi.
jsdom'da `getByText("+1")` hem eğri hem playlist rozetlerini bulur →
`getAllByText` kullan.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- `vite.config.ts`'i değiştirme — DEV-ONLY allowedHosts commitleme.
- Önceden var olan prettier drift'ini (Results.tsx, SongPicker.tsx, Waveform.tsx,
  soundmap/data.ts) rastgele kozmetik olarak fix etme — ayrı bir temizlik
  kararıdır, kullanıcı onayıyla.
- Anahtarsız ortamda canlı Gemini/Groq doğrulaması yapmaya çalışma;
  kullanıcı makinesine devret.

---

## 7. Devir kaydı (son 5 satır)

| Tarih | Kim | Ne | Commit |
|---|---|---|---|
| 2026-08-20 | OpenHands | metaLine + isValidSong artist fix | 482a292 |
| 2026-08-20 | OpenHands | Journey Step 4 UI tersine çevirme | 7a8a56a |
| 2026-08-20 | OpenHands | MusicBrainz arama UI'dan kaldırıldı | 7b27cd3 |
| 2026-08-22 | OpenHands | Dynamic Music Map Engine + Poetic Gemini Analyzer | 7cf32e4 |
| 2026-08-22 | OpenHands | Life Feed UI Suite + Evolving Poster | (bu checkpoint — `git log -1 --oneline` ile doğrula) |

---
_2026-08-22 OpenHands tarafından tamamen yeniden yazıldı. Life Feed UI Suite
(Quick Entry Bar, sonsuz timeline, instant insight) + Evolving PosterCanvas
teslim edildi (201/201 test, tsc/build temiz). Canlı Gemini doğrulaması
kullanıcı makinesine devredildi. Tek kaynak `docs/HANDOFF.md`._
