"use client";

// Background work — research descents that keep going while you talk
// about other things. Persistent (unlike the ThoughtStream, which only
// lives during a "thinking" turn). Finished tasks can be dismissed.

import { useLeviathan } from "@/lib/store";

const STATUS_GLYPH: Record<string, string> = {
  running: "◍",
  done: "●",
  failed: "○",
};

export default function TaskPanel() {
  const tasks = useLeviathan((s) => s.tasks);
  const removeTask = useLeviathan((s) => s.removeTask);

  if (tasks.length === 0) return null;

  return (
    <div className="absolute bottom-24 left-8 w-72 max-w-[80vw] space-y-2">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="glass-panel panel-enter px-3 py-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-data text-[10px] uppercase tracking-[0.25em] text-foam/40">
              <span
                className={
                  t.status === "running"
                    ? "status-live text-lumen"
                    : t.status === "done"
                      ? "text-lumen"
                      : "text-cold"
                }
              >
                {STATUS_GLYPH[t.status]}
              </span>{" "}
              {t.kind} · {t.status}
            </p>
            {t.status !== "running" && (
              <button
                onClick={() => removeTask(t.id)}
                aria-label="Dismiss task"
                className="font-data text-[11px] text-foam/40 transition-colors hover:text-lumen focus-visible:text-lumen"
              >
                ✕
              </button>
            )}
          </div>
          <p className="mt-1 truncate font-voice text-sm italic text-foam/75">
            {t.label}
          </p>
          {t.latest && (
            <p className="mt-1 truncate font-data text-[11px] text-foam/45">
              {t.latest}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
