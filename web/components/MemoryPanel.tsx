"use client";

// What Leviathan remembers about you — real rows from the pgvector store,
// each removable. Opens from the MEMORY / KNOWLEDGE nav tab.

import { useEffect } from "react";
import { useLeviathan } from "@/lib/store";

export default function MemoryPanel({
  onClose,
  onRefresh,
  onForget,
}: {
  onClose: () => void;
  onRefresh: () => void;
  onForget: (id: string) => void;
}) {
  const memories = useLeviathan((s) => s.memories);

  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-panel panel-enter absolute bottom-16 left-1/2 z-20 flex h-[62vh] w-[min(720px,92vw)] -translate-x-1/2 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-foam/10 px-4 py-2">
        <p className="font-data text-[11px] uppercase tracking-[0.25em] text-lumen/70">
          ⬡ what I remember · {memories.length}
        </p>
        <div className="flex items-center gap-3 font-data text-[11px]">
          <button
            onClick={onRefresh}
            className="text-foam/60 transition-colors hover:text-lumen"
          >
            refresh
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-foam/40 transition-colors hover:text-lumen"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {memories.length === 0 ? (
          <p className="px-2 py-6 text-center font-data text-[12px] text-foam/40">
            nothing stored yet — I&apos;ll remember durable things as we talk,
            or say &quot;remember that…&quot;
          </p>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              className="group flex items-start justify-between gap-3 rounded border border-foam/8 bg-abyss/40 px-3 py-2"
            >
              <p className="font-data text-[12px] leading-5 text-foam/80">
                {m.text}
              </p>
              <button
                onClick={() => onForget(m.id)}
                title="forget this"
                className="shrink-0 font-data text-[11px] text-foam/30 transition-colors hover:text-cold"
              >
                forget
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
