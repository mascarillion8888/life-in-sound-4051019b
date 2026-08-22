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
tsc/build: temiz (tsc --noEmit = 0 hata; VERCEL=1 npm run build = 0;
           VERCEL'siz plain build = 0, postbuild no-op)
Lint:      vite.config.ts + scripts/ temiz; 4 DOSYADA ÖNCEDEN VAR OLAN
           prettier drift'i (Results.tsx, SongPicker.tsx, Waveform.tsx,
           soundmap/data.ts) bilinçli dokunulmadı — minimal-değişiklik ilkesi.
Deploy:    Vercel = STATİK SPA SHELL + serverless /_serverFn. Sayfa
           navigasyonları static index.html'den, server-fn'lar Node
           function'dan çalışır. Runtime SSR Vercel'de ARTIK YOK.
Leak check: `npm run check:bundle` yeşil (shell dahil static çıktı temiz).
LLM:       GEMINI_API_KEY BU ORTAMDA BOŞ — canlı Gemini doğrulaması
           KULLANICI'DA BEKLEMEDE (§3).
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş (NEDEN + NASIL)

**Vercel SSR çökmesinin ("This page didn't load") kök-neden tespiti + SPA
moduna geçiş (TAMAMLANDI; canlı deploy KULLANICI'DA).**

**Kök neden (lokal olarak yeniden üretildi):** Sayfadaki hata bizim kendi
`src/lib/error-page.ts` çıktımızmış. Gerçek çökme:
`TypeError: createCsrfMiddleware is not a function` — rolldown/nitro
serverless SSR bundle'ını DÖNGÜSEL import eden chunk'lara bölüyor
(`_ssr/server-A.mjs` ↔ `_ssr/server-B.mjs`); `var` hoisting binding'i
`undefined` çözüyor → her isteğin modül-init'i patlıyor → wrapper hata
sayfasını basıyor.

**Çözüm — üç katman:**

1. `vite.config.ts` — VERCEL=1 iken nitro'ya `inlineDynamicImports: true`
   eklendi → tek dosyalık server bundle, chunk sınırı/döngü yok. (Lovable
   config runtime'da tüm nitro opsiyonlarını spread eder; TS tipi dar
   olduğundan `as { preset?: string }` cast'i var.) Lovable/local preset
   (cloudflare) olduğu gibi korunur.
2. `scripts/postbuild-vercel-spa.mjs` (npm run build'e zincirli) —
   `.vercel/output` varsa: (a) build edilmiş function bundle'ını import
   edip `X-TSS_SHELL: true` isteğiyle shell render eder, doğrular
   (status 200, hata sayfası marker'ı yok, #root/asset var — biri
   tutmazsa build FAIL) ve `static/index.html`'e yazar; (b)
   `config.json` route'larını yazar: `/_serverFn*` → `/__server`,
   geri kalan her şey → `/index.html`. `.vercel/output` yoksa NO-OP
   (plain build bununla kanıtlı). Sayfalar artık statik shell'den
   client-side hydrate olur — runtime SSR çökmesi sayfayı artık
   düşüremez.
3. Doğrulama: shell HTML gerçek layout + client entry + yalnız
   `__root__` dehydrated match (ssr:true) içeriyor; `/_serverFn` POST'u
   bundle üzerinden 403 CSRF dönüyor (init çökmesi YOK); tüm asset
   yolları static'te mevcut; 201/201 test, tsc, eslint, prettier,
   check:bundle yeşil.

Not: TanStack'in built-in `spa` modu nitro build'iyle UYUMSUZ (preview
server `dist/server/server.js` bekler, nitro oraya yazmaz) — denenip
vazgeçildi; postbuild yaklaşımı hem preset-agnostik hem build-time
doğrulamalı.

---

## 3. Şu an açık/bekleyen tek şey — Vercel'e bağlan (kullanıcı adımları)

Deploy altyapısı push edildi; canlı URL kullanıcının Vercel hesabını
bekliyor (repo zaten bağlıysa sadece redeploy yeterli):

1. **Repoyu bağla / redeploy:** Vercel projesi `life-in-sound-4051019b`.
   Bu push otomatik yeni build tetikler. Build logunda
   `[postbuild-vercel-spa] Shell written ...` satırı görülmeli.
2. **Anahtarı gir:** Project → Settings → Environment Variables →
   `GEMINI_API_KEY` (scope: **Production**). Asla `VITE_` önekiyle girme.
3. **Doğrula** (canlı URL açıldığında):
   - `/` ve `/results` açılıyor mu — "This page didn't load" GİTMİŞ olmalı
     (bu görevin asıl kabul kriteri).
   - `/results` — Dynamic Music Map Gemini-zengin mi; Life Feed'de şarkı+not
     ekle → insight tek cümlelik Gemini prose'a yerinde geçiyor mu.
   - Anahtar girilmediyse deterministik çıktı görülür — hata değildir.
4. **Validation Gate** (Vercel sonrası): 5+ gerçek kişiye canlı URL'yi
   göster, geri bildirim topla. Faz 4 kullanıcı onayı olmadan başlamıyor.

Yerelde aynı sonuç: `VERCEL=1 npm run build && npm run check:bundle`.

---

## 4. Olası sonuçlar

**🅐 Canlı URL açılır + sayfalar yüklenir →** SSR çökmesi çözüldü. Gemini
zenginse Validation Gate'e geç.

**🅑 Vercel build'i kırmızı →** Build logunda `[postbuild-vercel-spa]`
hatası aranır (script shell'i doğrulayamazsa kasıtlı exit 1 atar — bu,
bozuk deploy'un önüne geçen kapıdır). Lokal `VERCEL=1 npm run build` ile
yeniden üret.

**🅒 Sayfa açılıyor ama Gemini deterministik →** `GEMINI_API_KEY`
Production scope'ta girilmemiş — Dashboard env + redeploy.

**🅓 `/results` boş kalırsa →** Shell hydrate sorunu: browser console'da
hydration hatası aranır; dehydrated `__root__`-only state client'ta
route match'lerini kendisi yükleyemiyor demektir.

**🅔 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN yeniden
yaz, `checkpoint: [özet] — HANDOFF.md güncellendi` ile push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**Hata sayfasını tanı.** "This page didn't load" bizim
`src/lib/error-page.ts` — dış platform hatası sanıp Vercel'de aramaya
başlama; önce bundle'ı lokal çalıştır:
`import('./.vercel/output/functions/__server.func/index.mjs')` →
`default.fetch(new Request('http://localhost/'))` — çökme mesajı console'a
düşer. **Rolldown döngüsel chunk bug'ı:** nitro SSR bundle'ı statik
döngüsel import'lu chunk'lara bölünürse `var` hoisting undefined üretir;
`inlineDynamicImports: true` ile tek dosya = kesin çözüm. TanStack
`spa.enabled` nitro'yla uyumsuz (preview `dist/server/server.js` bekler) —
shell'i postbuild'de `X-TSS_SHELL` header'ıyla üretmek hem daha genel hem
build'i bozuk shell'e karşı korur.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- `vite.config.ts`'te DEV-ONLY allowedHosts'u commit'leme (satır doc'unda).
- Vercel'e `VITE_GEMINI_API_KEY` `-prefixed` ortam değişkeni girme,
  `GEMINI_API_KEY` yeterli (client bundle asla içinde değil).
- `.vercel/` build çıktısını commit'leme (gitignore'da).
- Önceden var olan prettier drift'ini rastgele kozmetik olarak fix etme.
- `inlineDynamicImports`'u kaldırma — runtime SSR çökmesini geri getirir.
- `scripts/postbuild-vercel-spa.mjs`'teki shell doğrulama kapılarını
  gevşetme — bozuk shell'in Vercel'e çıkmasını engelleyen tek kapı.
