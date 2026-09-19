export const U64_MAX = 18_446_744_073_709_551_615n;

export const LIMITS = {
  nameMax: 32,
  symbolMax: 10,
  descriptionMax: 500,
  imageMaxBytes: 1_500_000,
  imageTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
};

export type FormValues = {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  revokeMint: boolean;
  revokeFreeze: boolean;
  immutable: boolean;
};

export type FormErrors = Partial<Record<keyof FormValues | "image", string>>;

const isUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export function parseSupply(raw: string): bigint | null {
  const clean = raw.replace(/[,\s_]/g, "");
  if (!/^\d+$/.test(clean)) return null;
  return BigInt(clean);
}

export function validateForm(v: FormValues, image: File | null): FormErrors {
  const e: FormErrors = {};

  if (!v.name.trim()) e.name = "Give your token a name.";
  else if (new TextEncoder().encode(v.name.trim()).length > LIMITS.nameMax)
    e.name = `Name can be at most ${LIMITS.nameMax} characters.`;

  if (!v.symbol.trim()) e.symbol = "Add a ticker symbol.";
  else if (new TextEncoder().encode(v.symbol.trim()).length > LIMITS.symbolMax)
    e.symbol = `Symbol can be at most ${LIMITS.symbolMax} characters.`;

  if (!Number.isInteger(v.decimals) || v.decimals < 0 || v.decimals > 9)
    e.decimals = "Decimals must be between 0 and 9.";

  const supply = parseSupply(v.supply);
  if (supply === null || supply <= 0n) e.supply = "Supply must be a whole number above 0.";
  else if (!e.decimals && supply * 10n ** BigInt(v.decimals) > U64_MAX)
    e.supply = "Supply is too large for this many decimals. Lower one of them.";

  if (v.description.length > LIMITS.descriptionMax)
    e.description = `Keep the description under ${LIMITS.descriptionMax} characters.`;

  for (const key of ["website", "twitter", "telegram"] as const) {
    const val = v[key].trim();
    if (val && !isUrl(val)) e[key] = "Enter a full link starting with https://";
  }

  if (!image) e.image = "Upload a logo for your token.";
  else if (!LIMITS.imageTypes.includes(image.type)) e.image = "Logo must be a PNG, JPG, WEBP or GIF.";
  else if (image.size > LIMITS.imageMaxBytes) e.image = "Logo must be under 1.5 MB.";

  return e;
}
