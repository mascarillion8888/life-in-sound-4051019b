# HANDOFF.md — Şu An Neredeyiz

> **HER ZAMAN ÜZERİNE YAZILIR, ASLA EKLENMEZ.** Anlık durumun TEK doğru
> fotoğrafı — günlük değil. Her AI oturumu ilk iş olarak bunu BAŞTAN SONA
> okur. **TEK kaynak budur.**
>
> Yerel klonunuz `git pull` ile güncellenmemiş olabilir — her oturum
> başında **önce `git fetch` + `git pull origin main`** yapın, sonra
> commit'lere güvenin (bkz. §9).

---

## 1. Doğrulanabilir gerçek

> **Bu bölüm git gerçeğinden derlendi (2026-11-10).** Doğrulama komutları bölüm
> sonunda. Eski (artık geçersiz) tur notları SİLİNMEDİ → **§1a Geçmiş** altında
> kısaltıldı. Kural: **git'e güven, dosyaya değil** (AGENTS.md).

```
Aktif ortam: Freebuff Cloud workspace (Linux checkout) + kullanıcının Windows yereli
Dal:         docs/sync-status-2026-11-10 (bu oturum, docs-only). main = origin/main.
HEAD:        main 375e0a3 — "Merge pull request #24 from mascarillion8888/fix/hide-card-no-replay-fade"
             375e0a3 — Merge PR #24 (gizle→göster'de giriş animasyonu yeniden oynamıyor)
             797a5fe — docs: note the card enter-fade replay fix in HANDOFF §1 (PR #24 gövdesi)
             5e2c947 — fix(card): do not replay enter fade when showing hidden card (PR #24 gövdesi)
             ea59c71 — Merge pull request #20 …/feat/collection-supabase-sync
             810b07e — Merge pull request #22 …/fix/hide-card-poster-and-google-return
             2fd7204 — Merge pull request #21 …/feat/card-opacity-and-wallpaper-toggle
             3354d9b — Merge pull request #19 …/docs/handoff-update
             5791309 — Merge pull request #18 …/feat/google-link-status
             a0c488c — Merge pull request #17 …/feat/card-heart-and-stage-label
             0151dbf — Merge pull request #16 …/chore/lint-debt
             (daha eskisi: #14 ci-ignore-scripts, #13 real-age-from-birth-year, #12 personal-lore, #10 auth-birth-year; #9/#8/#7/#6/#4/#3/#2/#1)
Testler:     main (375e0a3): 87 dosya passed / 1 skipped (88); 943 passed / 2 skipped (945). vitest v4.1.11, `npm test -- --run` exit 0 (2026-11-10 doğrulandı).
tsc:         temiz (`npx tsc --noEmit` = 0 hata, 2026-11-10 doğrulandı).
Lint:        ✅ 0 hata — `npm run lint` exit 0 (2026-11-10 doğrulandı).
Sonar/CI:    ✅ temiz — PR #20/#22/#24'te SonarCloud Code Analysis + CI/verify + Vercel + Vercel Preview Comments tümü başarılı.
Build:       exit 0 (2026-11-10 doğrulandı).
Push:        main = origin/main (375e0a3). Bu oturumun dalı docs/sync-status-2026-11-10 (docs-only).
NOT (2026-11-10, fix/llm-timeouts-no-body-logs): #11 (phase-1/generation-security) BİRLEŞTİRİLMEDİ (Lovable geçmişi;
             rebase/force-push YOK). #11'den yalnız İKİ parça elle taşındı: (a) summarizer (Groq, orchestra.ts) +
             OpenRouter (openrouter.server.ts) çağrılarına varsayılan 20 sn zaman aşımı (AbortController; çağrı başına
             `timeoutMs` ile geçersiz kılınabilir), zaman aşımı mevcut fallback zincirine düşer (OpenRouter → Groq →
             şablon); (b) openrouter.server.ts hata yolları artık yanıt GÖVDESİNİ loglamıyor — yalnız durum kodu
             (`status=…`) ve sabit kod/mesaj; Groq yolunda gövde zaten loglanmıyordu. Kota/authz/cache izolasyonu S2'de.
             Bu dalda: 90 dosya / 954 passed / 2 skipped; tsc 0; eslint 0; prettier temiz; build exit 0.
NOT (2026-11-10, feat/lore-cinematic-style): kart lore'u kılavuzun ("Cinematic Life-Journey Lore Engine") ruhuna
             göre yeniden kuruldu — yeni SAF modül `src/lib/art/loreEngine.ts` (LORE_SYSTEM_PROMPT: formül + SONG FIRST +
             stil + 5 few-shot (TR + sadık EN karşılığı, "anlatım mantığı") + "asla kopyalama" + yasak anlatımlar
             (TR/EN, metnin HER YERİNDE) + "başta yaş yok" + "brief sızdırma yok" + klişe uyarısı + uydurma yasağı +
             5 soruluk son kontrol; `lifePeriodForAge(age)` → dönem + en fazla 3 ipucu kelimesi (8→keşif, 12→keşif,
             13→kimlik, 18→kimlik, 28→sorgulama, 35→hafıza, null→dönem yok); çıktı denetimi: kopya/echo
             (`isCopiedLore`, few-shot + kılavuz örnekleriyle cümle/n-gram benzerliği), brief sızıntısı
             (`hasPromptLeak`, "Age:/Period:/Genre:/Yaş:/Tür:/clues/…"), başta yaş (`hasLeadingAge`), yasak kalıplar,
             40 kelime sınırı). Kılavuzun "ZAYIF/DOĞRU YAKLAŞIM" örnek satırları prompt'tan ÇIKARILDI (kopyalanıyordu).
             Saf pipeline `generateLoreCore(encounter, write)` → yol: provider / tek yeniden yazma / şablon yedeği;
             `generateCard.server.ts` buna delege eder (davranış: OpenRouter → Groq → şablon). Kullanıcı prompt'u artık
             doğal dil ("Anahtar: değer" satırı YOK) + "yalnız lore metni; etiket/başlık/yaş satırı/liste YOK". Ana model
             `OPENROUTER_PRIMARY_MODEL` ile seçilebilir (zaten vardı). `useCardLore.cacheKey`'e stil sürümü
             (`lore-v3`) + dil EKLENDİ. Aşama etiketi eşikleri (lifeStageLabel.ts) ve kart arayüzü DEĞİŞMEDİ.
             `scripts/lore-eval.mjs` GERÇEK hattı çağırır (WORDS/FLAG kullanıcının gördüğü metin), `--model/--lang/
             --songs/--ages`, 1500 ms aralık, 429'da 3 kez artan bekleme (3/6/12 sn), satır-başına PATH, özet; çıktıyı
             `scripts/lore-eval-output.txt`'ye de yazar (gitignored). Bu dalda: 91 dosya / 994 passed / 2 skipped; tsc 0;
             eslint 0; prettier temiz; build exit 0. LLM çıktı KALİTESİ gerçek modelle doğrulanmadı (anahtar yok) —
             yalnız yapısal doğrulama raporlandı.
NOT (2026-11-10, feat/lore-cinematic-style · 3. tur): sağlayıcı yolunun çoğu reddedilip şablona düştüğü için mimari
             değişti — (A) tek çağrıda 3 ADAY istenir ("###" ayraçlı düz metin; JSON da kabul, ayraç yoksa tek metin),
             (B) SERT/YUMUŞAK filtre: SERT (asla seçilmez) = prompt sızıntısı/başlık/iskelet, few-shot kopyası,
             yanlış dil, 40+ kelime, "Bu şarkı/This song" kalıpları; YUMUŞAK (puan düşürür) = klişe kelimeler,
             yaş sayısı/başta yaş, uydurma sahne kelimeleri, 3+ cümle, uzunluk, dil karışması; seçim = sert
             ihlalsizler arasında en az yumuşak ihlal, eşitlikte en kısa. Hiçbiri geçmezse TEK yeniden yazma, o da
             olmazsa şablon. (C) ŞABLON yerelleştirildi: tr/en/es/de/fr (tr = mevcut Türkçe satırlar, davranış sabit;
             satırlar kısa/doğal, uydurma olay-mekân yok; `deterministicLore(encounter, language)`; gösterim adı da
             kod da kabul). (D) `scripts/lore-eval.mjs --verbose` her reddedilen adayı metniyle + hard/soft nedenleriyle
             yazar; normal çıktıda PATH yanında FLAG = "ok" | "reject:<ilk neden>"; çıktı dosyasına da yazar (anahtar
             asla yazılmaz). (E) Gecikme: hâlâ TEK çağrı (3 aday tek yanıtta); zaman aşımı ve OpenRouter→Groq→şablon
             zinciri aynı; maxToken 300→900 (3 adaya yeter). (F) Önbellek stili zaten `lore-v3`. Bu turda: 91 dosya /
             1006 passed / 2 skipped; tsc 0; eslint 0; prettier temiz; build exit 0. Gerçek modelle kalite iddiası YOK —
             mock sağlayıcı ile "3 adaydan 1'i temiz" seçimi, hepsi sert ihlalli → yeniden yazma → şablon düşüşü ve
             dile uygun şablon yapısal testlerle doğrulandı.
NOT (2026-11-10, feat/lore-cinematic-style · 4. tur): `tr` şablonu yanlışlıkla İNGİLİZCE çıkıyordu — kök neden:
             `LIFE_STAGES[].lines` zaten İngilizceydi ve `tr` için yerelleştirilmiş set yoktu (bu yüzden İngilizceye
             düşüyordu). (1) `cardBlueprint.ts`: tr/es/de/fr için GERÇEK yerelleştirilmiş setler (her dilde 8 sahne × 3
             satır + kendi opener/closer'ları); İngilizce satırlar varsayılan (`en` + bilinmeyen dil). tr satırları
             doğal, kısa (1-2 cümle), olay/mekân uydurmuyor ve "Bu şarkı…" kalıbı içermiyor; şarkı adı ve sanatçı
             geçebiliyor. (2) `loreEngine.ts`: `detectLoreLanguage` / `loreLanguageKey` / `languageCheck`
             ("ok" | "WRONG-LANG"); tespitte tırnak içi şarkı adları yok sayılır ve yalnız `ş ğ ı Ş Ğ İ` Türkçe sinyali
             sayılır (ö/ü/ç Almanca/Fransızca'da da var). Yeniden-yazma "kırpma" yedeği de artık `languageCheck`
             geçmeli — yanlış dilde satır ASLA gönderilmez. (3) `scripts/lore-eval.mjs`: FLAG sütunu istenen dille
             uyuşmayan satıra `WRONG-LANG` yazar (reddedilme nedeninden önce). Bu turda: 91 dosya / 1014 passed /
             2 skipped; tsc 0; eslint 0; prettier temiz; build exit 0. Mock sağlayıcı (`OPENROUTER_BASE_URL`) ile
             TR isteğine EN yanıt → `WRONG-LANG` + Türkçe şablona düşüş uçtan uca doğrulandı.
NOT (2026-11-10, feat/lore-cinematic-style · 5. tur): gerçek eval (gemini-2.5-flash, tr) filtre boşlukları
             gösterdi, tümü kapatıldı. (1) Hecelenmiş yaşlar: `LEADING_AGE` + `ageNumberHits` artık tr sayı
             kelimelerini ("yirmi iki yaşında", "kırklı yaşlarında", "otuzlu yaşların") ve en/es/de/fr
             karşılıklarını ("twenty-two years old", "veintidós años", "zwanzig Jahre alt", "vingt-deux ans")
             yakalar. (2) Baştaki "Bu" + ad ("Bu metal marşı / Bu ses", en "This song", es "Esta canción") artık
             SERT ret (`hasLeadingDemonstrative`); metnin ortasında YUMUŞAK (`hasDemonstrativePhrase` →
             soft "demonstrative"). (3) Klişe listesi genişletildi (ruh, ruhu, isyan ateşi, kıvılcım, fısılda,
             çığlık, derinlik, labirent, yankı, ateş, alev, kanat). (4) `detectLoreLanguage`/`languageCheck` artık
             şarkı adını ve sanatçıyı (tırnaklı/tırnaksız) metinden çıkarır — "The Trooper ile" yanlış dil saymaz;
             `generateLoreCore` ve `lore-eval` adları geçirir. (5) Prompt: "Bu/This" ile başlama yasağı + şarkı adı
             VEYA çıkış yılı cümle içinde geçmeli + sayı/hecelenmiş yaş yasak (few-shot DEĞİŞMEDİ). (6) Varsayılan
             model `google/gemini-2.5-flash` (OPENROUTER_PRIMARY_MODEL hâlâ geçersiz kılar; fallback aynı);
             `LORE_STYLE_VERSION` "lore-v4" (eski önbellek yok sayılır). (7) `lore-eval.mjs`: 12 şarkı (pop,
             Turkish rock/arabesk-pop, electronic, hip-hop) + `--genres` süzgeci. Bu turda: 90 dosya / 1021
             passed / 2 skipped; tsc 0; eslint 0; prettier temiz; build exit 0. Gerçek eval ÇALIŞTIRILMADI
             (ortamda OPENROUTER_API_KEY yok) — yalnız yapısal/table-driven testler.
NOT (2026-11-10, feat/lore-cinematic-style · 6. tur): 36 örnekli eval'in kalan boşlukları kapatıldı. (1) SAYI
             yaşları artık her yerde SERT ret: `hasAgeMention` (DIGIT_AGE + SPELLED_AGE) — "10 yaşındaki", "Henüz 10
             yaşındayken", "22 yaşındaydın", "40 yaşında", "at 22", "aged 40". Hecelenmiş yaş da yumuşaktan SERTE
             çıktı (`RejectReason "age"`; eski soft `ageNumber` ve `ageNumberHits` KALDIRILDI). (2) Baştaki işaretçi
             daha güçlü: önce tırnak/noktalama kırpılır (`stripLeadingMarks`) → "Bu, …", "Bu 1984 marşı", '"Bu şarkı"',
             "Şu/O", Dies/Cette yakalanır. (3) Prompt artık kılavuzun ADLARINI vermiyor: dönem ipucu yalnız nötr bir
             MOOD cümlesi (`LifePeriod.mood`); "Never reuse the guide's nouns" + hero/kahraman/destan/epik yasağı.
             (4) Prompt: tek gramer kişisi (sen/-sin; siz/3. şahıs yasak) + `hasMixedPerson` YUMUŞAK filtre (soft
             "person", yalnız tr). (5) Prompt: uydurma yasağı (söz türü/enstrüman) + şarkı adı VEYA çıkış yılı bağlamı.
             (6) `scripts/lore-eval.mjs` başlığı çözülen modeli + kaynağını yazar (`(default)` / `(OPENROUTER_PRIMARY_MODEL)`)
             ve varsayılanı `DEFAULT_OPENROUTER_MODEL`'den import eder (artık tek kaynak). (7) `LORE_STYLE_VERSION`
             "lore-v5". Bu turda: 90 dosya / 1026 passed / 2 skipped; tsc 0; eslint 0; prettier temiz; build exit 0.
             Gerçek eval ÇALIŞTIRILMADI (ortamda OPENROUTER_API_KEY yok) — yalnız table-driven testler (tr/en/es/de/fr).

MERGE DURUMU (kaynak: `gh pr list --state all --limit 30`, 2026-11-10 doğrulandı):
  - MERGED: #24, #22, #21, #20, #19, #18, #17, #16, #14, #13, #12, #10 (+ #9/#8/#7/#6/#4/#3/#2/#1).
  - OPEN:   #23 docs/handoff-collection-synced (docs-only; main ea59c71 tabanlı → ESKİ; CLEAN/MERGEABLE)
            #15 docs/handoff-2026-11-08 (docs-only; eski)
            #11 phase-1/generation-security (kod; eski, açık)
  - DAL:    chore/sonar-maintenance YEREL (push edilmedi, PR YOK). feat/i18n-new-strings YOK (hiç yok).

GÜNCEL DURUM (2026-11-10):
  - ✅ KART "ŞEFFAF/SİLİK" GİDERİLDİ (PR #24, MERGED): EraCardReveal'de giriş animasyonu (`animate-in
    fade-in zoom-in-95 duration-500`) ile `hidden` AYNI elemanda olduğundan "Show card" (display:none→block)
    animasyonu yeniden başlatıyordu (opacity ~0.05→1, ~0.5 sn). Animasyon hiç gizlenmeyen kalıcı sarmalayıcıya
    (`data-testid="era-card-entry"`) taşındı; `hidden` yalnızca iç `era-card-frame`'de. Ölçüm (Playwright+chromium):
    HIDE→SHOW sonrası +50/+140/+350 ms frame+ebeveyn opacity=1 (önce 0.050/0.30/0.92); +239 ms ekran farkı %9.9→%1.6.
  - ✅ HIDE-CARD TOGGLE (PR #21, MERGED): EraCardReveal gerçek `<button>` (data-testid="card-visibility-toggle",
    aria-pressed) kartı `hidden` (display) yapar; kart DOM'da kalır, 30 sn önizleme çalmaya devam eder. Durum: `cardVisible`.
  - ✅ KART GİZLİYKEN POSTER KARARTMALARI KALKAR (PR #22, MERGED): SceneRoom'a `cardHidden` prop'u (varsayılan
    false → kart açıkken görünüm değişmez). true iken iki karartma katmanı — `bg-black/40` scrim
    (data-testid="scene-backdrop-scrim") + `scene-backdrop-fade-*` radyal `rgba(0,0,0,0.55)` — `opacity-0`'a fade
    (500 ms, motion-reduce:transition-none). Ölçüm (Playwright+PIL): +%42.9 ortalama parlaklık (desktop+mobile).
  - ✅ GOOGLE BAĞLAMA DÖNÜŞÜ /journey (PR #22, MERGED): GoogleLinkButton `redirectTo` = `${origin}/journey`
    (eskiden çıplak origin → landing "Start" = `/journey?fresh=true` ilerlemeyi SİLERDİ). Journey restore tek bir
    `resolveJourneyForUser(userId)` üzerinden: uzak (oturum varsa) ?? yerel cache. E-posta/token/kimlik loglanmaz.
  - ✅ GOOGLE BAĞLAMA DURUM METNİ (PR #18, MERGED): GoogleLinkButton artık sessizce GİZLENMİYOR; oturum durumuna
    göre kısa metin gösterir — unavailable → "Account sync is off (no server session)."; anonim-olmayan →
    "Signed in as <email>" / "Already signed in"; anonim → mevcut düğme. Metinler küçük/soluk ve İngilizce SABİT
    (i18n sözlüğüne taşınmadı — 5 dilde aynı blok Sonar duplikasyonunu tetikler).
  - ✅ KALP DÜĞMESİ + ORTALANMIŞ AŞAMA YAZISI (PR #17, MERGED): PlayerCard kalbi gerçek `<button type="button">`
    (aria-pressed, aria-label mevcut `collectLabel`, data-testid="card-heart"); favori `src/lib/collection.ts`
    üzerinden kalıcı (localStorage `soundmap.collection.v1`); `e.stopPropagation()`.
  - ✅ profiles TABLOSU (migration 0004): doğum yılı `profiles.birth_year`; RLS owner-scoped, set_updated_at trigger.
  - ✅ FAVORİLER SUPABASE SENKRONU (PR #20, MERGED): yerel-öncelikli + `collection_entries` aynası (migration 0005,
    RLS owner-scoped). Oturum hazır olunca `useCollectionSync` bir kez `pullAndMerge` (yeni-kazanır, MAX cap);
    kalp toggle tek kaydı upsert/delete eder (fire-and-forget, hatalar yutulur). Supabase yoksa/hatalıysa yalnız yerel.

AÇIK İŞLER (katalog — bilinçli, sıradaki oturum için):
  - PR #23 / #15 / #11 AÇIK: gözden geçir + birleştir (BİRLEŞTİRMEYİ KULLANICI YAPAR). #23 ve #15 docs-only ve
    ESKİ main tabanlı; içerikleri bu HANDOFF tarafından büyük ölçüde ikame edildi — birleştirip kapat ya da kapat.
  - Sonar eski bakım maddeleri: `chore/sonar-maintenance` YEREL dalda 6 commit hazır (Number.parseInt,
    Number.isNaN + reduce seed, floating promise `void`, @import sırası, alert başlığı, MasterPosterModal a11y).
    Kalan: regex backtracking (itunes-mapping / poetic-analyzer / sharePoster). Dal push edilmedi, PR YOK.
  - TR/çok dilli kapsam: sabit İngilizce metinler (GoogleLinkButton durum metinleri, BirthYearPrompt hata metni,
    Hide/Show card, Change birth year) → `src/lib/i18n/dictionaries.ts` (5 dil). `feat/i18n-new-strings` YOK.
  - Faz 4 hizalama: `docs/TECH/DATABASE_PLAN.md` (DRAFT) ile gerçek tabloları (0001-0005) karşılaştır, farkı
    raporla. Migration YAZMA; şema onayı bekle.
  - Beta öncesi riskler: **§5b** (gizlilik/rıza, LLM hız limiti/maliyet, PII loglama, anonim birikim temizliği).
  - (Geçmiş, hâlâ geçerli) 4 eşleşmeyen iTunes etiketi + MusicBrainz genre lisansı askısı — aksiyon yok.
```

Doğrula: `git fetch origin && git pull origin main && npm test -- --run && npx tsc --noEmit && npm run lint`.

---

## 1a. GEÇMİŞ (arşiv — eski tur kayıtları, kısaltıldı)

> Aşağıdaki notlar eski HANDOFF turlarından; tarihsel kayıt olarak KORUNUR.
> Güncel doğru fotoğraf §1'dedir. Silmek yerine buraya çekildi (kayıp yok).

- **2026-11-08 turu (PR #18/#20/#21/#22 hazırlanırken yazılmıştı):** O zaman `main` = 810b07e,
  testler 920/922 (PR #20 dalı 941/943) idi. "PR #20 AÇIK", "migration 0005 henüz uygulanmadı — SQL
  Editor'da çalıştırılmalı", "KART ŞEFFAF işi PR AÇIK (merge edilmedi)" ve "PR #20'yi gözden geçir +
  birleştir" notları ARTIK GEÇERSİZ: PR #20 MERGED (ea59c71), PR #24 MERGED, migration 0005 uygulandı.
- Kalp aria-label'ının ekran okuyucuda büyük harfle duyulabilmesi — küçük erişilebilirlik notu, açık kaldı.
- Eski turların ayrıntılı kayıtları hâlâ §2 (Lint/Format mimari düzeltmesi, 2026-09-25), §2b (5 Genre
  Backdrop Wiring + R&B/Soul kararı, 2026-09-30), §8 (devir kaydı) ve §9'da durur — burada tekrar edilmez.

---

## 1b. ARŞİTEKTÜR KARARI — SİNEMATİK YAŞAM POSTERİ (Karar B) [KARAR VERİLDİ — UYGULANMADI, KULLANICI ONAYI GEREKİR]

**KARAR:** `Dynamic Music Map` / `poeticPoster` altyapısı temel alınarak sinematik yaşam posteri geliştirilecek. Karar VERİLDİ; uygulama ONAYLANMADI (henüz kod/commit yok).

Hedef: yaşam dönemleri + gerçek kullanıcı şarkı/sanatçı/tür/duygu verisini tek bir uzun, sinematik, deterministik kompozisyonda birleştirmek; başlık + bölüm metinleri + semboller + görsel katmanlar + duygusal akışı tek posterde sunmak; uygun boyutta PNG üretmek. Kompozisyon kullanıcının hikâyesine göre deterministik değişir.

Mimari ilkeler (bağlayıcı):
- 207 manuel mood arka planı KORUNUR (yeni asset üretimi yok bu kararla).
- Varsayılan hatta runtime AI görsel üretimi EKLENMEZ (ANA_YASA §9).
- Kullanıcı verisinde olmayan yaş/duygu/olay/şarkı ilişkisi UYDURULMAZ (ANA_YASA §0).
- Lisansı doğrulanmamış grup logosu/albüm görseli varsayılan postere GÖMÜLMEZ; dış albüm kapağı yalnız RUNTIME URL + harmanizasyon (artworkHarmonize) ile, repo'ya gömülmez; yüklenemezse deterministik yer tutucu (♪ / genre motif), asla kırık kutu.
- Mevcut `GeneratedPoster` YALNIZCA bu yeni karar yüzünden silinmez/değiştirilmez (İş 3 hero hâlâ orada).
- Gereksiz ikinci poster motoru OLUŞTURULMAZ — varsa `poeticPoster`/`MasterPoster` halihazırda uzun kompozisyon çiziyor, onu genişlet.

### 1b.1 Mevcut üç poster yüzeyi (inceleme bulgusu, 2026-10-13)
1. `GeneratedPoster` (`src/components/results/GeneratedPoster.tsx`) + `renderPoster` (`src/lib/ai/posterRenderer.ts`): 1400×2000 canvas, tek görünüm — arketip + başlık + mood subheadline (+ İş 3 hero) + 8 şarkı + keywords + "LIFE IN A SOUND". İş 3'ün hero hedefi BUDUR.
2. `MasterPosterSheet` (`src/components/results/MasterPosterSheet.tsx`) + `MasterPosterCanvas`: DOM/CSS "Dynamic Music Map" görsel yüzeyi; 1024×1536 logical, 2048×3072 html-to-image export; header+era badge'leri, early/peak panel, master albüm çerçevesi, 4 portal, emosyonel dalga (SVG), tracklist, mühür.
3. `poeticPoster.ts` (`src/lib/soundmap/poeticPoster.ts`): uzun PNG (2400 geniş × akış; min 3600) canvas — Hayat Ağacı, albüm kapaklı bölüm portalları (drawHarmonizedArtwork), çok renkli duygu çizgisi, yaşam playlist'i, life-card grid'i, kapanış alıntıları; seed-deterministik (mulberry32) + EXTRAS_BY_THEME. **Ana geliştirme ADAYI.**

Not: yukarıdaki tanımlar mevcut inceleme bulgusudur (salt-okunur); kaynak koddan yeniden doğrulanmayan işlev, "kesinleşmiş gerçek" diye sunulmamıştır.

**SONRAKİ ADIM (bir sonraki AI oturumunun İLK işi):** Aşama 0 — salt-okunur teknik inceleme + kullanıcıya sunulacak onay taslağı (bkz. aşağı "SONRAKİ ADIM" bölümü). Uygulama için kullanıcı onayı ŞART; onay olmadan kod/commit/push yok.

---

## 1c. POSTER BOŞ EKRAN BULGUSU (İş 3, teşhis 2026-10-13) — KOD HATASI OLARAK GENİŞLETİLMEZ

Salt-okunur teşhisin sonucu (dosya/satır referanslı):
- `GeneratedPoster` canvas'ı SSR'da boş üretilir; çizim client-side `useEffect` (GeneratedPoster.tsx:19-23) içinde — tasarım gereği (SSR boş çerçeve). `renderPoster` `!ctx` ise erken döner (posterRenderer.ts:140) — gerçek tarayıcıda 2D context her zaman vardır; yalnız jsdom/test ortamında "getContext not implemented" (o yüzden otomatik testler canvas PİKSELİ doğrulayamaz — testler hesaplama/layout doğrular).
- `results.tsx` çağrı zinciri CANLI: results.tsx:827-832 → `posterForRender ? <GeneratedPoster> : <img posterBackdrop fallback>`; profile null (answered===0) OLSA BİLE fallback IMG gelir (boş ekran değil, pipeline.ts:82).
- İş 3 hero (Dilim 1+2) boş poster regresyonu: DOĞRULANMIŞ YOK. Dilim 1 heroLines=0'da legacy koordinatları birebir döndürür (posterRenderer.test.ts:15-30); Dilim 2 hero yalnız gerçek infer-edilmiş MOOD_SET mood'undan (results.tsx:517-520; heroForMood uyumsuzu → null). Grounded async çözülmeden hero=null → legacy geçerli poster.
- GERÇEK ÜRETİMDE kalıcı boşluk güncel tarayıcı ölçümüyle DOĞRULANMADI. Önerilen tek doğrulama: canlı tarayıcıda hidrasyon sonrası `getImageData` + canvas atr (1400×2000) + boundingRect 0.7 + ≥2 zaman ayırmış kararlı örnek + satır profili (Tek nonZeroRatio DELİL DEĞİL — delil demeti). Önceki kapanış (BULGU 1, 2026-09-24): local+prod ikisinde de canvas doluydu, "kalıcı boş" üretilemedi → hidrasyon zamanlaması.
- Bu bulgu "kod hatası kesin olarak yoktur" diye genişletilmez; yeni kanıt yoksa koda dokunulmaz.

---

## 1d. İŞ 3 — CEVAPLARIN POSTER'E AKIŞI: KARARLAR + DİLİM DURUMU (2026-10-12/13, kayıt)

KARARLAR (kullanıcı onaylı; is-3-poster-hero.md kaydı):
- Seçenek C (hybrid additive): poster = mevcut deterministik `profile.poster` + grounded'tan türeyen TEK satırlık hero; grounded yoksa legacy poster değişmez.
- hero = tek cümle; story'den VERBATIM alıntı DEĞİL; asla kullanıcının serbest metnini taşımaz.
- hero GİRDİSİ: kullanıcı metni YOK — yalnız yapısal sinyal (`grounded.dna.musicalIdentity.topMoods[0]`, gerçek infer-edilmiş mood).
- TÜR×mood YOK — yalnız mood bazlı tablo (`HERO_BY_MOOD`, 9 mood), TR + EN.
- ÇIKTI: deterministik tablo lookup; LLM YOK, çıktı-üzeri CrisisGuard GEREKMEZ (deterministik kaynak, uydurma yok). Çıktı-üzeri kriz filtresi (L3) yalnız isteğe bağlı Dilim 3'ün LLM hero'su için gerekir.
- İNDİRME: indirme anında hazır olan hero'lu YA DA hero'suz posteri indirir (N2 — bekletmez, deterministik).
- Dilim 3 (LLM'li hero): İSTEĞE BAĞLI; yalnız AYRI kullanıcı onayıyla (L1/L2/L3 gizlilik zinciri).

DİLİM DURUMU:
- Dilim 1 (21135fe, YEREL): computePosterLayout seam + `PosterModel.hero?` + posterForRender binding. GÖRSEL DEĞİŞİKLİK YOK (hero daima undefined → legacy koordinatlar). Tek başına kural-10 gerektirmez.
- Dilim 2 (c545879, YEREL): `HERO_BY_MOOD` tr|en + `heroForMood` + results wiring. HERO SATIRI EKRANDA GÖRÜNÜYOR → **KURAL-10 GÖZ ONAYI BEKLİYOR**. "TAMAMLANDI" İŞARETLENMEZ; göz onayına kadar push YOK.
- Durum özeti: "göz onayı bekliyor, push yok".

ONAY KONTROL LİSTESİ (kullanıcı ekranda görüp "Arayüz Onaylandı" diyecek):
1. `npm run dev`
2. 8 şarkılık journey (genre'li; grounding mood'u çözer) tamamla — journey.query / `soundmap.journey.v1` seed yeterli
3. `/results` → "Cinematic Poster" bölümü
4. TR ve EN geçişi → hero satırı subheadline ALTINDA görünecek, mood'a uygun cümle olmalı
5. "Download Poster (PNG)" → indirilen PNG'de hero taşmasız yerinde
6. hero'suz durum: grounded yokken / mood "Unclassified" iken hero GÖRÜNMEMELİ (legacy poster)
Onay verilince push'a geçilir; öncesi push YOK (21135fe+c545879+39ab4bd birlikte gider).

AÇIK İŞLER (güncel kısa liste):
- İş 3 Dilim 2 kural-10 göz onayı → onay sonrası push
- İş 3 Dilim 3 (LLM hero) — isteğe bağlı, ayrı onay
- MusicUniverseHero görsel zenginliği skeleton ile geri kazanım (kural-10)
- SongUniverseCard'a gerçek `grounded.timeline.nodes` bağlama
- Kart overlay v2: gerçek `card-templates/*.png` + `CARD_TEMPLATES` eşlemesi (kullanıcı görseli bekliyor)
- POSTER/MUSIC MAP arka plan sistemi (10-15 dominantVibe seti; üretim kullanıcı-el — Hermes toplu üretmez)
- Repo boyutu: `.git` ≈ 147 MB (ölçüldü 2026-10-13) — izleme + gerekirse temizlik kararı (ayrı; push history rewrite YASAK)
- CrisisGuard negation-aware (DÜŞÜK ÖNCELİK) — olumsuzluk farkındalığı: "suicid değil / intihar etmedim" gibi negatif bağlamların yanlış tetiklenmemesi

KULLANICIDAN BEKLENENLER (kararlar):
- Dilim 2 göz onayı ("Arayüz Onaylandı") → İş 3 push
- FAZ 4c palette render kaynağı kararı (bkz. §1 AÇIK İŞLER)
- funk/rnb/gospel override kararı (İSTEĞE BAĞLI)
- MusicBrainz kaynak kararı (İSTEĞE BAĞLI — lisans askıda)

---

## SONRAKİ ADIM (bir sonraki AI oturumunun ilk okuyacağı) — Aşama 0: Salt-okunur teknik inceleme + onay taslağı

> HIZLI ESKİYEN SABİTLER: Başlıkta hash/test sayısı tutma — her oturum başında `git log -1` ile GÜNCEL HEAD'i doğrula; ilgili sabitler (hash, test sayıları, origin/main tipi) yukarıdaki §1 facts bloğundadır ve push edilince eskir.

1. **Doğrula:** `git fetch origin && git log origin/main..HEAD` — beklenen AHEAD 3 (21135fe, c545879, 39ab4bd docs); origin/main=7f71bad; worktree TEMİZ. HEAD dokümandakiyle uyuşmuyorsa git'e güven.
2. **Salt-okunur incele** (dosya değiştirme YOK): `src/lib/soundmap/poeticPoster.ts` (uzun PNG motoru), `src/components/results/MasterPosterSheet.tsx` (DOM yüzeyi) + kullandıkları içerik/tip/yardımcı modüller (`poetic-analyzer.ts` deterministicPoeticAnalysis, `masterPosterContent.ts` RENDER_LABELS, `posterTheme.ts`, `artworkHarmonize.ts`, `lifeCards.ts`, `dynamicThemes.ts`), `results.tsx` bağlantısı (MasterPosterCanvas@results.tsx:708-734), mevcut PNG dışa aktarımı (`html-to-image` MasterPosterCanvas.tsx:34-42 / poeticPoster canvas export), ilgili testler + 207 mood-backdrop varlığı.
3. **5 soruyu yanıtla:** (1) gerçekte hangi üretim+dışa aktarma zinciri çalışıyor; (2) hangi bileşenler yeniden kullanılabilir; (3) veriler hangi tip/fonksiyon üzerinden geliyor (bu teşhis: data = deterministicPoeticAnalysis chapters{ageRange,narrative,mood} + grounded.dna{topGenres,topArtists,topMoods}/timeline.nodes + posterSongs); (4) ilk prototip için en küçük dosya-değişikliği kümesi; (5) testler+kabul kriterleri. **İnceleme raporu KANIT + dosya yolu + satır numarası içersin.**
4. **Onay bekle:** Elde edilen inceleme + tasarım önerisini kullanıcıya sun; Kod/commit/push yalnızca kullanıcı "uygula/onaylandı" dedikten sonra. (Karar B kaydı yukarı §1b.)

---

## 2. Son Biten İş: Lint/Format MİMARİ DÜZELTMESİ (2026-09-25, bu checkpoint)

**NEDEN:** Sağlık raporu 3 dikkat noktası üretmişti: (1) untracked `bun.lock`,
(2) Windows/Linux CRLF ayrışması — Windows klonunda prettier sahte 167 hata
basıyordu, HANDOFF bunu "prettier-off ile doğrula" kuralıyla YÖNETİYORDU (kaçınma,
çözüm değil), (3) 9 lint uyarısı baseline olarak taşınıyordu. Kullanıcı:
"dikkat noktalarını ana mimariye göre düzelt." Mimari ilke: uyarıları bastırmak
değil kök-nedeninden çözmek (DEVELOPMENT_STANDARD "No duplicated code" ruhu).

**NASIL (6 hamle):**
1. **`.prettierrc` + `endOfLine: "auto"`** — prettier artık hem CRLF (Windows
   checkout) hem LF (Linux) kabul eder. Çekirdek çözüm: iki OS'un prettier'i
   artık AYNI kararı veriyor; "prettier-off ile koş" kuralına gerek kalmadı.
2. **48 dosyalık birikmiş prettier drift'i giderildi** — Linux checkout bunu
   netleştirdi: drift CRLF gürültüsü değil, son commit'lerde birikmiş GERÇEK
   format sapmasıydı (EraCardReveal/SceneRoom/QuizCard girintileri, musicDna.ts,
   SceneRoom.test `.style` birleştirme vb.). Yalnız `prettier --check`'in
   işaretlediği dosyalar formatlandı — blanket `prettier --write .` YOK (kural).
3. **`bun.lock` → `.gitignore`** (gerekçe dosyada: yabancı lockfile, npm kanonik).
4. **`eslint.config.js`: shadcn `src/components/ui/**` override** —
   `react-refresh/only-export-components: off`. Gerekçe: vendored shadcn
   primitives elle düzenlenmez (güncelleme = regenerate); fast-refresh uyarısı
   orada mimari sinyal değil, gürültüydü.
5. **İki bilinçli ortak-modül dosyasına dosya-başı gerekçeli disable:**
   `gothicArt.tsx` (galeri skeleton/fallback/hata-dili tek dosyada — bölmek tek
   tüketiciye iki import yolu zorlar), `LanguageContext.tsx` (provider+hook
   context konvansiyonu). Bu ikisi "yanlış birlikte yaşama" DEĞİL, tasarım.
6. **`results.tsx` `songs` memo — content-keyed pattern blok-disable + gerekçe:**
   deps `songsFingerprint` (içerik parmak izi). `answers`/`journey.songs` dep'e
   girseydi referans değişikliği grounded mood pipeline'ını yeniden tetiklerdi —
   ef27814'teki render-driven 8× LLM çağrısı fix'inin koruması. Bu yüzden
   uyarı "düzeltilecek hata" değil, korunan karar; disable gerekçesi kodda.

**Sonuç:** lint 1 error + 9 warning → **0/0**. Canonical doğrulama komutu
basitleşti: `npm run lint` yeterli (prettier-off eki gereksiz). Testler
693/693 — formatlama davranış değiştirmedi. tsc 0.

**Kural-10:** AÇILMADI — görsel üretim/asset/layout değişikliği YOK; yalnız
whitespace/format + lint config + i18n metni değil. Format dokunan bileşenlerde
(QuizCard, EraCardReveal, SceneRoom) aynı attribute'lar korunmuştur.

## 2b. Bu Oturum (2026-09-30): 5 Genre Backdrop Wiring + Reveal/Scene doğrulaması + R&B/Soul kararı

**KAPSAM:** Kullanıcı `src/assets/` altına 5 yeni genre klasörü ekledi — `funk/`,
`hip-hop/`, `jazz/`, `new age/`, `reggae/` — her biri tam 9 mood'lu
`mood-backdrop-<mood>.jpg` setiyle. Bu oturumda bunlar Asset Registry'ye
bağlandı; ayrıca daha önce (HEAD 3fa5ec0'da) tamamlanmış iki değişiklik (reveal
"Era X of 8" başlığının kaldırılması ve SceneRoom keskin katmanının `contain`→
`cover`'a çevrilmesi) tarayıcı koşusuyla birlikte doğrulandı.

**Kod (commit 0d96969, push edildi, no force/rebases):**
1. **`assetRegistry.ts`**
   - `GenreId`'ye `funk` ve `new age` eklendi (hiphop/jazz/reggae zaten vardı).
   - `GENRE_ALIASES`: her yeni genre için aile eşlemesi — funk (`p-funk`), new
     age (`newage`, `new-age`, `ambient`), jazz (`smooth jazz`, `acid jazz`,
     `jazz fusion`, `bebop`, `swing`), reggae (`dancehall`, `ska`, `reggaeton`,
     `roots reggae`). Hibrit `funk/soul` ↔ `soul/funk` **bilinçli olarak soul'da
     kaldı** (mevcut `soul/funk → soul`; eşlenen `funk/soul → soul` da eklendi).
   - `SCENE_ASSET_REGISTRY` 36 → **81 satır** (9 genre × 9 mood, hepsi dönemsiz).
     `assetRef` gerçek on-disk klasör adını kullanır (`hip-hop/mood-backdrop-*.jpg`,
     `new age/mood-backdrop-*.jpg` — boşluk/kısa-çizgi dosya adıyla BİREBİR eşleşmeli).
2. **`visualSpec.test.ts`** — 2 test yeniden yazıldı: `Hip-Hop`/`hiphop` artık
   kayıtlı olduğu için "eşleşmez" iddiaları `grunge` (hâlâ kayıtsız) üzerinden
   kanıtlanıyor; 5 yeni genre için pozitif exact-match case-tablosu + cins
   aliasları eklendi.
3. **45 yeni asset .jpg** (5 folder × 9 mood) eklendi.

**Doğrulama:** typecheck 0; `npm test` 716 passed / 2 skipped, 0 failed;
`npm run build` exit 0 — build 81 mood-backdrop .jpg emisyonluyor (per-mood 9).
Kısa ömürlü probe (sonra kaldırıldı) her yeni genre'nin `assetRef`'inin glob
üzerinden gerçek backdrop URL'sine çözüldüğünü doğruladı; kalıcı coverage
visualSpec.test.ts'te duruyor.

**Kural-10:** Bu oturumun 5-genre eklemesi görsel (genre'ye özel art ortaya
çıkıyor) → **push öncesi tarayıcı göz onayı VERİLDİ** (kullanıcı tek pass'ta
star/Era X yok, cover dolum, 5 genre'yi kontrol etti). `3fa5ec0`'ın reveal/cover
değişimi Kural-10 kapsamındaydı ve bu turda birlikte onaylandı.

**BULGU (2026-09-30, ÇÖZÜM KARARI — kod hatası DEĞİL):** Fat Larry's Band
"Breakin' Out" (sözlükte funk) soul backdrop gösteriyordu. Gerçek neden:
iTunes `primaryGenreName` bu parça/dönem için birebir **`"R&B/Soul"`** döndürüyor
(10 sonucun hepsi; "funk" geçmedi bile). Bu, İLK yeni alias'a veya bu oturumun
funk/soul-hibrit kuralına takılmıyor — uzun süredir var olan `"r&b/soul": "soul"`
(assetRegistry.ts:49) eşlemesine denk geliyor. Hibrit kural burada devreye
GİRMEDİ. Karar: **kabul et** — `R&B/Soul → soul`, iTunes etiketlemesine sadık;
kullanıcı bunu kod hatası değil taksonomi/kürasyon meselesi olarak onayladı.
Sanatçı düzeyi üst-üste binmeler ileride music map işinde manuel ele alınacak,
**GENRE_ALIASES ile değil**. (NOTLAR §9'a da düşüldü.)

### 2a. Geçmiş bağlam (özet — tam kayıt PROJECT_STATUS + commit mesajlarında)
- **FAZ 3 (18 Eyl):** kanonik görsel kontrat `Song{mood,genre,decade}` + deterministik `visualResolver`.
- **FAZ 3.1 (19 Eyl):** exact-match `assetRegistry` (pilot pop×1980s×9; sonra soul 9/9 decade-free) — runtime üretim YOK (§9).
- **FAZ 3.2 (19 Eyl):** SceneRoom çok-eksenli backdrop (`moodBackdropUrl(mood, genre, decade)` 4-kademeli fallback).
- **Kart overlay v1 (22 Eyl):** QuizCard `templateFile` default-null; PNG yok = kapalı.
- **Kriz güvenliği (24 Eyl):** CrisisGuard 5 dil + CrisisSupportPanel + ETHICAL_AI §0 Founding Principle.
- **Ton kuralları (24 Eyl):** tanı-yasağı + anti-cliché 4 prose prompt + mood-inference sistem satırı; ortak promptRules.ts.

---

## 3. Kod Tabanı Özeti & Mevcut Durum

- **Scene/backdrop:** `SceneRoom` tek standard; backdrop `moodBackdropUrl(mood, genre, decade)` (fallback: dec×gen×mood → dec×mood → gen×mood → mood; mood yoksa `dreamy`). Decade `eraThemeForYear` (tek kaynak). **2026-09-30:** görsel katman tek keskin `cover` backdrop (blur letterbox katmanı kaldırıldı — 3fa5ec0); genre'e özel backdrop `SCENE_ASSET_REGISTRY` (81 satır) üzerinden, eşleşmesiz genre'ler `pop` nötr mood-wall'a düşer (uydurmaz, ANA_YASA §0).
- **Asset oranı (2026-09-30, doğrulandı):** tüm `mood-backdrop-*.jpg` setleri (soul/pop/funk/jazz ölçüldü; 9 folder aynı üretimden) **832×1248 = 2:3** (PORTRAIT). Reveal/post er 3:4 (`aspect-[3/4]`) kutuda `cover` ile oynar — cover, boy (2:3) < kutu (3:4) olduğundan YÜKSEKLİK'e ölçekler (dikey doldurma + yan kırpma; başlık metni dikey merkezde korunur, kırpma yataydır, başlık kesilmez). Eski §3 BULGU (soul .png 2:3 vs 3:4 tutarsızlığı) 2026-09-29 restructure'da kaldırılan eski `.png` setine aittir — artık geçerli değil; yeni set uniform 2:3.
- **Visual katman:** `visualSpec.ts` (kontrat), `visualResolver.ts` (deterministik + `resolveExactAsset`), `assetRegistry.ts` (`SCENE_ASSET_REGISTRY`), `visualSpec.test.ts` (20 test).
- **Motorlar:** `musicDnaEngine.ts` (mood-coverage gate), `lifeStoryEngine.ts`, `emotionalTimelineEngine.ts`.
- **Mood veri yolu:** provider→Song(mood null)→şarkı seçimi→`resolveSongMood`→`Song.mood` persist→SceneRoom backdrop.
- **Pipeline:** `pipeline.ts` → `generateGroundedAnalysis` (content-keyed memo + fingerprint). `results.tsx` `songs` memo da content-keyed (bkz. §2-6 — korunan pattern).
- **LLM:** OpenRouter (primary `google/gemini-2.5-flash-lite`, fallback `openrouter/free`; key server-only). Groq summarizer. Artwork: Imagen→Gemini (runtime, §9 geçici istisna).
- **Güvenlik:** `src/lib/safety/crisisGuard.ts` — Life Feed serbest metninde 5 dilde deterministik kriz triyajı; kriz notu LLM'e gitmez, kalıcılaşmaz.
- **Persistence:** `journey-storage.ts` (localStorage) + `journey-remote.ts`/`cards-remote.ts` (Supabase), `cache/supabaseCache.ts` (30s TTL).
- **Lint mimarisi (YENİ):** ham `eslint .` canonical ve 0/0. prettier-ON (endOfLine:auto). `src/components/ui/**` react-refresh override (vendored). İki dosya-başı disable (gothicArt, LanguageContext) + bir blok-disable (results.tsx content-key memo) — hepsi gerekçeli.

---

## 4. Test / Derleme İstatistikleri (2026-09-30 doğrulandı)

- **Vitest:** 70 dosya, 716 passed / 2 skipped, 0 failed (718) — `npm test` exit 0. visualSpec 20/20.
- **TypeScript:** `tsc --noEmit` 0 hata.
- **Lint:** `npm run lint` (ham eslint, prettier-ON) = **0 error, 0 warning**. Prettier check yeşil.
- **Build:** `npm run build` exit 0 (2026-09-30) — 81 mood-backdrop .jpg build'e emisyonlandı.

---

## 5. Açık / Bekleyen İşler

### AÇIK görsel iş (kullanıcı onaylı, asset üretimi kullanıcıda)
1. ~~BUG 2 — eski `mood-backdrop-*.png` seti metinli~~ **ÇÖZÜLDÜ (2026-09-29 restructure, 3fa5ec0):** text-laden eski `.png` seti kaldırıldı; yerini genre klasörlerinde (`pop/punk/rock/soul/funk/hiphop/jazz/new-age/reggae`) metinsiz `mood-backdrop-<mood>.jpg` setleri aldı.
2. ~~Soul 3 dosya oran uyuşmazlığı~~ **ÇÖZÜLDÜ:** yeni `.jpg` seti uniform **832×1248 (2:3)**, oran tutarsızlığı yok (2026-09-30 doğrulandı, §3).
3. **Asset Registry genişlemesi:** ✅ **2026-09-30 — 9 genre kapalı (81 satır, pop/punk/rock/soul/funk/hiphop/jazz/new-age/reggae × 9 mood, hepsi dönemsiz).** Sonraki genişletme 2026-10-10'da 23 genre × 9 mood = 207 satıra taşıdı (derived registry; metal/synth/gothic/grunge da dahil — artık klasörsüz genre kalmadı). Yeni `genre × decade × mood` kombinasyonu ürettikçe manuel kayıt (yalnız onayla; kartezyen matris YOK §10). Yeni exact asset = kural-10 YENİDEN AÇILIR.
4. **Kart overlay v2:** gerçek `card-templates/*.png` yükle + `CARD_TEMPLATES` eşlemesi; aktifleşince kural-10 aç.

### Taksonomi / kürasyon (kod hatası değil)
- **TAXONOMY KARARI (2026-09-30, kabul edildi):** `GENRE_ALIASES` `"R&B/Soul" → soul` (assetRegistry.ts:49) bilinçli/uzun süreli eşlemedir — iTunes'un gerçek `primaryGenreName`'i Fat Larry's Band "Breakin' Out" gibi funk-adjacent parçalar için birebir **"R&B/Soul"** döndürür (iTunes'ta "funk" etiketi YOK). Sanatçı-düzeyi üst-üste binmeler (funk olarak bilinen bir ismin soul gösterilmesi) **kod hatası değil, taksonomi/kürasyon meselesidir**; ileride music map işinde manuel artist-override ile ele alınacak, **GENRE_ALIASES değiştirilerek DEĞİL**. (NOTLAR §9 + §2b.)

### Mimari kararlar (bekleyen)
5. **FAZ 4c — palette kaynağı (KARAR "B" ertelendi):** SceneRoom `sceneThemeFor` kanonik kalıyor; resolver'ın `sceneThemeId`/`palette` çıktısı render'da tüketilmiyor (backdrop/exactAssetRef canlı). İki kaynak farklı sonuç verebilir — bilinen risk. Blast radius: `scenePalettes.ts`, `sceneTheme.ts`, `visualResolver.ts`, `SceneRoom.tsx`, `EraCardReveal.tsx` + 2-3 test.
6. **MUSIC DNA P0 — (a)+(b) ✅ +(c) ✅ TAMAMLANDI (2026-09-26/27, Kural-10 VERİLDİ):** (a) metadata yetersizken dominantVibe dürüst "Unclassified" (eski "Eclectic Explorer"/"Focused Nostalgic" kaldırıldı — ANA_YASA §0, d49b24d); (b) Emotional Timeline node'ları şarkının kendi mood'undan (STAGE_EMOTION_MATRIX yalnız fallback, cac6372); (c) **kullanıcı serbest metni (`contexts`) artık production'da Life Story'e AKIYOR (655ddae, rule-10, onay VERİLDİ)** — results.tsx Life Feed varsa `buildGroundedLifeContexts(grown, lifeFeedMemories(feed))` ile contextText'i taşıyor; yoksa/eski davranışa degrade (şablon). Önce/sonra kanıtı: şablon vs birebir kullanıcı notu (Temp/kural10-beforeafter.txt); CrisisGuard notta yanlış tetiklemedi.
7. **P1 kalıntısı:** çoklu-kaynak genre (MusicBrainz/iTunes tekeli), artist metadata, musical characteristics.
8. **P2 küçük temizlik:** ✅ `posterAlt` EN "Placeholder" metni temizlendi (28ef8ba — accessibility alt, görsel değil). Kaldı: MusicUniverseHero görsel zenginliği skeleton ile geri kazanım (Kural-10); SongUniverseCard'a gerçek `grounded.timeline.nodes`.

### House-keeping
9. **✅ KAPANDI (2026-09-27) — OpenRouter key canlılığı DOĞRULANDI:** gerçek mood-inference çağrısı (canlı kod yolu: callOpenRouter+buildMoodPrompt+parseMoodResponse) primary model `google/gemini-2.5-flash-lite` ile HTTP 200 döndü, mood "Energetic" (Superstition/Stevie Wonder — doğru). Fallback (`openrouter/free`) AYRICA HTTP 200; fallback'e sessiz düşüş YOK. Kanıt: Temp/openrouter-liveness.txt. Eski key `17f9141` history'de — purge = force-push, YASAK (kalır).
10. **KAPANDI (kayıt):** HF runtime (server+client dead-code), STEEL age-range çakışması, intensityLabel, preview metadata sözleşmesi, doküman drift'i, lint borcu (bu turda 0/0), bun.lock (gitignore'da).
11. **✅ KAPANDI (2026-09-26, a18421c) — manuel-şarkı artwork fix'i:** artPatch `searchSongs` query'si title+artist'a genişletildi (itunes-mapping her iki token'ı şart koşuyordu; title-only asla doğrulamıyordu) + artPatch/artStatus 0-bazlı `[i]` keying'e çekildi (1-bazlı `qid` okuyan taraflarla uyuşmuyordu → Purple Rain hep disc, master-frame yanlış kart kapağı) + `posterSongs` master-frame'e artPatch'i taşıyor (fix-1) + journey-yüklenene dek skeleton (fix-2). Tarayıcıda 8/8 kapak + doğru master-frame görüldü, Kural-10 ONAY VERİLDİ. Kod HANDOFF'la aynı checkpoint; kural-10 artık KAPALI.
12. **✅ KAPANDI (2026-09-26, 82c30f8) — SonarCloud "New-Code dup %3.4>%3" gate'i:** kırmızı X'in kaynağı SonarCloud'du (handoff-check zaten success). Per-file New-Code dup = 172 satır: eraThemes.ts 64 + dictionaries.ts 56 (ikisi de FALSE-POSITIVE/structural production — DOKUNMADI), crisisGuard.test.ts 38 + lifeStory.test 9 + poetic-analyzer.test 5 (test). Yalnız **test** tekrarı action edildi: crisisGuard 5-dilli `it(detect...)` iskeleti iki `it.each` tabloya indirildi (aynı 19 pozitif + 9 negatif cümle, davranış değişmedi). 172−38=134 satır → ~%2.62 (<%3). Eski %3.36→~%2.62. Dictionaries/eraThemes in-repo exclusion (sonar-project.properties) ayrı iş — gerek yok (gate geçer).
13. **✅ KAPANDI (2026-10-12, 624b650) — Imagen tier kaldırıldı:** birincil Imagen tier'ı `imagen-3.0-generate-002` (`:predict`) v1beta'da 404 NOT_FOUND döndü (canlı probe doğrulandı: GET model + POST :predict → 404; `gemini-2.5-flash-image` → 200, yalnız `generateContent` destekler) → ölü tier kod + testten kaldırıldı; tek üretici `gemini-2.5-flash-image`. Davranış değişmedi (zincir hep Gemini'ye düşüyordu); test "Gemini sole provider — 429 → null, no fallback" olarak yeniden yazıldı. Kapılar: typecheck 0, lint 0, test 821/2, build 0. (Kota/429 meselesi: Gemini free-tier günlük görsel kotası ayrı bir çalıştırma kısıtı olarak kalır — üretimi bloklamaz, kota sıfırlanınca prodüktif test yeniden denenebilir.)

---

## 5b. BETA ÖNCESİ RİSKLER (salt-okunur inceleme, 2026-11-10 — düzeltme YAPILMADI)

> Kaynak: kod okuması. Yalnız dosya:satır kanıtı; hiçbir şey değiştirilmedi.

1. **Doğum yılı = kişisel veri, rıza/gizlilik metni ve silme akışı YOK.**
   - Toplama: `src/components/auth/BirthYearPrompt.tsx` → `src/lib/supabase/use-profile.ts`
     (localStorage `lis.birthYear`) → `profiles.birth_year` (migration `0004_profiles.sql`).
   - `src/routes/` altında gizlilik/koşullar sayfası YOK (yalnız index/journey/results/soundmap/profile/dev).
   - `src/lib/i18n/dictionaries.ts` içinde "privacy/terms/consent" anahtarı YOK.
   - Hesap silme akışı YOK: `auth.admin`/`deleteUser`/`service_role` istemci tarafında hiç yok
     (grep: yalnız `rls-live.test.ts` içinde service_role *string* sabiti). KVKK/GDPR için rıza + silme gerekir.
2. **LLM uçlarında hız sınırı (rate limit) YOK; yalnız sağlayıcı-tarafı 429 fallback var.**
   - Giriş noktaları `createServerFn` (POST): `generateStory.server.ts:39`, `generateAnalysis.server.ts:111/135`,
     `moodInference.server.ts:104`, `generateCard.server.ts:268`, `cardArtwork.server.ts:409`.
   - Uygulama seviyesinde limiter/throttle yok (grep). Koruma: `openrouter.server.ts:118-127` 429/5xx → `openrouter/free` fallback.
   - Maliyet: yalnız `max_tokens` sınırı (`openrouter.server.ts:77` 2400; story 900; kart 300); toplam bütçe/kota koruması yok.
3. **Zaman aşımı tutarsız.** `generateAnalysis.server.ts:145` ve `moodInference.server.ts:113` → `AbortSignal.timeout(8000)`;
   ancak **`generateStory.server.ts:51` ve `generateCard.server.ts:144` (`runRole`/Groq yolu) signal GEÇMİYOR** →
   yanıt vermeyen sağlayıcıda istek asılı kalabilir (kullanıcı beklemesi; sunucu bağlantı tutma).
4. **Hata log'u sağlayıcı yanıt gövdesini (PII olabilir) yazıyor.** `src/lib/openrouter.server.ts:133-151`
   → `gövde=${result.text.slice(0,200)}` (parse hatası 120). Model çıktısı/echo edilen prompt kullanıcı verisi
   içerebilir. Anahtar loglanmıyor (iyi), ama gövde loglanıyor. Hata izleme (Sentry vb.) entegrasyonu YOK.
5. **RLS tüm tablolarda sahibe kapalı — DOĞRU (olumlu bulgu).** `0001` journeys, `0002` (journeys.songs kolonu —
   satır RLS'i devralır), `0003` cards + storage `card_artworks` (`(storage.foldername(name))[1] = auth.uid()::text`),
   `0004` profiles, `0005` collection_entries — hepsi `auth.uid() = user_id` ve `enable row level security`.
   İstemci yalnız anon key kullanıyor (`src/lib/supabase/client.ts`); service_role istemciye sızmıyor (test doğruluyor).
6. **Anonim kullanıcı birikimi temizliği YOK.** Vercel cron yalnız `/api/keep-alive` (`vercel.json`); anon
   kullanıcı/atık temizleyen bir iş yok. Google bağlama "identity already exists" hatası kullanıcıya genel metin
   olarak dönüyor (`GoogleLinkButton.tsx:57` "Google sign-in is not available right now.") — neden ayırt edilmiyor.

---

## 6. Sıradaki İş Adımları (Next Steps)

1. **Sırada (onayla):** MUSIC DNA P0 — (c) ✅ kapandı (655ddae). Kalan P0: tam analitik çekirdek + kullanıcı cevaplarının poster'e akışı (answers-odaklı `analyzeUserJourney` hâlâ ayrı engine, results'ta canlı; grounding ile birleşmesi ayrı karar).
2. **Kullanıcı işi:** yeni asset kombinasyonları (metal/synth/gothic/grunge klasörleri); music map artist kürasyonu (R&B/Soul→soul sanatçı-özel override'ları).
3. **FAZ 4c palette kanonik-kaynak kararı** (sceneThemeFor vs resolver) — onaylı olursa.
4. **POSTER/MUSIC MAP ARKA PLAN sistemi (büyük açık iş, 2026-09-24 planlı):** textless sahne + CSS metin; runtime üretim YOK; 10-15 dominantVibe kombinasyonu için önceden üretilmiş Asset Registry sahnesi; üretim kullanıcı manuel (Hermes toplu üretmez). Ön koşul: dominantVibe gerçek kategori seti netleşmesi (P0 madde a bunu sağladı). BLOCKLU — kod/asset üretimi başlamadı. ✅ **GÖRSEL-API FİZİBİLİTESİ DENENDİ + VAZGEÇİLDİ (2026-09-27):** gerçek görsel-üretim API'si (openai/gpt-5-image, OpenRouter `/api/v1/images`, aspect_ratio 2:3) ile test edildi — teknik olarak MÜMKÜN ama maliyet (~$0.25/görsel), süre (~45-50sn/görsel) ve tutarsız kalite nedeniyle bu yoldan VAZGEÇİLDİ. Kullanıcı kendi elle üreteceği assetlerle devam ediyor (mevcut mood-backdrop-*.png setinin yükseltilmesi).

---

## 7. Yapılmaması Gerekenler

- **`git add -A` YASAK:** `settings.json` anahtar taşır; `.claude/` + debris süpürülür. Sadece targeted `git add <path>`.
- **Key sızdırma:** `ANTHROPIC_AUTH_TOKEN` / `OPENROUTER_API_KEY` commit'lere/log'a asla; `.env*` gitignore'da.
- **ANA_YASA §0:** Uydurma fallback değerleri YASAK (`Timeless`, `diversity ?? 100`, genre→mood sabit eşleme). Mood bilinmezse null/dreamy.
- **Runtime görsel üretimi ÇOĞALTMA:** registry seçim katmanıdır; yeni runtime AI üretimi EKLEME (§9; kartezyen matris YOK §10).
- **`prettier --write .` / `git add --renormalize` rastgele koşulma** — sadece `--check`'in işaretlediği dosyalar formatlanır (bu turda olduğu gibi).
- **`bun install` koşulma** — npm projesi; ikinci lockfile üretir (artık gitignore'da ama karışıklık).
- **results.tsx content-key memo'ya dep eklemeyin** — LLM çift-çağrısı regresyonu (ef27814); disable gerekçesi kodda.
- Testleri "geçsin diye" zayıflatma.
- **Git commit kimliği:** `mascarillion8888 <67925182+mascarillion8888@users.noreply.github.com>` (repo-local config; `--global` DEĞİL). Farklı kimlik Vercel Hobby deploy'unu bloklar.
- **`git commit --allow-empty` tuzağı:** önce `git diff --cached --name-only` ile index'in boş olduğunu doğrula.
- **handoff-check:** `src/`, `supabase/`, `docs/PRODUCT/`, `orchestra/` değişikliği `docs/HANDOFF.md` olmadan push edilmez.
- **Force-push / history rewrite YASAK** (Lovable bağlantısı + STATE kuralı).

---

## 8. Devir Kaydı (son commit'ler)

```
0d96969  checkpoint: code+assets — 5 new genre backdrop folders wired into scene registry (81 rows, funk/hiphop/jazz/new-age/reggae) + rock/metal genre aliases (Kural-10 VERİLDİ, tarayıcı tek pass — star/Era X, cover, 5 genre)
3fa5ec0  checkpoint: code — scene backdrop 4-genre wiring (36 registry rows, pop/punk/rock/soul genre folders) + single sharp cover layer (no blur/letterbox) + drop reveal era header + rock/metal genre aliases
655ddae  feat(results): Life Feed serbest metnini grounded Life Story / Emotional Timeline'e akıt (P0 c, Kural-10 VERİLDİ 2026-09-27; önce/sonra + CrisisGuard kanıtı)
(82c30f8)  test(security): crisisGuard 5-dil detect iskeletini it.each'e dedupe (SonarCloud New-Code dup %3.4→~%2.6)
(a18421c)  fix(results): manuel-şarkı artwork verification çözüldü + master-frame'e aktarım (Kural-10 VERİLDİ, tarayıcı 8/8)
cac6372  feat(timeline): Emotional Timeline node'ları şarkı mood'undan (stage matrix fallback) + EmotionalNode primaryEmotion/energy
d49b24d  feat(dna): honest "Unclassified" dominantVibe when genre/mood sparse (drop fake "Eclectic Explorer"/"Focused Nostalgic")
fb2f435  checkpoint: docs — Music DNA drift düzeltmesi (ANA_YASA §1/§3/§7, HANDOFF §5, PROJECT_STATUS §5/§7)
(bu commit)  docs(handoff): (a)+(b) merge tamamlandı + Kural-10 onay VERİLDİ (C/D runtime kanıtı) — HANDOFF güncellendi
28ef8ba  fix(i18n): drop stale "Placeholder" from EN posterAlt (accessibility alt, non-visual)
2ddfba9  docs(handoff): sync §1 HEAD→f8467d6, test 693/2, 3-commit özeti, STEEL kapalı, lint temiz
f8467d6  fix(lint): prefer-const palette in visualResolver
3999be2  refactor(ai): dedupe clinician/anti-cliché prompt rules into promptRules.ts
c8760df  docs(handoff): close Bulgu 1 (poster canvas verified local+production)
b2be045  fix(ai): poetic-analyzer chapters inherit ageRange from deterministic fallback
55954b2  feat(ai): tanı-yasağı + anti-cliché rules into 4 prose prompts + tests
9fff09c  docs(handoff): sync §1 HEAD→b44f945 + CrisisGuard/ETHICAL_AI record
b44f945  feat(safety): CrisisGuard (5-language triage) + CrisisSupportPanel + ETHICAL_AI.md
b6429fa  fix(cards): non-overlapping age band (18-22/23-29/30-39/40+)
f1a9705  checkpoint: docs(handoff) §1 sync + PROJECT_STATUS narrative katmanı
9c73281  docs(handoff): kural-10 KAPANDI (soul Test B + card header text)
c9b2a5a  docs(handoff): STEEL age-range overlap notu
37d7348  feat(card): Life Chapter eyebrow + poetic chapter lines
d7045eb  feat(card): optional card-frame template overlay
b5257a1  fix(visual): genre alias normalize (R&B/Soul→soul)
d5c2131  refactor(hf): dead client-side HF service kaldırıldı
12942cb  feat(scene): multi-axis backdrop (mood+genre+decade)
ea84a6e  feat(visual): exact-match asset registry (FAZ 3.1)
2883f9a  feat(visual): deterministic scene visual contract (FAZ 3)
ef27814  fix(mood): dedupe render-driven 8x mood-inference calls
```

---

## 9. Bu Oturumda Öğrenilen Kritik Bilgi

- **CRLF ayrışmasının kök çözümü config'tedir, kuralda değil:** `.prettierrc`
  `endOfLine: "auto"` iki OS'un prettier'ini aynı karara getirir; "prettier-off
  ile koş" kaçınma kuralı artık gereksiz (kaldırıldı). Ayrıca Linux checkout'ta
  görünen "167 hata"nın çoğu CRLF değil, birikmiş GERÇEK format driftiydi —
  doğrulamadan "gürültü" diyerek kapatma.
- **Uyarı üç sınıfa ayrılır:** (a) vendored kod → config override, (b) bilinçli
  pattern → gerekçeli disable kodda, (c) gerçek hata → düzelt. 9 baseline
  uyarısının tamamı (a)/(b) çıktı; hiçbir kural gevşetilmedi.
- **Canonical görsel girdi (LOCKED):** `Song {mood, genre, decade}` bileşimi; eksik eksen deterministik fallback, uydurma YOK (§0); `fallbackTrace` izlenebilirlik.
- **Content-keyed memo koruması:** results `songs` memo dep'i `songsFingerprint` — `answers` dep OLMAMALI (LLM çift-çağrısı regresyonu).
- **Deployment gerçeği:** main aktif = Vercel (Node+Nitro react-start); Docker yalnız migration dalında, main'de YOK.
- **`git add -A` tuzağı:** her zaman targeted add. `.claude/` ve debris dışarıda.
- **GitHub Almanca-intihar kelimesi uyarısı = zararsız yanlış-pozitif (soniccloud paketi):** push sırasında görülen uyarı, crisisGuard.ts:43'teki DE regex'inin (`suizid|selbstmord|...`) committed kodda GitHub'ın kendi içerik-güvenliği taramasına takılmasıdır. ENGEL DEĞİL (reflog'daki başarılı push'lar kanıt; secret-scanning hard-block yalnız byte kalıplarına bakar, kelimeye değil). Repo CI'sı (yalnız handoff-check.yml) ve yerel git hook YOK — uyarı GitHub tarafı kadar server-side üretilir, koddan çözülemez. `// SAFETY:` yorumu susturmaz; kelime fonksiyonel gereklilik. "SonicCloud" ~ "Suizid"'in bozuk okunusu (produktif bir AI kaydı: German suizid → soniccloud). Çözüm: HANDOFF/ETHICAL_AI'da "beklenen koruyucu uyarı" olarak belgelemek. Ayrıntı: docs/PROJECT_STATUS + ETHICAL_AI kriz bölümü.
- **Windows checkout lint farkı:** HANDOFF'un "lint 0/0" iddiası Linux (Freebuff) canonical'ıdır. Bu Windows klonunda `npm run lint` 44 pre-existing prettier/CRLF hata basar (yalnız 2 live-probe script + promptRules.ts). `.prettierrc endOfLine:auto` prettier --check'i düzleştirdi ama eslint prettier plugin'i o 3 dosyada hâlâ `Insert ␍`/satır-son boşluk bildirir. Bunlar açık borç, bu oturumun değişikliğiyle ilgisiz.
- **MUSIC DNA P0 A(a)+(b) tamamlandı + Kural-10 VERİLDİ:** (a) dominantVibe metadata-yoksa dürüst "Unclassified" — "Eclectic Explorer"/"Focused Nostalgic" diversity-etiketleri ANA_YASA §0 gereği kaldırıldı; (b) Emotional Timeline node duygusu şarkının LLM-infer mood'undan (`MOOD_EMOTION_MAP`, 9 mood), stage-matrix yalnız fallback. Runtime kanıtı: C senaryoda 8 node per-node farklı (Dark/Melancholic/Euphoric kontrast net), D'de kırılma yok.
- **"Mood null" regresyonunu canlı koşuda üretmek zor — LLM enstrümantallere de mood atar:** D'de Jarre/Oxygène → "Dreamy", Green Onions → "Energetic" infer edildi (null dönmedi), yani stage-fallback dalı canlıda görsel tetiklenmedi. O dal deterministik birim testiyle kanıtlı (emotionalTimelineEngine.test.ts: mood yoksa "Nostalgic Spark"). Sonuç: null-branch'i doğrulamak için gerçek LLM başarısızlığını zorlamak yerine birim testine güven.
- **Runtime görsel test reçetesi (Kural-10):** journey UI'ı kırılgan (tarayıcı harness encoding/state flakiness) — daha güveniliri `soundmap.journey.v1`'ı şemaya uygun seed'leyip `loadJourney` üzerinden `/results`'ı çalıştırmak: `{current:8, answers:{1..8}, songs:{1..8:Song}}` (Song: provider/providerId/title/artist zorunlu, genre=gerçek) → `generateGroundedAnalysis` her şarkı için mood'u LLM'in yeniden infer eder → header+timeline dökümü. Harness koduna non-ASCII (örn. "·") koyma — stdin'de UnicodeDecodeError.
- **artwork doğrulama title+artist şart (2026-09-26, a18421c):** `itunes-mapping.freeTextMatches` HER query token'inin title∪artist birleşiminde olmasını VE hem title hem artist'ta en az birer token olmasını şart koşar. O yüzden manual-song artPatch query'si title-only olamaz — `searchSongs({query: [title, artist].join(" ")})` gerekir; title-only sorguyla **hiçbir** şarkı doğrulanmaz (canlı kanıt: 7/8 "Album art not found"). Ayrıca bu state küçük bir set/oku ekseni uyumsuzluğuyla da bozulurdu: artPatch/artStatus 1-bazlı yazılıp 0-bazlı okunuyordu → ilk şarkı hep disc, son şarkının frame'i öncekinin kapağını gösteriyordu. Kural: state anahtarıyla okuyucu anahtarı AYNI eksende (hepsi 0-bazlı).
- **P0 (c): "user's own words reach the story" artık GERÇEK (655ddae, Kural-10 VERİLDİ 2026-09-27):** Life Feed notu contextText üzerinden Life Story narrative'ine birebir akıyor. MİMARİ GERÇEK: bu narrative DETERMINISTIK lifeStoryEngine'den gelir (narrative = contextText ?? buildNarrative şablonu) — LLM olan kısım yalnız mood-inference (P0 b). Yani davranış değişikliği tekrar üretilebilir, "sessiz LLM varyasyonu" değil. Kural-10 kanıt yöntemi: `generateGroundedLifeStory`'yi buildGroundedLifeContexts'ın iki varyantıyla çağır (notes'suz=şablon, notes ile=birebir not) — deterministik önce/sonra. Ayrıca yeni veri yolu açıldığı için CrisisGuard `detectCrisisNote(note)`'u her zaman doğrula (not kriz-sinyali içermiyorsa false dönmeli).
- **OpenRouter key canlılık probe'u (2026-09-27):** mood-inference production yolu HTTP 200 + gerçek mood döndü. Probe reçetesi: src/__probe/ altına vitest testi → dotenv ile .env yükle (key'i YAZDIRMA, yalnız len) → global fetch'i sar (her çağrının {model,status} kaydı) → callOpenRouter + buildMoodPrompt + parseMoodResponse ile GERÇEK song (Superstition) → Temp/ raporu → `rm -rf src/__probe`. Sonra unutma: bunu §5 item 9'dan KAPANDI yap.
- **Görsel-API fizibilite testi (2026-09-27) — YOL KAPANDI, kullanıcı kararı:** gerçek görsel üretim API'si (OpenRouter `openai/gpt-5-image`) ile test edildi; SONUÇ: teknik olarak mümkün ama maliyet (~$0.25/görsel), süre (~45-50sn/görsel) ve tutarsız kalite → **kullanıcı VAZGEÇTİ, elle üretecek**. Öğrenilen teknik gerçekler: (1) OpenRouter'da görsel üretimi **`/api/v1/images`** endpoint'idir (chat completions DEĞİL; görsel `data[].b64_json` içinde döner, chat'te `message.images[].image_url.url`); (2) `aspect_ratio` ayrı bir API parametresidir — gpt-5-image provider'ı `1:1`/`3:2`/`2:3`/`auto` subset'ini destekler, **`3:4` REDDEDİLİR (400)**; 2:3 → 1024×1536 doğru dikey portre; (3) modelenın önceki chat-completions ~500ms "süre" ölçümü gerçek değildi — doğru `/api/v1/images` çağrısı 44-48sn sürdü; (4) `/credits` cüzdanı `20` gösteriyor ama görsel üretimi 3. görselde `402 Insufficient credits` ile kesti (sunucudaki gerçek bakiye /credits ekranından farklı olabilir — 402 yetkilidir). Bu yoldan dönersek prodüktif bilgi budur; şu an proje **runtime görsel üretimi EKLEMEZ** (ANA_YASA §9 + kullanıcı kararı).
- **R&B/Soul → soul bilinçli taksonomi kararıdır, kod hatası değil (2026-09-30):** Fat Larry's Band "Breakin' Out" (funk-adjacent) soul backdrop gösterdiğinde bunun nedeninin YENİ alias ya da funk/soul-hibrit kuralı olmadığı, iTunes'un o parça için gerçek `primaryGenreName`'inin birebir **"R&B/Soul"** olması olduğu canlı probe'uyla doğrulandı (10 sonucun hepsi; "funk" kelimesi geçmiyor). Eşleme uzun süredir var olan `"r&b/soul": "soul"` (assetRegistry.ts:49). **Karar: kabul et** — sanatçı-düzeyi funk/soul üst-üste binmeleri kod değil kürasyon meselesi; ileride music map işinde manuel artist-override ile ele alınacak, GENRE_ALIASES ile DEĞİL.
- **Bir şarkının "neden soul görseli aldığını" teşhis ederken provider'ın gerçek genre string'ini probe et — alias tablosundan tahmin etme (2026-09-30):** aynı iTunes endpoint + sorgu şekliyle (`itunes.apple.com/search?term=...&media=music&entity=song`) `primaryGenreName`'i oku; GENRE_ALIASES'ta içinde "funk" geçen her girdiyi değil, gerçek girdinin denk geldiği girdiyi göster. Bu, yanlış "hibrit kuralı çok geniş" hipotezini bir canlı veriyle çürüttü.
- **Asset folder restructure'da {kategori × mood} her yeni kümesi `SCENE_ASSET_REGISTRY`'nin 3 yerini günceller (GenreId union + GENRE_ALIASES + 81-satır registry); glob (`assets/*/mood-backdrop-*.jpg`) dosyaları otomatik görür ama görsel CIKMAZ — satır olmadan her kombinasyon nötr pop wall'a düşer (hata yok, etki yok).** Kural-10 her yeni genre için yeniden açılır (genre'e özel art ortaya çıkar). Aynı `assetRef`'te klasör adı BİREBİR on-disk adı olmalı (`hip-hop/`, `new age/` boşluk/kısa-çizgi korunur). Yeni genre eklerken önce visualSpec.test.ts'teki "eşleşmez" tanığı genre'nin hâlâ kayıtsız olduğunu doğrula (hip-hop→grunge'a taşındı) — kayıtsız bir tanık birden kayıtlı olursa test FLIP eder.

### Teknik Borç (Bu Oturumdan — Gelecek Oturum İçin)
- **Artist-name keyword hardcoding in `SCENE_KEYWORDS`** (Aretha, Marley, Eminem, Tupac, etc.) — **KISMEN ÇÖZÜLDÜ (2026-10-03):** `sceneThemeFor` artık `song.genre`'yi (normalize edilmiş) **ilk öncelikli sinyal** olarak kullanıyor; artist/title/album keyword'leri **yalnızca `song.genre` boş/undefined olduğunda fallback** olarak devreye giriyor. Bu, ana yolun artık "pure-genre" olduğu anlamına geliyor. Kalan risk: `song.genre` hiç gelmeyen edge case'lerde (manuel şarkı girişi, legacy data) artist keyword'leri hâlâ etkilidir — ileride tamamen pure-genre'e taşınabilir.
- **Feat. track genre drift** — iTunes featured artist'ın genre'sını track'e yazıyor (Snoop Dogg feat. track'ler Pop/R&B/Soul/Música Mexicana karıştırıyor). Bu, `primaryGenreName` tek başına yetersiz olduğunun bir göstergesi; ileride multi-source genre (MusicBrainz + iTunes) veya artist-level override ile ele alınmalı.

### ÇÖZÜLDÜ — Vercel production build fail'inin kök nedeni (2026-10-03)
- **KÖK NEDEN:** `@tanstack/react-start@1.168.52` — **CVE-2026-102989 / GHSA-qx66-fv34-fjm8** (unauthenticated reflected XSS in server-function responses). Vercel, vulnerable TanStack sürümünü **bilinçli güvenlik gate'iyle** deploy'u engelliyordu (bug değil). Affected: `>=1.143.12, <1.168.60`; fixed **`1.168.60`** (ayrıca `start-server-core` <1.169.39 vulnerable, fixed **1.169.39**).
- **FIX:** `@tanstack/react-start@^1.168.60`, `react-router@^1.170.41`, `router-plugin@^1.168.42`, `start-server-core@1.169.39` (react-start dependency'si olarak) — commit `78559e1`. Patch-level (1.168.x), breaking change yok.
- **DOĞRULANDI:** Vercel deployment `78559e1` → **`state=success`** (GitHub commit status: `Vercel | success`). Production artık yeni build (`index-CCC8IgBa.js`).
- **Production spot-check (GERÇEK production URL, browser):** Robert Johnson "Sweet Home Chicago" → `scene-room-jazz` ✅; kutu 720×1080 = **2:3** ✅; backdrop `mood-backdrop-nostalgic` (2:3, cover, kırpmasız) ✅; 3 viewport ölçümü: 1920/1106'da `overflowing: []`, 390'da buton 7px (scroll, erişilebilir) ✅.
- **Not:** Kalan `npm audit` high — `brace-expansion` yalnızca **dev** bağımlılıkları (eslint/typescript-eslint), production tree'sinde yok; Vercel gate'ini tetiklemiyor. Ayrı bir iş değil.

---

_Artık son güncelleme: OpenHands (2026-11-10) — §1 "şu an neredeyiz" git gerçeğine göre (main 375e0a3, 943/2 test) TAMAMEN yeniden yazıldı; eski tur notları §1a'ya arşivlendi; §5b (beta öncesi riskler, salt-okunur) eklendi; STATE.md yol haritası (Faz 4/5/6) aynı commit'te güncellendi. Önceki: OpenHands (2026-11-08) — kalp düğmesi + aşama etiketi. Hermes (2026-10-03) — Vercel build fail ÇÖZÜLDÜ (TanStack XSS CVE-2026-102989 → react-start 1.168.60)._
_git repo kökünde yaşar. Sohbet geçmişi değil, bu dosya + git log + STATE.md gerçektir._
