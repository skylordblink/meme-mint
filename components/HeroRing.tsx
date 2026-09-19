/** Decorative oversized coin edge that turns slowly behind the hero. Pure SVG and CSS. */
export default function HeroRing() {
  const R = 150;
  const text = "STRIKE • SEAL • SIGN • MINT • STRIKE • SEAL • SIGN • MINT • ";
  return (
    <svg
      viewBox="0 0 440 440"
      aria-hidden
      className="pointer-events-none absolute -right-24 top-6 hidden h-[440px] w-[440px] lg:block xl:-right-8"
    >
      <defs>
        <path id="hero-rim" d={`M ${220 - R} 220 a ${R} ${R} 0 1 1 ${R * 2} 0 a ${R} ${R} 0 1 1 ${-R * 2} 0`} />
      </defs>
      <g className="spin-slow" style={{ transformOrigin: "220px 220px" }}>
        <circle cx="220" cy="220" r="205" fill="none" stroke="#14120e" strokeWidth="2.5" />
        <circle cx="220" cy="220" r="196" fill="none" stroke="#14120e" strokeWidth="9" strokeDasharray="3 6" />
        <circle cx="220" cy="220" r="180" fill="none" stroke="#14120e" strokeWidth="1.5" />
        <text fontSize="21" fontWeight="800" letterSpacing="0.16em" fill="#14120e" style={{ fontFamily: "var(--nf-mono), monospace" }} dominantBaseline="middle">
          <textPath href="#hero-rim" textLength={2 * Math.PI * R - 4} lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </g>
      <circle cx="220" cy="220" r="104" fill="#c8f43a" stroke="#14120e" strokeWidth="2.5" />
      <circle cx="220" cy="220" r="90" fill="none" stroke="#14120e" strokeWidth="1.5" strokeDasharray="2 5" />
      <text x="220" y="222" textAnchor="middle" dominantBaseline="central" fontSize="120" fontWeight="800" fill="#14120e" style={{ fontFamily: "var(--nf-display), Georgia, serif" }}>
        $
      </text>
    </svg>
  );
}
