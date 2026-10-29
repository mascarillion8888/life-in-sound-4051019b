import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { resolveCardVars } from "@/lib/art/cardThemeV3";
import type { Spectrum } from "@/lib/soundmap/previewSpectrum";

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
  /** Offline spectrum of the preview; with `getTime` the equalizer follows the real music. */
  spectrum?: Spectrum | null;
  /** Live playback position in seconds. */
  getTime?: () => number;
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
.pc-cover{position:relative;aspect-ratio:1/1;width:min(100%,max(200px,calc(100dvh - 560px)));margin-inline:auto;border-radius:16px;overflow:hidden;border:3px solid var(--coverBorder);filter:var(--coverFilter);box-shadow:0 0 22px rgba(0,0,0,.5);background:linear-gradient(180deg,#3a7fd0 0%,#ff7ab0 55%,#ffb05a 100%)}
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
@property --lv{syntax:"<number>";inherits:false;initial-value:0}
.pc-eq{display:flex;align-items:flex-end;justify-content:space-between;gap:3px;height:48px;margin:12px 0 20px;-webkit-box-reflect:below 1px linear-gradient(transparent 58%,rgba(255,255,255,.26))}
.pc-eq .c{position:relative;flex:1 1 0;height:100%;-webkit-mask-image:repeating-linear-gradient(to top,#000 0,#000 3px,transparent 3px,transparent 4px);mask-image:repeating-linear-gradient(to top,#000 0,#000 3px,transparent 3px,transparent 4px)}
.pc-eq .c i{--lv:var(--h);position:absolute;left:0;right:0;bottom:0;height:calc(var(--lv)*100%);background:linear-gradient(to top,var(--btn2),var(--sub));box-shadow:0 0 8px color-mix(in srgb,var(--btn2) 55%,transparent)}
.pc-eq .c b{position:absolute;left:0;right:0;bottom:calc(var(--pk,0)*4px);height:4px;background:#eafffb;opacity:0}
.pc-eq.on:not(.live) .c i{animation:pc-eq var(--t,.8s) steps(12,end) var(--d,0s) infinite alternate}
@keyframes pc-eq{from{--lv:var(--h)}to{--lv:calc(var(--h)*.3 + .12)}}
@media (prefers-reduced-motion:reduce){.pc-eq.on:not(.live) .c i{animation:none}}
.pc-stats{display:flex;align-items:center;justify-content:space-around;gap:8px;margin-top:0;padding:8px 6px;border-radius:12px;background:rgba(0,0,0,.28)}
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
@media (max-height:700px){.pc-in{padding:12px}.pc-head{margin-top:12px}.pc-btn{height:48px}.pc-btn.col{height:44px}}
`;

const PlayIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>);
const PauseIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>);
const PlusIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity=".25" /><path d="M12 7v10M7 12h10" /></svg>);
const CheckIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity=".25" /><path d="M7.5 12.5l3 3 6-7" /></svg>);

const CassetteIcon = () => (<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="26" height="18" rx="3" /><rect x="9" y="12" width="14" height="6" rx="3" /><circle cx="12.5" cy="15" r="1.4" fill="currentColor" /><circle cx="19.5" cy="15" r="1.4" fill="currentColor" /><path d="M9 25l2-4h10l2 4" /></svg>);
const SmileIcon = () => (<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="16" cy="16" r="12.5" fill="currentColor" fillOpacity=".18" /><circle cx="11.5" cy="13" r="1.3" fill="currentColor" /><circle cx="20.5" cy="13" r="1.3" fill="currentColor" /><path d="M9.5 18.5c1.6 3.2 4 4.5 6.5 4.5s4.9-1.3 6.5-4.5" /></svg>);

const EQ_BARS = 24;
const EQ_SEGS = 12;

export function PlayerCard(p: PlayerCardProps) {
  const theme = useMemo(() => resolveCardVars(p.genre ?? null, p.mood ?? null), [p.genre, p.mood]);
  const eq = useMemo(
    () =>
      Array.from({ length: EQ_BARS }, (_, i) => {
        const h = 0.2 + 0.8 * Math.pow(Math.abs(Math.sin(i * 0.55 + 0.6) * Math.cos(i * 0.21)), 1.3);
        return { h: Math.ceil(h * EQ_SEGS) / EQ_SEGS, d: -((i * 37) % 100) / 100, t: 0.5 + ((i * 53) % 50) / 100 };
      }),
    [],
  );
  const eqRef = useRef<HTMLDivElement>(null);
  const live = !!(p.playing && p.spectrum && p.getTime);
  useEffect(() => {
    if (!live || !p.spectrum || !p.getTime || !eqRef.current) return;
    const sp = p.spectrum;
    const getTime = p.getTime;
    const cols = Array.from(eqRef.current.children) as HTMLElement[];
    const fills = cols.map((c) => c.firstElementChild as HTMLElement);
    const caps = cols.map((c) => c.lastElementChild as HTMLElement);
    const level = new Float32Array(cols.length);
    const peak = new Float32Array(cols.length);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const f = Math.min(sp.frames - 1, Math.max(0, Math.floor(getTime() * sp.fps)));
      for (let i = 0; i < cols.length; i++) {
        const band = Math.min(sp.bands - 1, Math.floor((i * sp.bands) / cols.length));
        const target = sp.data[f * sp.bands + band] / 255;
        level[i] = target > level[i] ? target : Math.max(target, level[i] - dt * 2.4);
        const seg = Math.ceil(level[i] * EQ_SEGS - 1e-6);
        fills[i].style.setProperty("--lv", String(seg / EQ_SEGS));
        peak[i] = Math.max(seg, peak[i] - dt * 9);
        caps[i].style.setProperty("--pk", String(Math.max(0, Math.round(peak[i]) - 1)));
        caps[i].style.opacity = peak[i] > 0.6 ? "0.9" : "0";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fills.forEach((el) => el.style.removeProperty("--lv"));
      caps.forEach((el) => {
        el.style.removeProperty("--pk");
        el.style.opacity = "";
      });
    };
  }, [live, p.spectrum, p.getTime]);
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

          <div ref={eqRef} className={`pc-eq${p.playing ? " on" : ""}${live ? " live" : ""}`} aria-hidden="true">
            {eq.map((b, i) => (
              <span className="c" key={i}>
                <i style={{ "--h": b.h, "--t": `${b.t}s`, "--d": `${b.d}s` } as CSSProperties} />
                <b />
              </span>
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
