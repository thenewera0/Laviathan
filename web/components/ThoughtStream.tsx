"use client";

// While Leviathan works a multi-step task, its tool activity surfaces
// here as a quiet, living log — never a dead spinner.

import { useLeviathan } from "@/lib/store";
import { ThinkingOrb } from "thinking-orbs";

export default function ThoughtStream() {
  const thoughts = useLeviathan((s) => s.thoughts);
  const entityState = useLeviathan((s) => s.entityState);

  if (thoughts.length === 0 || entityState !== "thinking") return null;

  return (
    <div className="pointer-events-none absolute bottom-16 left-6 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <ThinkingOrb state="working" size={20} />
        <p className="font-data text-[10px] uppercase tracking-[0.3em] text-lumen/30">
          undercurrent
        </p>
      </div>
      <ul className="space-y-1.5">
        {thoughts.map((t, i) => (
          <li
            key={t.id}
            className="caption-word font-data text-[11px] leading-4 tracking-wide text-foam/50"
            style={{ opacity: 0.35 + (0.65 * (i + 1)) / thoughts.length }}
          >
            {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
