"use client";

import { useState, type ReactNode } from "react";

export function Step({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div className="mb-5 flex items-end gap-3 border-b-2 border-ink pb-2">
      <span className="font-display text-4xl font-extrabold leading-none text-limedeep [-webkit-text-stroke:1.5px_var(--ink)]">{n}</span>
      <h2 className="font-display text-xl font-extrabold leading-none">{title}</h2>
      {note && <span className="eyebrow ml-auto hidden pb-0.5 sm:block">{note}</span>}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="err">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Seal({
  checked,
  onChange,
  title,
  description,
  onLabel = "Sealed",
  offLabel = "Open",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-4 rounded-xl border-2 border-ink p-3.5 text-left transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)] ${
        checked ? "bg-lime/40" : "bg-card"
      }`}
    >
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${checked ? "bg-ink" : "bg-paper"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink transition-all ${
            checked ? "left-[1.35rem] bg-lime" : "left-0.5 bg-card"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-extrabold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[0.8rem] leading-snug text-muted">{description}</span>
      </span>
      <span className={`stamp ${checked ? "stamp-on" : "stamp-off"}`} style={{ ["--r" as string]: checked ? "-3deg" : "2deg" }}>
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
