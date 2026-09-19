import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// Local development only: serves files the upload route saved when no PINATA_JWT is set.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  const { file } = await params;
  if (!/^\d+\.(json|png|jpg|webp|gif)$/.test(file)) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(path.join(process.cwd(), ".dev-uploads", file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[file.split(".")[1]],
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
