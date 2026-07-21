"use client";

import { useLeviathan } from "@/lib/store";

// RIGHT ZONE — Execution Intelligence. The AI's actual thinking + execution,
// mission-control style. Real thoughts/tasks from the store; tiny status dots,
// never coloured badges.
export default function SidebarRight() {
  const thoughts = useLeviathan((s) => s.thoughts);
  const tasks = useLeviathan((s) => s.tasks);
  const entityState = useLeviathan((s) => s.entityState);
  const connected = useLeviathan((s) => s.connected);

  type Line = { id: string; text: string; state: "done" | "active" | "idle" | "fail" };

  const live: Line[] = [
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      text: t.label,
      state: (t.status === "done" ? "done" : t.status === "failed" ? "fail" : "active") as Line["state"],
    })),
    ...thoughts.map((th) => ({
      id: `th-${th.id}`,
      text: th.text,
      state: "active" as Line["state"],
    })),
  ];

  const idle: Line[] = [
    { id: "i1", text: "Neural link established", state: "done" },
    { id: "i2", text: "Memory index mounted", state: "done" },
    { id: "i3", text: "Tool registry loaded — 20 capabilities", state: "done" },
    { id: "i4", text: "Awaiting operator command", state: "idle" },
  ];

  const lines = live.length ? live : idle;

  const dot = (s: Line["state"]) =>
    s === "done"
      ? "bg-[#7fe0c0]"
      : s === "active"
        ? "bg-[#8ea2ff] status-live shadow-[0_0_8px_2px_rgba(142,162,255,0.6)]"
        : s === "fail"
          ? "bg-orange-400"
          : "bg-white/25";

  const stateLabel =
    entityState === "thinking"
      ? "Reasoning"
      : entityState === "speaking"
        ? "Responding"
        : entityState === "listening"
          ? "Listening"
          : connected
            ? "Standing by"
            : "Offline";

  return (
    <aside className="type-ui pointer-events-auto absolute right-8 top-24 bottom-8 z-20 flex w-80 flex-col select-none">
      <div className="glass float-a panel-enter flex flex-1 flex-col gap-4 overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/40">
            Execution Feed
          </span>
          <span className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-white/45">
            {stateLabel}
            <span className={`h-1.5 w-1.5 rounded-full ${entityState === "idle" ? "bg-white/30" : "bg-[#8ea2ff] status-live"}`} />
          </span>
        </div>

        <div className="relative flex flex-col gap-3.5 overflow-y-auto pr-1">
          {/* vertical thread line */}
          <span className="pointer-events-none absolute left-[3px] top-1 bottom-1 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
          {lines.map((l) => (
            <div key={l.id} className="relative flex items-start gap-3 pl-0">
              <span className={`mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full ${dot(l.state)}`} />
              <div className="flex min-w-0 flex-col">
                <span className="text-[12.5px] font-light leading-snug tracking-wide text-white/85">
                  {l.text}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                  {l.state === "done" ? "Completed" : l.state === "active" ? "Executing" : l.state === "fail" ? "Failed" : "Ready"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] tracking-[0.2em] text-white/30">
          <span>MISSION CONTROL</span>
          <span className="font-mono text-white/55">{lines.length} events</span>
        </div>
      </div>
    </aside>
  );
}
