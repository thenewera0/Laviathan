"use client";

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
    <div className="pointer-events-auto absolute left-56 lg:left-60 right-4 lg:right-6 top-20 bottom-4 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070b14]/95 shadow-2xl backdrop-blur-2xl text-foam/90 max-h-[calc(100vh-90px)]">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/50">
        <div className="flex items-center gap-3 font-data text-xs">
          <span className="text-[#38bdf8] text-base">◷</span>
          <span className="font-bold tracking-wider uppercase text-foam">
            AUTOMATION & ROUTINES CONTROL
          </span>
          <span className="px-2 py-0.5 rounded bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#7dd3fc] font-mono text-[11px]">
            {schedules.length} SCHEDULES
          </span>
        </div>

        <div className="flex items-center gap-3 font-data text-xs">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-foam/70 hover:text-foam transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:text-rose-400 text-foam/60 flex items-center justify-center transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Schedules List Container */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-6 bg-black/20">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-foam/40 gap-3 py-12">
            <span className="text-3xl">🔗</span>
            <p className="font-data text-xs max-w-md">
              Nothing scheduled yet. You can speak commands like <span className="text-[#7dd3fc]">&quot;remind me in 20 minutes to submit code&quot;</span> or <span className="text-[#7dd3fc]">&quot;every morning at 8, brief me&quot;</span> to create automated routines.
            </p>
          </div>
        ) : (
          schedules.map((it) => (
            <div
              key={it.id}
              className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#38bdf8]/40 hover:bg-white/[0.05] transition-all"
            >
              <div className="flex flex-col gap-1 font-data text-xs leading-relaxed text-foam/90">
                <span className="text-[#7dd3fc] font-mono text-[10px] uppercase tracking-wider">
                  {it.kind === "routine" ? `DAILY ROUTINE · ${it.at_time}` : `ONE-TIME · ${(it.fire_at || "").slice(11, 16)}`}
                </span>
                <span className="font-medium text-foam">{it.text}</span>
              </div>
              <button
                onClick={() => onCancel(it.id)}
                title="Cancel schedule"
                className="shrink-0 px-3 py-1.5 rounded bg-rose-500/10 border border-rose-500/20 font-data text-[11px] text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/20 transition-colors uppercase tracking-wider font-semibold"
              >
                Cancel
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
