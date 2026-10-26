import { useMemo, type ReactNode } from "react";
import { resolveCardVars } from "@/lib/art/cardThemeV3";

export interface PlayerCardProps {
  genre?: string | null;
  mood?: string | null;
  /** Top-left meta, e.g. "9 YAŞ · İLK KIVILCIM". */
  metaLeft: string;
  /** Top-right sequence, e.g. "22/100". */
  sequence: string;
  title: string;
  artist: string;
  lore: string;
  /** 0–10 discovery score. */
  score: number;
  scoreLabel: string;
  eraTitle: string;
  eraValue: string;
  moodTitle: string;
  moodValue: string;
  /** Existing cover/painting markup (img, cross-fade, skeleton). Placeholder if omitted. */
  coverSlot?: ReactNode;
  /** 0–1, or null when there is no preview. */
  progress: number | null;
  timeLeft?: string;
  timeRight?: string;
  canPlay: boolean;
  playing?: boolean;
  onPlay?: () => void;
  playLabel: string;
  collected?: boolean;
  onCollect?: () => void;
  collectLabel: string;
  "data-testid"?: string;
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Cinzel:wght@600;700&family=Special+Elite&family=Playfair+Display:wght@600;700&family=Poiret+One&family=Righteous&family=Bungee&family=Rajdhani:wght@500;700&display=swap");
.pc{box-sizing:border-box;position:relative;width:100%;max-width:400px;padding:var(--frameW);border-radius:34px;background:var(--frameGradient);box-shadow:var(--frameGlow),0 24px 50px rgba(0,0,0,.6),var(--bevel);font-family:var(--body);color:var(--text)}
.pc *{box-sizing:border-box}
.pc-in{border-radius:calc(34px - var(--frameW));background:var(--bodyBg);padding:16px 16px 14px;box-shadow:inset 0 0 22px rgba(0,0,0,.45)}
.pc-meta{display:flex;justify-content:space-between;align-items:center;font:600 12px var(--display);letter-spacing:.14em;color:var(--sub);margin:0 2px 10px}
.pc-meta em{font-style:normal;color:var(--accent);text-shadow:var(--glowTxt)}
.pc-cw{position:relative}
.pc-cover{position:relative;aspect-ratio:1/1;border-radius:16px;overflow:hidden;border:3px solid var(--coverBorder);filter:var(--coverFilter);box-shadow:0 0 22px rgba(0,0,0,.5);background:linear-gradient(180deg,#3a7fd0 0%,#ff7ab0 55%,#ffb05a 100%)}
.pc-badge{position:absolute;right:-8px;bottom:-14px;width:68px;height:68px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--badgeBg);color:#fff;border:2px solid rgba(255,255,255,.85);box-shadow:0 0 16px var(--btn1),0 4px 10px rgba(0,0,0,.5);white-space:nowrap}
.pc-badge b{font:700 21px/1 var(--display)}
.pc-badge small{font:700 8px/1 var(--display);letter-spacing:.16em;margin-top:3px}
.pc h2{margin:20px 0 0;font:600 30px/1.1 var(--display);color:var(--text);overflow-wrap:anywhere}
.pc-artist{font:500 19px var(--display);color:var(--sub);margin-top:2px}
.pc-lore{margin:8px 0 0;font:400 14px/1.4 var(--body);color:var(--text);opacity:.78}
.pc-bar{margin-top:14px;height:5px;border-radius:3px;background:rgba(255,255,255,.18);position:relative}
.pc-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,var(--btn1),var(--sub))}
.pc-bar i::after{content:"";position:absolute;right:-6px;top:-4px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 0 8px var(--sub)}
.pc-times{display:flex;justify-content:space-between;font:500 12px var(--display);opacity:.8;margin-top:7px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.pc-stats{display:flex;align-items:center;justify-content:space-around;padding:10px 0 4px;gap:8px}
.pc-stat{display:flex;align-items:center;gap:9px;min-width:0}
.pc-stat svg{width:34px;height:34px;flex:none;color:var(--sub);filter:drop-shadow(0 0 5px currentColor)}
.pc-stat small{display:block;font:600 10px var(--display);letter-spacing:.14em;color:var(--sub)}
.pc-stat strong{display:block;font:700 22px/1 var(--display);color:var(--accent);text-shadow:var(--glowTxt);overflow-wrap:anywhere}
.pc-sep{width:1px;height:40px;background:var(--line)}
.pc-wave{display:flex;align-items:center;justify-content:center;gap:3px;height:36px;margin:8px 0 14px}
.pc-wave span{width:3px;border-radius:2px;background:linear-gradient(180deg,var(--btn1),var(--btn2));opacity:.9}
.pc-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border-radius:14px;font:700 18px var(--display);letter-spacing:.05em;padding:15px 12px;cursor:pointer;background:transparent;color:#fff}
.pc-btn:disabled{opacity:.4;cursor:not-allowed}
.pc-btn.p{border:2px solid var(--btn1);background:linear-gradient(180deg,color-mix(in srgb,var(--btn1) 35%,transparent),color-mix(in srgb,var(--btn1) 12%,transparent));box-shadow:0 0 14px color-mix(in srgb,var(--btn1) 70%,transparent),inset 0 0 14px color-mix(in srgb,var(--btn1) 30%,transparent)}
.pc-btn.s{margin-top:12px;font-size:16px;padding:13px 12px;border:2px solid var(--btn2);color:var(--btn2);box-shadow:0 0 12px color-mix(in srgb,var(--btn2) 55%,transparent),inset 0 0 12px color-mix(in srgb,var(--btn2) 18%,transparent)}
`;

export function PlayerCard(p: PlayerCardProps) {
  const theme = useMemo(() => resolveCardVars(p.genre ?? null, p.mood ?? null), [p.genre, p.mood]);
  const bars = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) =>
        4 + Math.round(28 * Math.pow(Math.abs(Math.sin(i * 0.5) * Math.cos(i * 0.19)), 1.6)),
      ),
    [],
  );
  const pct = p.progress == null ? 0 : Math.max(0, Math.min(1, p.progress)) * 100;
  const score = Math.max(0, Math.min(10, Math.round(p.score)));

  return (
    <article className="pc" style={theme.vars as React.CSSProperties} data-testid={p["data-testid"]} data-family={theme.family} data-mood={theme.mood}>
      <style>{CSS}</style>
      <div className="pc-in">
        <div className="pc-meta" data-testid="card-meta">
          <span>{p.metaLeft}</span>
          <em>{p.sequence}</em>
        </div>

        <div className="pc-cw">
          <div className="pc-cover" data-testid="card-cover">{p.coverSlot}</div>
          <div className="pc-badge" data-testid="card-badge">
            <b>{score}/10</b>
            <small>{p.scoreLabel}</small>
          </div>
        </div>

        <h2 data-testid="card-title">{p.title}</h2>
        <div className="pc-artist" data-testid="card-artist">{p.artist}</div>
        <p className="pc-lore" data-testid="card-lore">{p.lore}</p>

        <div className="pc-bar" data-testid="card-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="pc-times"><span>{p.timeLeft ?? "0:00"}</span><span>{p.timeRight ?? "0:30"}</span></div>

        <div className="pc-stats">
          <div className="pc-stat" data-testid="card-era">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="40" height="28" rx="4" /><circle cx="16" cy="24" r="4.5" /><circle cx="32" cy="24" r="4.5" /><path d="M16 32h16" /></svg>
            <div><small>{p.eraTitle}</small><strong>{p.eraValue}</strong></div>
          </div>
          <span className="pc-sep" />
          <div className="pc-stat" data-testid="card-mood">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="24" cy="24" r="19" /><circle cx="17" cy="19" r="2.2" fill="currentColor" /><circle cx="31" cy="19" r="2.2" fill="currentColor" /><path d="M14 29c3 7 17 7 20 0" /></svg>
            <div><small>{p.moodTitle}</small><strong>{p.moodValue}</strong></div>
          </div>
        </div>

        <div className="pc-wave" aria-hidden="true">
          {bars.map((h, i) => (<span key={i} style={{ height: h }} />))}
        </div>

        <button type="button" className="pc-btn p" data-testid="card-play" disabled={!p.canPlay} onClick={p.onPlay}>
          {p.playing ? "❚❚" : "▶"} {p.playLabel}
        </button>
        <button type="button" className="pc-btn s" data-testid="card-collect" aria-pressed={!!p.collected} onClick={p.onCollect}>
          {p.collected ? "✓" : "＋"} {p.collectLabel}
        </button>
      </div>
    </article>
  );
}

export default PlayerCard;