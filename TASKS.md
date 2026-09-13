# 📋 TASKS — Görev Kuyruğu

> Öncelik etiketleri (CLAUDE.md §5): **P0** = kritik / engelleyici,
> **P1** = önemli, **P2** = düşük öncelik / iyileştirme.
> Yeni iş üretmeden önce buraya bak; görev kapatma Testing Agent onayıyla olur.

---

## P1 — Önemli (mevcut sprint içinde)

- [x] **mood inference:** `src/lib/ai/moodInference.ts` oluştur — LLM tabanlı,
  deterministik (temp 0), 9 kapalı mood setiyle sınırlı, bilinmeyende null.
  `generateGroundedAnalysis` pipeline'ına entegre et. `musicDnaEngine`'e
  `MIN_MOOD_COVERAGE_FOR_LABEL` gate'i ekle (genre-coverage gate'iyle aynı desen).
  (Kaynak: STATE.md → KARARLAR, 13 Eylül)
  > ✅ Tamamlandı (2026-09-13) — `3a97968` + `eee319d`. Doğrulama: `npm test`
  > 631 passed / 2 skipped, `tsc` 0 hata.

## P2 — İyileştirmeler

- [ ] **MusicUniverseHero görsel zenginliğini geri kazan (placeholder/skeleton ile)** —
  HEAD tarafının istatistik kartları (Key Anthems / Diversity) ve gradient atmosferi,
  uydurma fallback değerleri (`Timeless`, `Eclectic Explorer`, `diversity ?? 100`)
  içerdiği için origin/dev/next tarafı lehine reddedildi (ANA_YASA §0 ihlali).
  Aynı görsel zenginlik, gerçek veri yokken placeholder/skeleton göstererek ayrı
  bir görevde geri kazanılabilir. (Kaynak: STATE.md → NOTLAR, 2026-09-13)

- [ ] **SongUniverseCard'a stage/vibe/temporal-arc context'i gerçek Music DNA timeline
  verisinden (grounded.timeline.nodes) besleme** — index-only versiyon bu context'i
  kaybetti, gerçek veri bağlanınca geri getirilmeli. (Kaynak: STATE.md → NOTLAR, 2026-09-13)