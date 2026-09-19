const ITEMS = [
  "Sign once",
  "Full supply to your wallet",
  "Seal the mint",
  "No private keys held",
  "Standard SPL token",
  "Logo pinned to IPFS",
  "Works with Phantom and Solflare",
];

export default function Marquee() {
  // The list is doubled so the -50% keyframe loops without a visible jump.
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">
        {[0, 1].map((n) => (
          <div key={n} className="flex">
            {row.map((t, i) => (
              <span key={`${n}-${i}`}>{t} &nbsp;/</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
