import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { resolveCardVars } from "@/lib/art/cardThemeV3";

export interface PlayerCardProps {
  genre?: string | null;
  mood?: string | null;
  /** Era meta, e.g. "9 YAŞ · İLK KIVILCIM". Kept for tests/a11y, visually hidden. */
  metaLeft: string;
  /** Sequence, e.g. "22/100". Visually hidden (the poster already shows its own counter). */
  sequence: string;
  title: string;
  artist: string;
  lore: string;
  /** 0–10 discovery score. Visually hidden. */
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
  /** Optional override for the life-stage chip (e.g. "Childhood"). Derived from metaLeft when omitted. */
  stageLabel?: string;
  /** Optional Web Audio analyser; when given the waveform follows the real signal. */
  analyser?: AnalyserNode | null;
  "data-testid"?: string;
}

/** Life stage from the age found in metaLeft ("Ages 5–9 · First Spark" -> Childhood). */
function lifeStage(metaLeft: string): string | null {
  const nums = (metaLeft.match(/\d{1,3}/g) ?? []).slice(0, 2).map(Number);
  if (!nums.length) return null;
  const age = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (age <= 12) return "Childhood";
  if (age <= 17) return "Teen years";
  if (age <= 24) return "Youth";
  if (age <= 39) return "Young adult";
  if (age <= 59) return "Adulthood";
  return "Later life";
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Cinzel:wght@600;700&family=Special+Elite&family=Playfair+Display:wght@600;700&family=Poiret+One&family=Righteous&family=Bungee&family=Rajdhani:wght@500;700&display=swap");
.pcw{box-sizing:border-box;width:100%;max-width:440px;display:flex;flex-direction:column;gap:10px}
.pcw *{box-sizing:border-box}
.pc{position:relative;width:100%;padding:var(--frameW);border-radius:34px;background:var(--frameGradient);box-shadow:var(--frameGlow),0 24px 50px rgba(0,0,0,.6),var(--bevel);font-family:var(--body);color:var(--text)}
.pc-in{border-radius:calc(34px - var(--frameW));background:var(--bodyBg);padding:16px 16px 16px;box-shadow:inset 0 0 22px rgba(0,0,0,.45)}
.pc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.pc-cover{position:relative;aspect-ratio:16/11;border-radius:16px;overflow:hidden;border:3px solid var(--coverBorder);filter:var(--coverFilter);box-shadow:0 0 22px rgba(0,0,0,.5);background:linear-gradient(180deg,#3a7fd0 0%,#ff7ab0 55%,#ffb05a 100%)}
.pc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:16px}
.pc-titles{min-width:0}
.pc h2{margin:0;font:600 28px/1.1 var(--display);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-artist{font:500 19px var(--display);color:var(--sub);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-heart{flex:none;width:30px;height:30px;margin-top:4px;color:var(--sub);filter:drop-shadow(0 0 5px currentColor)}
.pc-bar{margin-top:16px;height:5px;border-radius:3px;background:rgba(255,255,255,.18);position:relative}
.pc-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;transition:width .22s linear;background:linear-gradient(90deg,var(--btn1),var(--sub))}
.pc-bar i::after{content:"";position:absolute;right:-6px;top:-4px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 0 8px var(--sub)}
.pc-times{display:flex;justify-content:space-between;font:500 12px var(--display);opacity:.8;margin-top:7px}
.pc-tag{display:flex;justify-content:flex-start;margin:0 0 10px}
.pc-tag span{display:inline-flex;gap:6px;align-items:center;padding:4px 11px;border-radius:999px;border:1px solid var(--sub);background:rgba(0,0,0,.3);color:var(--sub);font:700 11px var(--display);letter-spacing:.12em;text-transform:uppercase;text-shadow:var(--glowTxt)}
.pc-wave{display:flex;align-items:center;justify-content:space-between;height:34px;margin-top:10px}
.pc-wave span{display:block;width:3px;height:34px;border-radius:2px;background:linear-gradient(180deg,var(--btn1),var(--btn2));opacity:.9;transform:scaleY(var(--h));transform-origin:center;will-change:transform}
.pc-wave.on span{animation:pc-bounce var(--t,.8s) ease-in-out var(--d,0s) infinite alternate}
.pc-wave.live span{animation:none}
@keyframes pc-bounce{from{transform:scaleY(var(--h))}to{transform:scaleY(calc(var(--h)*.3 + .6))}}
@media (prefers-reduced-motion:reduce){.pc-wave.on span{animation:none}}
.pc-stats{display:flex;align-items:center;justify-content:space-around;gap:8px;margin-top:12px;padding:8px 6px;border-radius:12px;background:rgba(0,0,0,.28)}
.pc-stat{display:flex;align-items:center;gap:9px;min-width:0}
.pc-stat svg{width:30px;height:30px;flex:none;filter:drop-shadow(0 0 5px currentColor)}
.pc-stat.era svg{color:var(--sub)}
.pc-stat.mood svg{color:#ffd23f}
.pc-stat small{display:block;font:600 9px var(--display);letter-spacing:.14em;color:var(--sub)}
.pc-stat strong{display:block;font:700 22px/1 var(--display);color:#ffc928;text-shadow:0 0 8px rgba(255,190,40,.7);white-space:nowrap}
.pc-sep{width:1px;height:34px;background:var(--line,rgba(255,255,255,.2))}
.pc-deck{display:flex;flex-direction:column;gap:12px;margin-top:14px}
.pc-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;height:56px;border-radius:16px;border:2px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);color:#fff;font:700 18px var(--display);letter-spacing:.04em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 14px color-mix(in srgb,var(--c) 70%,transparent),inset 0 0 14px color-mix(in srgb,var(--c) 35%,transparent);text-shadow:0 0 8px var(--c);transition:transform .12s,box-shadow .12s}
.pc-btn:active:not(:disabled){transform:scale(.98)}
.pc-btn:disabled{opacity:.45;cursor:not-allowed}
.pc-btn svg{width:26px;height:26px;flex:none}
.pc-btn.play{--c:var(--btn1,#ff2fb3)}
.pc-btn.col{--c:var(--btn2,#18f0ff);height:50px;font-size:15px}
.pc-btn.col svg{width:22px;height:22px}
.pc-story{margin:0;padding:12px 14px;border-radius:14px;background:rgba(10,6,30,.82);color:#fff;font:400 14px/1.45 var(--body,inherit);backdrop-filter:blur(6px);max-height:calc(1.45em*3 + 24px);overflow:hidden}
.pc-story span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
@media (max-height:700px){.pc-cover{aspect-ratio:2/1}.pc-in{padding:12px}.pc-head{margin-top:12px}.pc-btn{height:48px}.pc-btn.col{height:44px}}
`;

const PlayIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>);
const PauseIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>);
const PlusIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity=".25" /><path d="M12 7v10M7 12h10" /></svg>);
const CheckIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity=".25" /><path d="M7.5 12.5l3 3 6-7" /></svg>);

const CassetteIcon = () => (<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="26" height="18" rx="3" /><rect x="9" y="12" width="14" height="6" rx="3" /><circle cx="12.5" cy="15" r="1.4" fill="currentColor" /><circle cx="19.5" cy="15" r="1.4" fill="currentColor" /><path d="M9 25l2-4h10l2 4" /></svg>);
const SmileIcon = () => (<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="16" cy="16" r="12.5" fill="currentColor" fillOpacity=".18" /><circle cx="11.5" cy="13" r="1.3" fill="currentColor" /><circle cx="20.5" cy="13" r="1.3" fill="currentColor" /><path d="M9.5 18.5c1.6 3.2 4 4.5 6.5 4.5s4.9-1.3 6.5-4.5" /></svg>);

export function PlayerCard(p: PlayerCardProps) {
  const theme = useMemo(() => resolveCardVars(p.genre ?? null, p.mood ?? null), [p.genre, p.mood]);
    const bars = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const h = 4 + Math.round(28 * Math.pow(Math.abs(Math.sin(i * 0.5) * Math.cos(i * 0.19)), 1.6));
        return { h: h / 34, d: -((i * 37) % 100) / 100, t: 0.55 + ((i * 53) % 40) / 100 };
      }),
    [],
  );
  const waveRef = useRef<HTMLDivElement>(null);
  const live = !!(p.playing && p.analyser);
  useEffect(() => {
    if (!live || !p.analyser || !waveRef.current) return;
    const an = p.analyser;
    const nodes = Array.from(waveRef.current.children) as HTMLElement[];
    const data = new Uint8Array(an.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      an.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor((data.length * 0.7) / nodes.length));
      nodes.forEach((n, i) => {
        const v = data[i * step] / 255;
        n.style.transform = `scaleY(${Math.max(0.12, v)})`;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      nodes.forEach((n) => (n.style.transform = ""));
    };
  }, [live, p.analyser]);
  const stage = p.stageLabel ?? lifeStage(p.metaLeft);
  const pct = p.progress == null ? 0 : Math.max(0, Math.min(1, p.progress)) * 100;
  const score = Math.max(0, Math.min(10, Math.round(p.score)));

  return (
    <div className="pcw" style={theme.vars as CSSProperties}>
      <style>{CSS}</style>
      <article className="pc" data-testid={p["data-testid"]} data-family={theme.family} data-mood={theme.mood}>
        <div className="pc-in">
          {/* Visually hidden: the poster behind the card already shows era + counter. */}
          <div className="pc-sr">
            <span data-testid="card-meta">{p.metaLeft} {p.sequence}</span>
            <span data-testid="card-badge">{score}/10 {p.scoreLabel}</span>
          </div>

          {stage && (
            <div className="pc-tag" data-testid="card-stage"><span>{stage}</span></div>
          )}
          <div className="pc-cover" data-testid="card-cover">{p.coverSlot}</div>

          <div className="pc-head">
            <div className="pc-titles">
              <h2 data-testid="card-title" title={p.title}>{p.title}</h2>
              <div className="pc-artist" data-testid="card-artist">{p.artist}</div>
            </div>
            <svg className="pc-heart" viewBox="0 0 24 24" fill={p.collected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.9-8 10.6-8 10.6z" />
            </svg>
          </div>

          <div className="pc-bar" data-testid="card-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="pc-times"><span>{p.timeLeft ?? "0:00"}</span><span>{p.timeRight ?? "0:30"}</span></div>

          <div ref={waveRef} className={`pc-wave${p.playing ? " on" : ""}${live ? " live" : ""}`} aria-hidden="true">
            {bars.map((b, i) => (
              <span key={i} style={{ "--h": b.h, "--d": `${b.d}s`, "--t": `${b.t}s` } as CSSProperties} />
            ))}
          </div>
          <div className="pc-stats">
            <div className="pc-stat era" data-testid="card-era"><CassetteIcon /><div><small>{p.eraTitle}</small><strong>{p.eraValue}</strong></div></div>
            <div className="pc-sep" />
            <div className="pc-stat mood" data-testid="card-mood"><SmileIcon /><div><small>{p.moodTitle}</small><strong>{p.moodValue}</strong></div></div>
          </div>

          <div className="pc-deck">
            <button type="button" className="pc-btn play" data-testid="card-play" disabled={!p.canPlay} onClick={p.onPlay} aria-label={p.playLabel}>
              {p.playing ? <PauseIcon /> : <PlayIcon />}
              <span>{p.playLabel}</span>
            </button>
            <button type="button" className="pc-btn col" data-testid="card-collect" aria-pressed={!!p.collected} aria-label={p.collectLabel} onClick={p.onCollect}>
              {p.collected ? <CheckIcon /> : <PlusIcon />}
              <span>{p.collectLabel}</span>
            </button>
          </div>
        </div>
      </article>

      <p className="pc-story" data-testid="card-lore"><span>{p.lore}</span></p>
    </div>
  );
}

export default PlayerCard;
