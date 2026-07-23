"use client";

// Real reminders + daily routines from the scheduler. Opens on the
// AUTOMATION tab. Every row is a live scheduled item, cancellable.

import { useEffect } from "react";
import { useLeviathan } from "@/lib/store";

export default function SchedulesPanel({
  onClose,
  onRefresh,
  onCancel,
}: {
  onClose: () => void;
  onRefresh: () => void;
  onCancel: (id: string) => void;
}) {
  const schedules = useLeviathan((s) => s.schedules);

  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-panel panel-enter absolute bottom-16 left-1/2 z-20 flex h-[62vh] w-[min(680px,92vw)] -translate-x-1/2 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-foam/10 px-4 py-2">
        <p className="font-data text-[11px] uppercase tracking-[0.25em] text-lumen/70">
          ◷ automation · {schedules.length}
        </p>
        <div className="flex items-center gap-3 font-data text-[11px]">
          <button onClick={onRefresh} className="text-foam/60 transition-colors hover:text-lumen">
            refresh
          </button>
          <button onClick={onClose} aria-label="Close" className="text-foam/40 transition-colors hover:text-lumen">
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {schedules.length === 0 ? (
          <p className="px-2 py-6 text-center font-data text-[12px] text-foam/40">
            nothing scheduled — say &quot;remind me in 20 minutes to…&quot; or
            &quot;every morning at 8, brief me on…&quot;
          </p>
        ) : (
          schedules.map((it) => (
            <div
              key={it.id}
              className="flex items-start justify-between gap-3 rounded border border-foam/8 bg-abyss/40 px-3 py-2"
            >
              <div>
                <p className="font-data text-[10px] uppercase tracking-[0.2em] text-glint/70">
                  {it.kind === "routine" ? `daily · ${it.at_time}` : `once · ${(it.fire_at || "").slice(11, 16)}`}
                </p>
                <p className="mt-0.5 font-data text-[12px] leading-5 text-foam/80">
                  {it.text}
                </p>
              </div>
              <button
                onClick={() => onCancel(it.id)}
                title="cancel"
                className="shrink-0 font-data text-[11px] text-foam/30 transition-colors hover:text-cold"
              >
                cancel
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
