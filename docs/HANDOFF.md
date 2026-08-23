# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**

---

## 1. Doğrulanabilir gerçek (`git` ile kontrol et, bu metne değil)

```
Aktif dal: main
HEAD:      (asla sabit yazılmaz — `git log -1 --oneline` ile doğrula)
Testler:   201/201 geçti — bu oturumda yeniden koşturuldu (14 dosya)
tsc:       temiz (`npm run typecheck` = 0 hata)
Build:     plain = 0 (postbuild no-op); VERCEL=1 = 0 (shell 3503 byte,
           route patch yapıldı)
Lint:      `check:bundle` yeşil — static çıktı sızıntısız
SPA/Static: TAMAM — Vercel deploy altyapısı push edildi; canlı URL
            KULLANICI'DA BEKLEMEDE (§3)
Gemini:    `GEMINI_API_KEY` bu ortamda BOŞ — server-only; `poetic-analyzer`
           testleri 29/29 (canlı ağ yok)
```

Doğrula: `git status && npm test`. Uyuşmuyorsa git'e güven, bildir.

---

## 2. Son biten iş — Vercel SSR çökmesi → SPA/Static (TAM, doğrulandı)

**Kök neden:** `createCsrfMiddleware is not a function` — rolldown/nitro
serverless bundle'ı döngüsel chunk'lara bölüyordu (`_ssr/server-A` ↔
`_ssr/server-B`); her istek modül-init patlıyor → kendi `error-page.ts`
çıktımız.

**Çözüm (üç katman, hepsi commit'li):**
1. `vite.config.ts` — `VERCEL=1` iken `inlineDynamicImports: true` → tek
   dosya, chunk sınırı/döngü yok (cloudflare preset korunur).
2. `scripts/postbuild-vercel-spa.mjs` — build zincirli: bundle'ı import
   edip `X-TSS_SHELL` ile shell render, doğrula, `static/index.html`'e
   yaz; `config.json` route'larını `/_serverFn* → /__server`, fallback →
   `/index.html`. `.vercel/output` yoksa NO-OP.
3. Doğrulama kapıları — status 200 + hata marker yok + `#root`/asset var;
   biri tutmazsa build FAIL.

**Bu oturumda doğrulanan:**
- `npm test` → **201/201 (14 dosya)**
- `npm run typecheck` → **0 hata**
- `VERCEL=1 npm run build` → shell **3503 byte**, route patch OK
- `npm run check:bundle` → static çıktıda GEMINI/GROQ/SUPABASE_SERVICE_ROLE
  **sızmamış** ✅
- `npx vitest run src/lib/llm/poetic-analyzer.test.ts` → **29/29** (JSON
  schema, grounding, fallback)

---

## 3. Şu an açık/bekleyen tek şey — Vercel'e bağlan (kullanıcı adımları)

Deploy altyapısı push edildi; canlı URL kullanıcının Vercel hesabını
bekliyor (repo zaten bağlıysa sadece redeploy yeterli):

1. **Repoyu bağla / redeploy:** Vercel projesi `life-in-sound-4051019b`.
   Build logunda `[postbuild-vercel-spa] Shell written ...` görülmeli.
2. **Anahtarı gir:** Dashboard → Environment Variables → `GEMINI_API_KEY`
   (scope: **Production**). Asla `VITE_` önekiyle değil (client bundle'a
   girmez).
3. **Doğrula** (canlı URL açıldığında):
   - `/` ve `/results` — "This page didn't load" **gitmiş olmalı**.
   - `/results` — Dynamic Music Map Gemini-zengin mi; Life Feed'de insight
     tek cümlelik Gemini prose'a geçiyor mu.
4. **Validation Gate** — 5+ gerçek kişiye canlı URL; Faz 4 kullanıcı onayı
   olmadan başlamıyor.

Yerelde aynı sonuç: `VERCEL=1 npm run build && npm run check:bundle`.

---

## 4. Olası sonuçlar

**🅐 Canlı URL açılır + sayfalar yüklenir →** SSR çökmesi çözüldü. Gemini
zenginse Validation Gate'e geç.

**🅑 Vercel build kırmızı →** Build logunda `[postbuild-vercel-spa]`
hatası aranır (kapı kasıtlı FAIL atar). Lokal `VERCEL=1 npm run build`
ile yeniden üret.

**🅒 Sayfa açılıyor ama Gemini deterministik →** `GEMINI_API_KEY`
Production scope'ta girilmemiş.

**🅓 `/results` boş →** Hydration sorunu: browser console'da hata aranır.

**🅔 Kullanıcı yeni görev verir →** Yap, bitince BU dosyayı TAMAMEN
yeniden yaz, `checkpoint: ... — HANDOFF.md güncellendi` ile push et.

---

## 5. Dikkat — bu oturumda öğrenilen

**Hata sayfasını tanı.** "This page didn't load" bizim
`src/lib/error-page.ts` — dış platform sanma; önce bundle'ı lokal çalıştır:
`import('./.vercel/output/functions/__server.func/index.mjs')` →
`default.fetch(new Request('http://localhost/'))`. **Rolldown döngüsel
chunk bug'ı:** statik döngüsel import'lu chunk'larda `var` hoisting
undefined üretir; `inlineDynamicImports: true` = kesin çözüm. TanStack
`spa.enabled` nitro'yla uyumsuz (preview `dist/server/server.js` bekler) —
shell'i postbuild'de `X-TSS_SHELL` ile üretmek preset-agnostik.

---

## 6. Bu oturumda KESİNLİKLE yapılmaması gerekenler

- Companion/memory/pattern/event/chapter sistemini geri getirme (STATE.md 🚨).
- `vite.config.ts`'te DEV-ONLY allowedHosts'u commit'leme (satır doc'unda).
- Vercel'e `VITE_GEMINI_API_KEY` `-prefixed` env girme (`GEMINI_API_KEY`
  yeterli; client bundle'a asla girmesin).
- `.vercel/` build çıktısını commit'leme (gitignore'da).
- Prettier drift'ini rastgele kozmetik fix etme.
- `inlineDynamicImports`'u kaldırma — SSR çökmesini geri getirir.
- `postbuild-vercel-spa.mjs`'teki shell doğrulama kapılarını gevşetme —
  bozuk shell'in Vercel'e çıkmasını engelleyen tek kapı.
