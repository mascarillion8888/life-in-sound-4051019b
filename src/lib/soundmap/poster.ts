import { eras } from "@/lib/soundmap/data";

type PickLike = { title: string; artist: string };

/**
 * Renders the SoundMap poster to an offscreen 2000x3000 canvas and triggers a
 * PNG download. Canvas-only (no extra dependency, no DOM rasterization).
 */
export function downloadPoster(picks: Record<number, PickLike>) {
  const W = 2000;
  const H = 3000;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 260, 0, W / 2, 260, 1500);
  glow.addColorStop(0, "rgba(214,168,74,0.22)");
  glow.addColorStop(0.5, "rgba(124,77,196,0.10)");
  glow.addColorStop(1, "rgba(10,10,12,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#9b8cc4";
  ctx.font = "600 46px Inter, sans-serif";
  ctx.fillText("M Ü Z İ K   H A R İ T A S I", W / 2, 300);

  const title = ctx.createLinearGradient(400, 0, 1600, 0);
  title.addColorStop(0, "#d6a84a");
  title.addColorStop(1, "#f3e0b0");
  ctx.fillStyle = title;
  ctx.font = "900 150px Inter, sans-serif";
  ctx.fillText("FRA STÅL", W / 2, 500);
  ctx.fillText("TIL SORG", W / 2, 660);

  ctx.strokeStyle = "rgba(214,168,74,0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(300, 760);
  ctx.lineTo(1700, 760);
  ctx.stroke();

  ctx.textAlign = "left";
  let y = 900;
  eras.forEach((era, i) => {
    const p = picks[era.id];
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(240, y - 70, 1520, 210);
    ctx.fillStyle = "#7c4dc4";
    ctx.font = "700 44px Inter, sans-serif";
    ctx.fillText(String(i + 1).padStart(2, "0"), 290, y);
    ctx.fillStyle = "#9a9aa8";
    ctx.font = "500 38px Inter, sans-serif";
    ctx.fillText(`${era.age} · ${era.phase}`, 400, y);
    ctx.fillStyle = "#f5f5f7";
    ctx.font = "700 60px Inter, sans-serif";
    ctx.fillText(p?.title ?? "—", 400, y + 70);
    ctx.fillStyle = "#d6a84a";
    ctx.font = "500 42px Inter, sans-serif";
    ctx.fillText(p?.artist || "—", 400, y + 128);
    y += 250;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#6b6b78";
  ctx.font = "500 40px Inter, sans-serif";
  ctx.fillText("Zihin • Güç • Karanlık • Kabullenme", W / 2, H - 150);

  const link = document.createElement("a");
  link.download = "soundmap-poster.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
