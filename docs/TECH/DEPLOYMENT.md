# Deployment — bilinçli olarak boş (placeholder — karar STATE/KARARLAR'da)

Bu dosya 0-byte olarak izleniyor. İçerik bilinçli olarak doldurulmamıştır — sessiz tuzak olmasın diye bu not eklendi.

- **Gerçek deployment (git-ata kanıtıyla netleştirildi, 2026-09-16):** Aktif üretim yolu
  **Vercel** (Node + Nitro react-start runtime). Kanıt: `vercel.json` commit'i `ad93ea5` HEAD'in
  atası; `npm run build` → `vite build && node scripts/postbuild-vercel-spa.mjs` (Vercel SPA,
  Nitro `.vercel/output`); keep-alive cron `/api/keep-alive`.
- **Docker yolu:** Dockerfile/docker-compose yalnızca `remotes/origin/migration/node-docker-v1`
  dalında var (main'e hiç girmedi). STATE.md üst satırındaki "Node+Nitro+Docker" VİZYON'dur;
  main'in gerçeği Vercel'dir. KARAR: `STATE.md → KARARLAR → "Deployment netleştirmesi"`.
- Kanıtlı özet: `docs/TECH/VISUAL_ARCHITECTURE.md` değil — kapsamlı olmayan doğru ev `STATE.md →
  KARARLAR` + bu not. Kod/config (`.env`, `.env.example`, `settings.json`, vercel.json) DEĞİŞMEDİ.

İleride doldurulacak: tam deployment/release runbook'u.

_Tarih: 2026-09-16 (Hermes — DOCUMENTATION-ONLY; kod/config değişmedi.)_