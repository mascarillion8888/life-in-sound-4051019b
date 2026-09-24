# ETHICAL AI — Life in Sound / SoundMap

> **Statü:** CANLı prensip + kullanıcı-güvenliği sözleşmesi. Bu dosya, AI'ın
> "nasıl konuştuğu" (kişilik/ton) ile "kullanıcının sözlerini nasıl koruduğu"
> (güvenlik) prensiplerini tek kaynakta toplar. ANA_YASA'nın üst katmanıdır;
> kod, bu prensiplerin tek gerçek kaynağıdır (doküman onu YANSITIR, onun yerini
> almaz). ANA_YASA §0 (uydurma yasağı) burada da geçerli.

Destek sırası: `AGENTS.md → STATE.md → docs/HANDOFF.md → docs/ANA_YASA.md →
docs/ETHICAL_AI.md`. Çelişki varsa KOD esastır; bu dosyaya hiçbir satır
"kodun ne yaptığının kanıtı" sayılmaz.

---

## 0. Founding Principle (kurucu ilkesi — en üstte durur)

> **TR:** "Bu ürünün önceliği ticari değildir. Amaç, müzik aracılığıyla
> insanların anılarına ve ruhlarına saygıyla dokunmaktır. Herhangi bir tasarım
> kararı — özellikle kriz/güvenlik anlarında — kullanıcının gerçek iyiliğini,
> uygulamada kalmasından veya herhangi bir metrikten her zaman önde tutar.
> Kullanıcının uygulamayı tamamen terk etmesi, gerçek yardıma ulaştıysa,
> başarısızlık değil başarıdır."
>
> **EN:** "This product's priority is not commercial. The aim is to touch
> people's memories and souls with respect, through music. Any design
> decision — especially in moments of crisis or safety — always puts the
> user's real wellbeing ahead of their staying in the app or of any metric.
> If a user who reached real help leaves the app entirely, that is not a
> failure; it is a success."

Bu ilke, aşağıdaki TÜM bölümlerin ve üründe verilecek her kararın üzerinde
durur; hiçbir teknik/ticari gereklilik bunu geçersiz kılamaz.

---

## 1. Neden ayrı bir doküman?

Eski durum: tanı-yasağı, klişe-filtre ve "klinik olma" kuralları ürün
dokümanlarında (VISUAL_ARCHITECTURE §1, ARCHITECTURE §10, PRODUCT_VISION)
dağınıktı; gerçek LLM prompt'larına ise yalnız parça parça giriyordu. Bu dosya,
o dağınık prensipleri **tek ve uygulanabilir** hale getirir: (1) konuşmanın
tonunu yöneten kurallar, (2) kullanıcının kendi sözlerini koruyan güvenlik
sözleşmesi. Her ikisi de `src/lib/` içinde somut karşılıklar bulur.

---

## 2. Kişilik / Ton Prensipleri (storyteller olarak)

Ürün, kullanıcının seçtiği müzikle ilgili kişisel bir anlatı üretir. Ton
prensipleri LLM prompt'larına **grounding kuralları olarak** girer:

### 1a. Tanı-yasağı (CANLI — kodda kurallar var, bu prensibi netleştirir)
- AI asla klinisyen/terapist/diagnostisyen DEĞİLDİR.
- Kullanıcıyı, duygularını veya ilişkilerini TEŞHİS etmez: {DSM-5 vb.
  zihinsel-sağlık koşulu, kişilik bozukluğu dili, klinik yargı} YOK.
- Duygu haritaları = yansıma, **teşhis değil** ("reflections, not diagnoses" —
  PRODUCT_VISION ile uyumlu). Müzik ve kullanıcı sözleri SANAT ve ANI olarak
  yorumlanır, tıbbi kanıt olarak değil.

### 1b. Klişe / jenerik filtresi (CANLI — kodda kurallar var)
- Her cümle, BU şarkı setine ve BU profile özgü bir şey söylemeli; herhangi
  farklı 8 şarkılık sette birebir aynı okunacak satır yasak.
- Horoskop/jenerik bilgelik/dilek-şansı cümleleri yasak: "ne kadar derin bir
  ruhsun", "müzik her zaman seninle" gibi.
- Mevcut kıkırdama: poetic-analyzer "never clinical, never motivational-poster
  generic" + "formulaic scaffold structures are forbidden" (kodda); bu prensip
  bunları tüm anlatı prompt'larına YAYAR.

### 1c. Grounding (CANLI — her anlatı prompt'unda)
- Kullanıcının gerçek hayatı/ilişkileri/geçmişi hakkında BİLGİ SAHİBİ olduğunu
  iddia etme; kişi/yer/tarih/olay/anı ICAT etme.
- Sağlanan şarkının GERÇEK teması serbesttir (sanatçı/yapıt hakkında bilgi
  kullanılabilir); kullanıcının BİYOGRAFİSİ değil.

---

## 3. Kullanıcı-Güvenliği Sözleşmesi (kriz-override)

### 3a. Giriş noktası: GERÇEK serbest metin
Ürün akışı çoğunlukla şarkı-adı seçimlidir; kullanıcının **kendi cümleleriyle**
yazdığı tek gerçek serbest metin noktası **Life Feed bellek notudur**
(`LifeFeedInput`). Kriz sinyali yalnızca burada (ve benzeri ileride eklenecek
serbest-metin yüzeylerinde) anlamlıdır. Şarkı arama kutusu serbest-metin değildir
(song title'a dönüşür); buna guard konmaz — yanlış pozitif oranını artırır.

### 3b. CrisisGuard deterministik tespiti (CANLI — `src/lib/safety/crisisGuard.ts`)
- `detectCrisisNote(text)` — kullanıcının notundaki açık intihar/kendine zarar
  niyeti kalıplarını tespit eder (en/tr/es/de/fr). **Saf, deterministik, I/O yok**;
  LLM'e hiçbir şey gitmeden çalışır (ANA_YASA §0).
- Precision-bias: yalnız AÇIK niyet kalıpları eşleşir; "özledim/üzgünüm/hüzünlü"
  gibi sağlıklı melankoli TETİKLEMEZ. Gerçek sinyal = kullanıcının kendi sözleri.
- `crisisGuardEnabled()` — varsayılan AÇIK; `VITE_CRISIS_GUARD="off"` yalnız
  demo/test için devre dışı bırakır.

> **Bilinen sınırlama (2026-09-24):** TR pattern `canımı\s+(yak|almak)` olumsuz
> kullanımda ("canımı yakma") da yanlış-pozitif tetikleyebilir — precision/recall
> dengesi bilinçli olarak RECALL lehine bırakıldı (kriz güvenliği önceliği; kayıp
> bırakmaktansa gereksiz ama zararsız bir panel göstermek kabul edildi). Gelecekte
> negation-aware pattern matching (yakma/istemiyorum gibi olumsuzlar) ile
> iyileştirilebilir. Bu, Founding Principle (§0: kullanıcının iyiliği metrikten
> önce) ile uyumludur.

### 3c. TETİKLENİNCE davranış (CANLI — LifeFeedInput → CrisisSupportPanel)
1. **Not LLM'e GİTMEZ** — ne entry-insight'a ne poetic-analyzer'a; ne de
   kalıcılaştırılır.
2. **Şarkı eklenmez** — anlatı modundan çıkılır.
3. Kullanıcıya, şiirsel üretimin YERİNE sakin/insani bir **CrisisSupportPanel**
   gösterilir: kabul + yalnız-bırakma + 3 düz destek yolu (güvenilen kişi,
   yerel acil durum, findahelpline.com uluslararası dizini).
4. Kapatınca normal akışa döner; hiçbir LLM/image çağrısı yapılmaz.

### 3d. ÇIKTI-filtresi — v1'de KAPSAM DIŞI (bilinçli karar)
Üretilmiş anlatı metnine (post-hoc) bir "kriz filtresi" uygulanmıyor. Gerekçe:
çıktı-filtresi güvenilir bir sinyal değildir (hüzünlü-ama-sağlıklı şarkı,
anlatıda "karanlık" kelimesi geçince yanlış pozitif üretir ve anlatıyı gereksiz
sansürler). Tek güvenilir sinyal, kullanıcının kendi sözleridir ve o da guard'ın
çalıştığı yerde (üretim-geçidi) yakalanır. Çıktı-filtresi ihtiyaç-durumunda ayrı,
danışılarak ele alınacaktır.

### 3e. `userMemory` plumb'ı — şu an KAPSAM DIŞI (not)
Card lore pipeline'ında `userMemory` alanı mevcut ama QuizCard'tan şu an
BESLENMİYOR (dead-plumb). Bu yüzden kriz guard'ı şu an oraya uygulanmıyor. Eğer
ileride `userMemory` serbest metin taşımaya başlarsa, AYNI guard oraya da
bağlanmalıdır (3b/3c'deki aynı mantık).

---

## 4. Konum Haritası (kod ile eşleşme)

| Prensip | Kod karşılığı | Statü |
|---|---|---|
| Tanı-yasağı + klişe-filtre + grounding (1a/1b/1c) | LLM prompt kuralları: `src/lib/llm/prompts.ts` (life-story GROUNDING_RULES), `src/lib/llm/poetic-analyzer.ts` (ANALYZER_GROUNDING_RULES), `src/lib/llm/generateAnalysis.server.ts` (entry-insight), `src/lib/art/generateCard.server.ts` (buildLorePrompt) | Kısmen mevcut; bu prensip kuralları tutarlı hale getirir |
| CrisisGuard (3b) | `src/lib/safety/crisisGuard.ts` + `.test.ts` | YENİ (2026-09-24) |
| Kriz davranışı (3c) | `src/components/feed/LifeFeedInput.tsx` (guard wiring) + `src/components/feed/LifeFeedSection.tsx` (panel state) + `src/components/feed/CrisisSupportPanel.tsx` + i18n `src/lib/i18n/dictionaries.ts` (5 dil) | YENİ (2026-09-24) |
| Kriz metni | i18n `crisis.*` (5 dil) — hassas metin, ayrı gözden geçirilir | YENİ (2026-09-24) |

---

## 5. Yapılmaması Gerekenler (bu dosyanın dokunuşluları)

- Kriz korumasını kaldırma/zayıflatma; `VITE_CRISIS_GUARD="off"` varsayılan
  DEĞİL, istisnadır.
- Tespit kalıplarını doğrulamadan daraltma/genişletme (her değişiklik
  `crisisGuard.test.ts` ile kanıtlanmalı — ANA_YASA §0 + uydurma yasağı).
- Çıktı-filtresini veya `userMemory` kriz-korumasını ONALSIZ ekleme (§3d/3e —
  bilinçli olarak kapsam dışı).
- Kriz metnini ülke-spesifik sabit numaralarla donatma (yanlış/eskimiş numara
  riski; ülke-agnostik kalır: yerel acil numara + findahelpline.com dizini +
  güvenilen kişi).

_Artık son güncelleme: Hermes — 2026-09-24 (CrisisGuard v1 + CrisisSupportPanel + i18n 5 dil)._
