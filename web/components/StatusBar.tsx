"use client";

// The instrument cluster — every value here is live session state, never
// decoration. Two readouts frame the top; the interaction hint anchors
// the bottom. Small caps, hairline dividers, a single accent for what's
// active right now.

import { useLeviathan } from "@/lib/store";

function Field({
  label,
  value,
  accent,
  live,
}: {
  label: string;
  value: string;
  accent?: boolean;
  live?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-data text-[9px] uppercase tracking-[0.35em] text-foam/25">
        {label}
      </span>
      <span
        className={`font-data text-[11px] tracking-wide ${
          accent ? "text-lumen" : "text-foam/60"
        } ${live ? "status-live" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function StatusBar() {
  const connected = useLeviathan((s) => s.connected);
  const provider = useLeviathan((s) => s.provider);
  const model = useLeviathan((s) => s.model);
  const micReady = useLeviathan((s) => s.micReady);
  const entityState = useLeviathan((s) => s.entityState);
  const translationLang = useLeviathan((s) => s.translationLang);
  const errorMessage = useLeviathan((s) => s.errorMessage);

  return (
    <>
      {/* identity — top left */}
      <div className="hud-enter pointer-events-none absolute left-8 top-7 space-y-1.5">
        <Field
          label="link"
          value={connected ? "established" : "severed"}
          accent={connected}
          live={connected}
        />
        <div className="h-px w-28 bg-gradient-to-r from-foam/15 to-transparent" />
        <p className="font-data text-[10px] tracking-wide text-foam/30">
          {provider} · {model}
        </p>
      </div>

      {/* state — top right */}
      <div className="hud-enter pointer-events-none absolute right-8 top-7 space-y-1.5 text-right">
        <div className="flex items-baseline justify-end gap-2">
          <span className="font-data text-[11px] uppercase tracking-[0.3em] text-foam/70">
            {entityState}
          </span>
          <span className="font-data text-[9px] uppercase tracking-[0.35em] text-foam/25">
            state
          </span>
        </div>
        <div className="ml-auto h-px w-28 bg-gradient-to-l from-foam/15 to-transparent" />
        <p className="font-data text-[10px] tracking-wide">
          <span className={micReady ? "text-lumen/80" : "text-cold"}>
            ▸ mic {micReady ? "armed" : "denied"}
          </span>
        </p>
        {translationLang && (
          <p className="font-data text-[10px] tracking-wide text-glint/70">
            ⇄ {translationLang}
          </p>
        )}
      </div>

      {/* interaction hint — bottom right */}
      <div className="pointer-events-none absolute bottom-7 right-8 font-data text-[10px] tracking-wide text-foam/30">
        hold <span className="text-foam/60">[space]</span> · or say{" "}
        <span className="text-foam/60">&ldquo;leviathan&rdquo;</span>
      </div>

      {errorMessage && (
        <div className="pointer-events-none absolute bottom-20 left-8 max-w-xs font-data text-[11px] leading-4 text-cold">
          {errorMessage}
        </div>
      )}
    </>
  );
}
