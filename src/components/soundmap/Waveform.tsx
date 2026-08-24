import { useState } from "react";

import { eras } from "@/lib/soundmap/data";

/** Interactive SVG emotional-journey chart driven by each era's intensity. */
export function Waveform() {
  const [active, setActive] = useState<number | null>(null);
  const w = 800;
  const h = 220;
  const pts = eras.map((e, i) => ({
    era: e,
    x: 40 + (i * (w - 80)) / (eras.length - 1),
    y: h - 30 - e.intensity * (h - 70),
  }));

  const path = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(" ");

  return (
    <div className="rounded-[2rem] border border-border/50 bg-card/50 p-5 backdrop-blur-xl sm:p-8">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-56 w-full"
        role="img"
        aria-label="Duygusal yolculuk grafiği"
      >
        <defs>
          <linearGradient id="sm-line" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--violet)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
          <linearGradient id="sm-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L ${pts[pts.length - 1].x} ${h - 20} L ${pts[0].x} ${h - 20} Z`}
          fill="url(#sm-fill)"
        />
        <path d={path} fill="none" stroke="url(#sm-line)" strokeWidth="3" strokeLinecap="round" />
        {pts.map((p) => (
          <g
            key={p.era.id}
            onMouseEnter={() => setActive(p.era.id)}
            onMouseLeave={() => setActive(null)}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={active === p.era.id ? 9 : 5}
              fill="var(--gold)"
              className="transition-all"
            />
            <circle cx={p.x} cy={p.y} r="18" fill="transparent" />
            <text
              x={p.x}
              y={h - 4}
              textAnchor="middle"
              className="fill-current text-[10px] text-muted-foreground"
            >
              {p.era.phase}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 min-h-6 text-center text-sm text-muted-foreground">
        {active ? eras.find((e) => e.id === active)?.emotion : "Bir noktanın üzerine gel."}
      </p>
    </div>
  );
}
