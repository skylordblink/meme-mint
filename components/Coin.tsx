"use client";

import { useId, useRef, type PointerEvent } from "react";

type Props = {
  name: string;
  symbol: string;
  image: string | null;
  struck: boolean;
};

const C = 160; // centre of the 320 x 320 viewBox
const RIM_R = 117; // radius of the lettering path
const CIRC = 2 * Math.PI * RIM_R;

/** The token, drawn as a physical coin. Everything on it comes from the form. */
export default function Coin({ name, symbol, image, struck }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tilt = useRef<HTMLDivElement>(null);

  const nameText = (name.trim() || "Your token name").toUpperCase();
  const symText = (symbol.trim() || "SYMBOL").toUpperCase();

  // Repeat "NAME • SYMBOL • " until the rim is full, then size the type so it fits without crowding.
  const unit = `${nameText} • ${symText} • `;
  let rim = unit;
  while (rim.length < 40) rim += unit;
  const fontSize = Math.min(17, CIRC / (rim.length * 0.7));

  // Until a symbol is typed the face shows a neutral mark instead of the placeholder word.
  const face = symbol.trim() ? symText.slice(0, 4) : "$";
  const faceSize = face.length <= 2 ? 80 : face.length === 3 ? 56 : 44;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = tilt.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 16).toFixed(1)}deg`);
    el.style.setProperty("--ry", `${(x * 16).toFixed(1)}deg`);
  }

  function onLeave() {
    tilt.current?.style.setProperty("--rx", "0deg");
    tilt.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <div className="coin-stage mx-auto w-[min(72vw,300px)]" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className={struck ? "coin-struck" : "coin-float"} key={struck ? "struck" : "idle"}>
        <div ref={tilt} className="coin-tilt">
          <svg
            viewBox="0 0 320 320"
            role="img"
            aria-label={`Coin preview for ${name.trim() || "your token"}`}
            className="block h-auto w-full"
            style={{ filter: "drop-shadow(9px 9px 0 var(--lime)) drop-shadow(9px 9px 0 var(--ink))" }}
          >
            <defs>
              <path
                id={`rim-${uid}`}
                d={`M ${C - RIM_R} ${C} a ${RIM_R} ${RIM_R} 0 1 1 ${RIM_R * 2} 0 a ${RIM_R} ${RIM_R} 0 1 1 ${-RIM_R * 2} 0`}
              />
              <clipPath id={`face-${uid}`}>
                <circle cx={C} cy={C} r={86} />
              </clipPath>
              <clipPath id={`body-${uid}`}>
                <circle cx={C} cy={C} r={152} />
              </clipPath>
              <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
                <stop offset="0.45" stopColor="#fff" stopOpacity="0.05" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* body and milled edge */}
            <circle cx={C} cy={C} r={152} fill="#14120e" />
            <circle cx={C} cy={C} r={146} fill="none" stroke="#c8f43a" strokeWidth={8} strokeDasharray="3.2 5" opacity={0.95} />
            <circle cx={C} cy={C} r={135} fill="none" stroke="#ece4cf" strokeWidth={1.5} opacity={0.55} />

            {/* lettering on the rim */}
            <text
              fill="#c8f43a"
              fontSize={fontSize}
              fontWeight={700}
              style={{ fontFamily: "var(--nf-mono), monospace" }}
              dominantBaseline="middle"
            >
              <textPath href={`#rim-${uid}`} textLength={CIRC - 3} lengthAdjust="spacing">
                {rim}
              </textPath>
            </text>

            {/* inner well and face */}
            <circle cx={C} cy={C} r={97} fill="#221f17" stroke="#c8f43a" strokeWidth={2} />
            <circle cx={C} cy={C} r={90} fill="#ece4cf" />
            {image ? (
              <image
                href={image}
                x={C - 86}
                y={C - 86}
                width={172}
                height={172}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#face-${uid})`}
              />
            ) : (
              <text
                x={C}
                y={C}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#14120e"
                fontSize={faceSize}
                fontWeight={800}
                style={{ fontFamily: "var(--nf-display), Georgia, serif" }}
              >
                {face}
              </text>
            )}
            <circle cx={C} cy={C} r={87} fill="none" stroke="#14120e" strokeWidth={3} />

            {/* gloss */}
            <g clipPath={`url(#body-${uid})`}>
              <ellipse cx={112} cy={78} rx={150} ry={64} transform={`rotate(-32 ${C} ${C})`} fill={`url(#gloss-${uid})`} />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
