"use client";

// Corner instruments — mono, minimal, honest. The entity is the interface;
// these just report the machinery.

import { useLeviathan } from "@/lib/store";

export default function StatusBar() {
  const connected = useLeviathan((s) => s.connected);
  const micReady = useLeviathan((s) => s.micReady);
  const provider = useLeviathan((s) => s.provider);
  const model = useLeviathan((s) => s.model);
  const entityState = useLeviathan((s) => s.entityState);
  const errorMessage = useLeviathan((s) => s.errorMessage);
  const translationLang = useLeviathan((s) => s.translationLang);

  return (
    <>
      <div className="pointer-events-none absolute left-5 top-5 font-data text-[11px] leading-5 tracking-wider text-foam/40">
        <p>
          <span className={connected ? "text-lumen status-live" : "text-cold"}>
            {connected ? "●" : "○"}
          </span>{" "}
          {connected ? "LINKED" : "SEVERED"}
        </p>
        <p className="text-foam/25">
          {provider} / {model}
        </p>
      </div>

      <div className="pointer-events-none absolute right-5 top-5 text-right font-data text-[11px] leading-5 tracking-wider text-foam/40">
        <p>
          MIC{" "}
          <span className={micReady ? "text-lumen" : "text-cold"}>
            {micReady ? "ARMED" : "DENIED"}
          </span>
        </p>
        <p className="uppercase text-foam/25">{entityState}</p>
        {translationLang && (
          <p className="text-glint/70">⇄ translating → {translationLang}</p>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 font-data text-[11px] tracking-wider text-foam/30">
        hold <span className="text-foam/60">[space]</span> · or say{" "}
        <span className="text-foam/60">&ldquo;leviathan&rdquo;</span>
      </div>

      {errorMessage && (
        <div className="pointer-events-none absolute bottom-20 left-5 max-w-xs font-data text-[11px] leading-4 text-cold">
          {errorMessage}
        </div>
      )}
    </>
  );
}
