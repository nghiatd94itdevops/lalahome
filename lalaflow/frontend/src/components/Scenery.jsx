import { useMemo } from "react";
import { HOME_ART } from "../api.js";

const LEAF_COLOURS = ["#8dbb3e", "#a6c94a", "#6f9e32", "#c9d65a", "#e2b54a", "#d98f3a"];
const BUTTERFLY_COLOURS = ["#f08a24", "#f5c542", "#7fb6f0", "#f29bb8"];

// Leaves and butterflies drifting over a painted panel, like the LalaHome cover.
export function Drift({ leaves = 8, butterflies = 2 }) {
  const items = useMemo(
    () => ({
      leaves: Array.from({ length: leaves }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${-(i * 1.7) % 9}s`,
        duration: `${8 + (i % 4) * 1.6}s`,
        colour: LEAF_COLOURS[i % LEAF_COLOURS.length],
        size: 12 + (i % 3) * 4,
      })),
      butterflies: Array.from({ length: butterflies }, (_, i) => ({
        top: `${18 + i * 34}%`,
        delay: `${-i * 6}s`,
        duration: `${16 + i * 5}s`,
        colour: BUTTERFLY_COLOURS[i % BUTTERFLY_COLOURS.length],
      })),
    }),
    [leaves, butterflies],
  );
  return (
    <div className="drift" aria-hidden="true">
      {items.leaves.map((leaf, i) => (
        <span
          key={`l${i}`}
          className="drift-leaf"
          style={{ left: leaf.left, animationDelay: leaf.delay, animationDuration: leaf.duration }}
        >
          <svg viewBox="0 0 26 14" width={leaf.size * 1.8} height={leaf.size}>
            <path d="M1 7C7 -2 19 -2 25 7C19 16 7 16 1 7Z" fill={leaf.colour} stroke="rgba(70,50,20,.35)" />
            <path d="M3 7H23" stroke="rgba(60,80,20,.45)" fill="none" />
          </svg>
        </span>
      ))}
      {items.butterflies.map((fly, i) => (
        <span
          key={`b${i}`}
          className="drift-butterfly"
          style={{ top: fly.top, animationDelay: fly.delay, animationDuration: fly.duration }}
        >
          <Butterfly colour={fly.colour} />
        </span>
      ))}
    </div>
  );
}

export function Butterfly({ colour = "#f08a24", size = 34 }) {
  return (
    <svg viewBox="-30 -24 60 46" width={size} height={size * 0.78} className="butterfly">
      {[1, -1].map((flip) => (
        <g key={flip} className={flip === 1 ? "wing wing-l" : "wing wing-r"}>
          <g transform={`scale(${flip} 1)`}>
            <path d="M0 0C-14 -20 -32 -16 -28 -2C-26 6 -10 6 0 0Z" fill={colour} stroke="#2b1a10" strokeWidth="2" />
            <path d="M0 0C-12 6 -22 18 -11 20C-4 20 -1 9 0 0Z" fill={colour} stroke="#2b1a10" strokeWidth="2" />
            <circle cx="-22" cy="-8" r="2" fill="#fff" />
          </g>
        </g>
      ))}
      <ellipse rx="2.6" ry="11" fill="#2b1a10" />
    </svg>
  );
}

// A window onto the LalaHome painting; `focus` picks which part of the house to show (CSS background-position).
export function PaintedPanel({ focus = "50% 50%", className = "", children, drift = true }) {
  return (
    <div className={`painted ${className}`} style={{ backgroundImage: `url(${HOME_ART})`, backgroundPosition: focus }}>
      {drift && <Drift />}
      {children}
    </div>
  );
}

export function Sprig() {
  return (
    <svg className="sprig" viewBox="0 0 120 20" aria-hidden="true">
      <path d="M4 10C30 4 60 16 116 10" fill="none" stroke="#6b8f3a" strokeWidth="2" strokeLinecap="round" />
      {[22, 46, 70, 94].map((x, i) => (
        <path
          key={x}
          d={`M${x} ${i % 2 ? 11 : 9}c4 -8 12 -8 14 -4c-4 6 -10 7 -14 4z`}
          fill={i % 2 ? "#8dbb3e" : "#a6c94a"}
          stroke="#4f6f2a"
          strokeWidth="1"
        />
      ))}
      <circle cx="60" cy="10" r="3.5" fill="#ff9db3" stroke="#6b4423" strokeWidth="1" />
    </svg>
  );
}

export function SectionHead({ eyebrow, title, action }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        <Sprig />
      </div>
      {action}
    </div>
  );
}
