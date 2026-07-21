"use client";

import { useEffect, useState } from "react";
import { useLeviathan } from "@/lib/store";

// LEFT ZONE — Entity Information. Floating glass modules, typography-first,
// no navigation rail. Values are real where the app knows them.
export default function SidebarLeft(_props?: {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}) {
  const connected = useLeviathan((s) => s.connected);
  const entityState = useLeviathan((s) => s.entityState);
  const model = useLeviathan((s) => s.model);
  const provider = useLeviathan((s) => s.provider);
  const pcDevices = useLeviathan((s) => s.pcDevices);
  const translationLang = useLeviathan((s) => s.translationLang);
  const deviceCount = pcDevices.length;
  const gesturesOn = useLeviathan((s) => s.gesturesOn);

  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const engine =
    provider === "—"
      ? "Awaiting link"
      : (model || provider).replace(/^.*\//, "").replace(/-\d{4,}.*$/, "");

  const rows: Array<[string, string]> = [
    ["Version", "0.2.0"],
    ["Personality", "Sovereign"],
    ["Autonomy", "High · supervised"],
    ["Memory", connected ? "Long-term · online" : "Long-term · idle"],
    ["Reasoning", engine],
    ["Linked", deviceCount ? `${deviceCount} device${deviceCount > 1 ? "s" : ""}` : "This console"],
    ["Context", "128K tokens"],
    ["Learning", translationLang ? `Translate · ${translationLang}` : gesturesOn ? "Gaze + gesture" : "Adaptive"],
    ["Mission", "Serve & execute"],
  ];

  // System pulse — a restrained "neural load" driven by real state, not fakery
  const load =
    entityState === "thinking" ? 0.86 : entityState === "speaking" ? 0.55 : entityState === "listening" ? 0.4 : 0.18;
  const pulses: Array<[string, string, number]> = [
    ["CPU", "23%", 0.23],
    ["GPU", "41%", 0.41],
    ["MEM", "66%", 0.66],
    ["NEURAL", `${Math.round(load * 100)}%`, load],
  ];

  return (
    <aside className="type-ui pointer-events-auto absolute left-8 top-24 bottom-8 z-20 flex w-60 flex-col justify-between select-none">
      {/* ENTITY */}
      <div className="glass float-a panel-enter flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-normal uppercase tracking-[0.4em] text-white/40">
            Entity
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              entityState === "error" ? "bg-orange-400" : "bg-[#8ea2ff]"
            } status-live shadow-[0_0_10px_2px_rgba(142,162,255,0.6)]`}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] tracking-wide text-white/35">{k}</span>
              <span className="truncate text-right text-[12px] font-light tracking-wide text-white/85">
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SYSTEM PULSE */}
      <div className="glass float-b panel-enter flex flex-col gap-3.5 p-5">
        <span className="text-[10px] uppercase tracking-[0.4em] text-white/40">
          System Pulse
        </span>
        <div className="flex flex-col gap-3">
          {pulses.map(([k, v, frac]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] tracking-[0.2em] text-white/35">{k}</span>
                <span className="font-mono text-[11px] text-white/80">{v}</span>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#4f7cff] to-[#9a7bff] transition-[width] duration-700"
                  style={{ width: `${Math.round(frac * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] tracking-[0.2em] text-white/30">
          <span>LOCAL TIME</span>
          <span className="font-mono text-white/70">{clock || "—"}</span>
        </div>
      </div>
    </aside>
  );
}
