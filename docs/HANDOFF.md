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
Testler:   201/201 geçti — 2026-08-22 (14 dosya)
tsc/build: temiz (tsc --noEmit = 0 hata; VERCEL=1 npm run build = 0)
Lint:      Yeni dosyalar temiz; 4 DOSYADA ÖNCEDEN VAR OLAN prettier drift'i
           (Results.tsx, SongPicker.tsx, Waveform.tsx, soundmap/data.ts)
           bilinçli dokunulmadı — minimal-değişiklik ilkesi.
Deploy:    Vercel preset'i koşullu (sadece VERCEL=1'de aktif; Lovable/local
           default cloudflare kalır). `.vercel/output` gitignore'da.
Leak check: `npm run check:bundle` (client bundle'da server-only isim
           taraması) yeşil; negatif test exit=1.
LLM:       GEMINI_API_KEY BU ORTAMDA BOŞ — canlı Gemini + canlı Vercel deploy
           doğrulaması KULLANICI'DA BEKLEMEDE (§3'te adım adım).
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

**Vercel Deployment & Serverless Environment Setup (TAMAMLANDI; canlı deploy
KULLANICI'DA).** Amaç: zero-config Vercel deploy'u, Gemini server-fn'ları
(`generateAnalysis.server.ts`, `generateEntryInsight`) Node serverless
ortamında güvenli process.env okurken anahtar asla client bundle'a
sızmasın; kullanıcıya adım-adım Vercel bağlantı rehberi (§3).

Değişiklikler:
- `vite.config.ts` — `nitro: process.env.VERCEL ? { preset: "vercel" } : {}`.
  Vercel CI `VERCEL=1` enjekte eder → Nitro `vercel` preset'i `.vercel/output`
  üretir (static + `__server.func` Node.js 22.x, SPA fallback `/(__*server)`).
  Lovable/local'da default cloudflare preset korunur (Lovable sandbox zaten
  cloudflare'ı zorlar → geriye uyumlu).
- `vercel.json` — minimal pinned config: `"framework": null` (auto-detect
  kapalı, routes `.vercel/output/config.json`'dan), `installCommand/buildCommand`
  ve `regions: ["fra1"]`. `.vercel/` build çıktısı `.gitignore`'a eklendi.
- `scripts/verify-no-server-secrets.mjs` + `npm run check:bundle` — client
  bundle'da (`.vercel/output/static`, `.output/public`, `dist/client`)
  `GEMINI_API_KEY`/`GROQ_API_KEY`/`SERVICE_ROLE` isim taraması; sızıntıda
  exit 1 (negatif test ile kanıtlı).
- Testler: 201/201, tsc/build temiz (VERCEL=1 ile de).

Uyum: `vite.config.ts`'teki DEV-ONLY allowedHosts satırı korundu; doc açıklar.

---

## 3. Şu an açık/bekleyen tek şey — Vercel'e bağlan (kullanıcı adımları)

Deploy altyapısı push edildi; canlı URL sadece kullanıcının Vercel hesabını
bekliyor:

1. **Repoyu bağla:** [vercel.com → Add New → Project] → GitHub
   `mascarillion8888/life-in-sound-4051019b` import. Framework davranışı
   bundle'daki `vercel.json`'dan gelir (restart gerekmez).
2. **Anahtarı gir:** Project → Settings → Environment Variables →
   `GEMINI_API_KEY` = `<groq/gemini anahtarın>` (scope: **Production**,
   istersen Preview da). Asla `VITE_` önekiyle girme.
3. **Deploy:** ilk push'tan sonra Vercel otomatik build çalıştırır
   (breadık build komutu `npm run build`; VERCEL=1 vercel preset'ini açar).
4. **Doğrula** (canlı URL açıldığında):
   - `/results` — Dynamic Music Map Gemini-zengin mi; Life Feed'de şarkı+not
     ekle → insight deterministik'ten tek cümlelik Gemini prose'a yerinde
     geçiş yapıyor mu.
   - Anahtar girilmediyse deterministik çıktı görülür — hata değildir.
5. **Validation Gate** (Vercel sonrası): 5+ gerçek kişiye canlı URL'yi
   göster, geri bildirim topla. Faz 4 kullanıcı onayı olmadan başlamıyor.

Yerelde aynı sonuç: `VERCEL=1 npm run build && npm run check:bundle`.

---

## 4. Olası sonuçlar

**🅐 Canlı URL açılır + Gemini çıktısı zengin →** Deploy doğrulandı.
Validation Gate'e geç.

**🅑 Build Vercel'de kırılırsa →** Build loglarında nitro preset hatası /
Node 22 natives sorunu aranır; `vercel.json`'daki pinned komutlar ilk şüpheli.

**🅒 Sayfa açılıyor ama Gemini deterministik kalıyorsa →** `GEMINI_API_KEY`
Production scope'ta girilmemiş (en sık hata) veya anahtar yetki yetersiz —
Dashboard env'e bakılır, redeploy.

**🅓 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden
yaz, `checkpoint: [özet] — HANDOFF.md güncellendi` ile push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**Deploy preset'i koşullu tut, hostu değil derli.** `@lovable.dev/...` config
non-sandbox'ta cloudflare-module preset'ini default tutar; Vercel'i seçmenin
tek kabul edilebilir yolu ORTAM DÜZEYİNDE koşul (`process.env.VERCEL`,
Vercel'in injection'ı + localde bu env yok → local build aynı kalır). Böylece
Lovable milestone'tan ayrılmadan Vercel Build Output API'sini alırsın.
`.vercel/output`'u asla commit'leme (gitignore'da). Leak check'in değeri:
isim bazlı basit scan, negatif testle kanıtlı.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- `vite.config.ts`'te DEV-ONLY allowedHosts'u commit'leme (satır doc'unda).
- Vercel'e `VITE_GEMINI_API_KEY` `-prefixed` ortam değişkeni girme,
  `GEMINI_API_KEY` yeterli (client bundle asla içinde değil).
- `.vercel/` build çıktısını commit'leme (gitignore'da).
- Önceden var olan prettier drift'ini rastgele kozmetik olarak fix etme.

---

## 7. Devir kaydı (son 5 satır)

| Tarih | Kim | Ne | Commit |
|---|---|---|---|
| 2026-08-20 | OpenHands | MusicBrainz arama UI'dan kaldırıldı | 7b27cd3 |
| 2026-08-22 | OpenHands | Dynamic Music Map Engine + Poetic Gemini Analyzer | 7cf32e4 |
| 2026-08-22 | OpenHands | Life Feed UI Suite + Evolving Poster | 3b4c604 |
| 2026-08-22 | OpenHands | Vercel Deployment + Leak Check | (bu checkpoint — `git log -1 --oneline` ile doğrula) |

---
_2026-08-22 OpenHands tarafından tamamen yeniden yazıldı. Vercel deployment +
serverless env setup teslim edildi (koşullu nitro preset, vercel.json,
leak-check script; 201/201 test, VERCEL=1 build temiz). Canlı deploy + Gemini
doğrulaması kullanıcıya devredildi (§3). Tek kaynak `docs/HANDOFF.md`._
