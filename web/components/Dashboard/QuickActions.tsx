"use client";

import { useLeviathan } from "@/lib/store";

// BOTTOM — a cinematic execution timeline. Nodes light as the AI moves
// through its cycle. Driven by real entity state, not decoration.
export default function QuickActions(_props?: { onAction?: (prompt: string) => void }) {
  const entityState = useLeviathan((s) => s.entityState);

  const nodes = ["Voice Detected", "Reasoning", "Planning", "Execution", "Complete"];

  // How far through the cycle we are, from the live state
  const activeIndex =
    entityState === "listening"
      ? 0
      : entityState === "thinking"
        ? 2
        : entityState === "speaking"
          ? 3
          : entityState === "error"
            ? 1
            : -1; // idle: dormant

  return (
    <div className="type-ui pointer-events-auto absolute left-1/2 bottom-7 z-20 -translate-x-1/2 select-none">
      <div className="flex items-center gap-1">
        {nodes.map((label, i) => {
          const done = activeIndex >= 0 && i < activeIndex;
          const active = i === activeIndex;
          const dotColor = active
            ? "bg-[#8ea2ff] status-live shadow-[0_0_12px_3px_rgba(142,162,255,0.7)]"
            : done
              ? "bg-[#7fe0c0]"
              : "bg-white/20";
          const textColor = active ? "text-white/85" : done ? "text-white/55" : "text-white/30";
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 px-3">
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                <span className={`text-[10px] uppercase tracking-[0.22em] ${textColor}`}>
                  {label}
                </span>
              </div>
              {i < nodes.length - 1 && (
                <span
                  className={`h-px w-14 ${
                    done ? "bg-[#7fe0c0]/50" : active ? "bg-[#8ea2ff]/40 breathe-glow" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
