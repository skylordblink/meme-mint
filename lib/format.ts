/** Ticker as people write it: one leading $, even if the stored symbol already has one. */
export const tick = (symbol: string) => `$${symbol.replace(/^\$+/, "")}`;

export const shortAddr = (a: string, n = 4) => (a.length > n * 2 + 3 ? `${a.slice(0, n)}...${a.slice(-n)}` : a);

export function formatSupply(raw: string): string {
  const clean = raw.replace(/[,\s_]/g, "");
  if (!/^\d+$/.test(clean)) return raw || "0";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const lamportsToSol = (l: number | bigint) => Number(l) / 1_000_000_000;

export const formatSol = (sol: number) =>
  sol.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 5 });
