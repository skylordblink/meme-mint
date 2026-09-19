import { useMemo, useSyncExternalStore } from "react";
import type { Network } from "./config";

export type SavedToken = {
  mint: string;
  name: string;
  symbol: string;
  network: Network;
  signature: string;
  createdAt: number;
};

const KEY = "mm.tokens";
const EVENT = "mm-tokens-changed";

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Tokens created in this browser, newest first. Safe on the server (returns an empty list). */
export function useSavedTokens(): SavedToken[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  return useMemo(() => {
    try {
      return JSON.parse(raw) as SavedToken[];
    } catch {
      return [];
    }
  }, [raw]);
}

export function saveToken(t: SavedToken) {
  let existing: SavedToken[] = [];
  try {
    existing = JSON.parse(readRaw()) as SavedToken[];
  } catch {}
  const next = [t, ...existing.filter((x) => x.mint !== t.mint)].slice(0, 50);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
