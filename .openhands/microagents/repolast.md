# OpenHands — SoundMap: Repo-Senkronize Çok Fazlı Otonom Görev

> Kullanım: Bu promptu OpenHands'e verirken `SoundMap_Master_to_Code_Gap_Analysis-last_check.md` dosyasını da repo'ya (örn. `/docs/checkpoints/`) koy ya da context olarak ekle. OpenHands önce bu dokümanı repo'nun GERÇEK anlık durumuyla karşılaştırıp güncelleyecek, sonra P0'dan devam edecek.

```
Sen SoundMap projesinde çalışan otonom bir yazılım mühendisi ajanısın. Elinde bir "Master → Code Gap Analysis" dokümanı var (27 Ağustos 2026 tarihli, referans checkpoint 7747a120). Bu doküman senin BAŞLANGIÇ NOKTAN, ama KÖR KÖR GÜVENME — repo o tarihten beri değişmiş olabilir. İşin üç katmanlı:

KATMAN A: Repo'yu denetleyip dokümanı güncel gerçekliğe göre yeni bir checkpoint olarak kaydet.
KATMAN B: Güncellenmiş duruma göre PROGRESS.md'yi kur/güncelle (P0→P5 fazları).
KATMAN C: Fazları otonom olarak yürüt (sen yokken de devam et, kendi hatalarını düzelt, öğren).

---

## KATMAN A — REPO DENETİMİ VE YENİ CHECKPOINT

1. Repo'nun güncel `HEAD` commit hash'ini ve son commit mesajlarını al (`git log -10 --oneline`). Referans checkpoint (`7747a120`) ile aradaki commit'leri listele.
2. Eski dokümandaki her satırı GERÇEK KOD ÜZERİNDEN yeniden doğrula (varsayımla değil, dosyayı aç/oku/gerekirse çalıştır):
   - 8 soru sistemi hâlâ aynı mı, değişmiş mi?
   - `Song` modeli, iTunes mapping, doğrulama mantığı değişmiş mi?
   - Journey persistence'da `songs` alanı hâlâ duruyor mu?
   - Preview altyapısı (`previewUrl`, audio hook) durumu değişmiş mi?
   - **EN KRİTİK:** Personality/Music DNA scoring hâlâ sadece `answers` üzerinden mi çalışıyor, yoksa `Song[]`'a bağlanmaya başlamış mı? (Bu P0'ın hâlâ geçerli olup olmadığını belirler.)
   - Life Story, Emotional Timeline, Poster, Card Gallery, Supabase migration durumları değişmiş mi?
   - Test sayısı hâlâ 442/442 mi, değişmiş mi? Build/TypeScript temiz mi?
3. Eski dokümandaki 🟢/🟡/🔴 durum tablosunu (bölüm 3) yeniden üret; her satırda "eskiden X idi, şimdi Y" farkını not et.
4. Yeni bir dosya oluştur: `docs/checkpoints/SoundMap_Master_to_Code_Gap_Analysis_v2_<YYYY-MM-DD>.md`
   - Eski dokümanın yapısını koru (aynı bölüm başlıkları).
   - Başına bir "DEĞİŞİKLİK ÖZETİ" bölümü ekle: hangi satırlar değişti, hangi commit'ler arasında, ne bulundu.
   - Durum tablosunu güncelle.
   - Bölüm 8 (Music DNA problemi) ve bölüm 19 (operasyon kararı / P0-P5 sırası) hâlâ geçerliyse aynen koru, geçersizse (örn. P0 kısmen başlamışsa) güncelle.
   - ESKİ DOSYAYI SİLME — o bir tarihi checkpoint, olduğu gibi kalsın. Sadece yeni versiyonu ekle.
5. Bu yeni dokümanı commit'le: `checkpoint: gap analysis v2 — repo ile yeniden senkronize edildi`

## KATMAN B — PROGRESS.md KUR/GÜNCELLE

`PROGRESS.md` dosyasını (yoksa oluştur, varsa oku ve güncelle) şu fazlarla kur — bunlar KATMAN A'nın sonucuna göre başlangıç durumları alır (henüz başlamamışsa "bekliyor", kısmen yapılmışsa "devam ediyor" olarak işaretle, uydurma yapma, kod'dan doğrula):

- [ ] **P0 — Music DNA Engine**: `Song[] → SongFeatures → Music DNA`. Şu an personality scoring `answers`'tan geliyor; hedef, gerçek şarkı verisinden (artist, era, ve güvenilir bir kaynaktan genre) beslenen bir motor kurmak. **Genre uydurulmayacak** — yoksa gerçek bir enrichment kaynağından alınacak veya alan boş bırakılacak.
- [ ] **P1 — Metadata Enrichment**: Genre, era, artist metadata, müzikal özellikler gerçek kaynaklardan (örn. mevcut iTunes verisinin ötesinde bir enrichment API'si) çekilecek. Eksik veri asla uydurulmayacak, "bilinmiyor" olarak işaretlenecek.
- [ ] **P2 — Grounded Life Story**: Girdi `Music DNA + 8 songs + 8 life-stage contexts` olacak (sadece şarkı isimleri + önceden atanmış personality skorları değil). Mevcut deterministic→LLM mimarisi korunacak.
- [ ] **P3 — Emotional Timeline**: Gerçek Music DNA üzerinden yeniden beslenecek.
- [ ] **P4 — Song-specific Visual Scenes**: `Song meaning + user context + Music DNA → fine-art scene`. **DİKKAT:** Bölüm 14'teki kart artwork kontratına (portre yok, tipografik/soyut, insan yüzü yasak, görsele başlık çizme yasak) aykırı hiçbir şey uygulama — bu ayrı bir tasarım kararı, sessizce değiştirilmeyecek.
- [ ] **P5 — Master Poster Güncelleme**: Mevcut güçlü poster sistemi yeni analitik çıktılarla (P0-P4) beslenecek, poster sisteminin kendisi yeniden yazılmayacak.

`PROGRESS.md` formatı (önceki taslaktaki gibi): her fazda durum, geçmiş log (deneme/hata/kök neden/çözüm), öğrenilen dersler.

## KATMAN C — OTONOM FAZ YÜRÜTME

1. KATMAN B'de "bekliyor" ya da "devam ediyor" olan İLK fazdan başla (muhtemelen P0).
2. Her faz için: kabul kriterlerini uygula → gerçekten test et → `PROGRESS.md`'yi güncelle → başarılıysa SORMADAN sıradaki faza geç, başarısızsa aynı faz için en fazla 3 farklı yaklaşım dene, hâlâ olmazsa "BLOKE" yaz ve dur.
3. Bağımlılık sırasına uy: P1, P0'ın çıktısına; P2, P0+P1'e; P3, P2'ye; P4, P0'a; P5, P0-P4'e bağımlı. Bağımlılığı karşılanmamış faza geçme.
4. Her faz sonunda ilgili dosyaları commit'le, commit mesajına faz numarasını yaz (örn. `feat(P0): music DNA engine — artist+era feature extraction`).

## SINIRLAR (bunlar dışında hep otonom ilerle)
- **Branch/main güvenliği (bölüm 20'den):** Daha önce yeni branch oluşturma 403 ile reddedilmişti. Eğer hâlâ engelliyse, main'e zorla yazma — değişiklikleri yerelde/staged tut, raporunda "branch izni yok, değişiklikler commit edilmeye hazır ama push edilmedi" diye belirt ve insana sor. `Tests passed ≠ merge izni` kuralını koru.
- **Genre/metadata uydurma:** P1'de gerçek kaynak yoksa veri alanını boş/"unknown" bırak, asla tahmini/uydurma değer yazma.
- **Kart artwork kontratı (bölüm 14):** P4'te bu kontrata aykırı hiçbir görsel yaklaşım (portre, yüz, görsele metin) uygulama; kontratı değiştirmek istersen bunu ayrı bir karar olarak insana sor, sessizce geçme.
- **Supabase/operasyonel bağımlılıklar (Card Gallery, bölüm 15):** Migration/RLS gibi ortam-bağımlı adımlarda gerçek erişimin yoksa, bunu "operasyonel bağımlılık, insan müdahalesi gerekiyor" olarak işaretle, kodla çözülemeyecek bir şeyi çözmüş gibi gösterme.
- 3 deneme sonrası hâlâ bloke olan fazlarda dur.

Şimdi KATMAN A'dan başla: repo'yu denetle, gerçek durumu çıkar, yeni checkpoint dokümanını oluştur.
```

---

## Bu şablon neden bu şekilde kurgulandı

- **Neden önce repo denetimi (Katman A)?** Elindeki doküman 27 Ağustos'ta donmuş bir görüntü. OpenHands'e direkt "P0'dan başla" dersen, aradan geçen süredeki gelişmeleri (varsa) görmezden gelip ya tekrar iş yapar ya da eski varsayımlarla yanlış yola girer. Önce gerçekliği doğrulamak, "hayali ilerleme" riskini sıfırlıyor.
- **Neden eski dosya silinmiyor, yeni versiyon ekleniyor?** Bu senin "save point" mantığın — her checkpoint bir tarihe/commit'e sabitlenmiş kanıt. Üzerine yazarsan geçmişi kaybedersin; versiyonlayarak hem geçmişi hem güncel durumu koruyorsun.
- **Neden Katman A'nın çıktısı Katman B'yi besliyor, ChatGPT değil?** Çünkü artık "hangi fazdayız" sorusunun cevabı senin/ChatGPT'nin hafızasında değil, repo'nun kendisinde ve `PROGRESS.md`'de yaşıyor — bu tam olarak istediğin "sen orada olmasan da devam eden" yapı.
- **Sınırlar bölümü neden bu kadar spesifik?** Genel şablondaki "riskli işlemde dur" kuralı yeterli değildi — bu projeye özgü üç somut tuzak var (branch 403, genre uydurma riski, kart artwork kontratının sessizce çiğnenmesi). Bunları genel kurala bırakmak yerine açıkça yazdım, çünkü otonom bir ajan "muhtemelen sorun değildir" diye bunların üzerinden atlayabilir.

## Sıradaki adım
Bu promptu OpenHands'e verdikten sonra çıkacak ilk gerçek çıktı Katman A'nın raporu olacak (v2 checkpoint dokümanı). Onu bana/ChatGPT'ye geri getirdiğinde, önceki mesajdaki **MOD 2 (sonuç inceleme)** sürecini bu sefer "P0'a gerçekten başlanabilir mi, yoksa gap analizinde gördüğümüzden farklı bir şey mi çıktı" sorusuna odaklı işletebilirsin.
