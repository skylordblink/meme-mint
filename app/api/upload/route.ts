import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LIMITS } from "@/lib/validate";

export const runtime = "nodejs";

const PINATA_JWT = process.env.PINATA_JWT;
// ipfs.io answers 403 to many clients, so links point at Pinata's gateway, which serves what Pinata pins.
const IPFS_GATEWAY = (process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs").replace(/\/$/, "");

// Light per-IP throttle so a public deployment can't drain the Pinata quota in a loop.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_HITS = 8;

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

async function pinFile(file: File, name: string): Promise<string> {
  const body = new FormData();
  body.append("file", file, name);
  body.append("pinataMetadata", JSON.stringify({ name }));
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body,
  });
  if (!res.ok) throw new Error(`Pinata rejected the image upload (${res.status}).`);
  return (await res.json()).IpfsHash as string;
}

async function pinJson(content: unknown, name: string): Promise<string> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name } }),
  });
  if (!res.ok) throw new Error(`Pinata rejected the metadata upload (${res.status}).`);
  return (await res.json()).IpfsHash as string;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return fail("Too many uploads. Wait a minute and try again.", 429);

  const isDev = process.env.NODE_ENV !== "production";
  if (!PINATA_JWT && !isDev) {
    return fail("Uploads are not configured. Set PINATA_JWT in the environment (see the README).", 500);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Invalid upload.");
  }

  const image = form.get("image");
  const name = String(form.get("name") ?? "").trim();
  const symbol = String(form.get("symbol") ?? "").trim();
  const description = String(form.get("description") ?? "").trim().slice(0, LIMITS.descriptionMax);
  const website = String(form.get("website") ?? "").trim();
  const twitter = String(form.get("twitter") ?? "").trim();
  const telegram = String(form.get("telegram") ?? "").trim();

  if (!(image instanceof File)) return fail("A logo image is required.");
  if (!LIMITS.imageTypes.includes(image.type)) return fail("Logo must be a PNG, JPG, WEBP or GIF.");
  if (image.size > LIMITS.imageMaxBytes) return fail("Logo must be under 1.5 MB.");
  if (!name || !symbol) return fail("Name and symbol are required.");

  try {
    let imageUri: string;
    let store: (metadata: object) => Promise<string>;

    if (PINATA_JWT) {
      const imageHash = await pinFile(image, `${symbol}-logo`);
      imageUri = `${IPFS_GATEWAY}/${imageHash}`;
      store = async (metadata) => `${IPFS_GATEWAY}/${await pinJson(metadata, `${symbol}-metadata`)}`;
    } else {
      // Local development only: keep files on disk so the app can be demoed without Pinata.
      const dir = path.join(process.cwd(), ".dev-uploads");
      await mkdir(dir, { recursive: true });
      const stamp = Date.now();
      const ext = image.type.split("/")[1] === "jpeg" ? "jpg" : image.type.split("/")[1];
      await writeFile(path.join(dir, `${stamp}.${ext}`), Buffer.from(await image.arrayBuffer()));
      const origin = new URL(request.url).origin;
      imageUri = `${origin}/api/dev-uploads/${stamp}.${ext}`;
      store = async (metadata) => {
        await writeFile(path.join(dir, `${stamp}.json`), JSON.stringify(metadata));
        return `${origin}/api/dev-uploads/${stamp}.json`;
      };
    }

    const metadata = {
      name,
      symbol,
      description,
      image: imageUri,
      ...(website && { external_url: website, website }),
      ...(twitter && { twitter }),
      ...(telegram && { telegram }),
      properties: { files: [{ uri: imageUri, type: image.type }], category: "image" },
    };

    const uri = await store(metadata);
    return Response.json({ uri, image: imageUri });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Upload failed.", 502);
  }
}
