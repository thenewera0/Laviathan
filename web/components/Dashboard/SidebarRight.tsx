"use client";

import { useEffect, useRef } from "react";
import { useLeviathan } from "@/lib/store";

function relTime(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function SidebarRight() {
  const tasks = useLeviathan((s) => s.tasks);
  const audioLevel = useLeviathan((s) => s.audioLevel);
  const entityState = useLeviathan((s) => s.entityState);
  const pcDevices = useLeviathan((s) => s.pcDevices);
  const activity = useLeviathan((s) => s.activity);

  const canvasRef = useRef<HTMLCanvasElement>(null!);

  // Illustrative operations shown when no live tasks are running
  const defaultOps = [
    {
      id: "op-1",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Optimizing system performance",
      status: "In Progress",
      time: "2s ago",
      tone: "text-[#38bdf8]",
    },
    {
      id: "op-2",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      title: "Controlling Living Room Lights",
      status: "Executed",
      time: "12s ago",
      tone: "text-[#60a5fa]",
    },
    {
      id: "op-3",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: pcDevices.length > 0 ? `Connected to ${pcDevices[0]}` : "Connected to MacBook Pro",
      status: "Active",
      time: "15s ago",
      tone: "text-[#34d399]",
    },
    {
      id: "op-4",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: "Email sent to Project Team",
      status: "Completed",
      time: "45s ago",
      tone: "text-[#60a5fa]",
    },
    {
      id: "op-5",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Generating monthly report",
      status: "In Progress",
      time: "1m ago",
      tone: "text-[#38bdf8]",
    },
  ];

  // Live glowing dual-wave spectrum, tinted to the orb's palette
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderWave = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;
      ctx.clearRect(0, 0, w, h);

      phase += 0.08;
      const amp = 9 + (audioLevel || (entityState === "listening" ? 13 : 4));

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#38bdf8");
      grad.addColorStop(0.5, "#60a5fa");
      grad.addColorStop(1, "#38bdf8");

      // main wave with soft glow
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(56,189,248,0.7)";
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = grad;
      for (let x = 0; x < w; x++) {
        const env = Math.sin((x / w) * Math.PI);
        const y = mid + Math.sin(x * 0.05 + phase) * amp * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // mirrored under-wave
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(96,165,250,0.35)";
      for (let x = 0; x < w; x++) {
        const env = Math.sin((x / w) * Math.PI);
        const y = mid - Math.sin(x * 0.08 - phase * 1.2) * amp * 0.55 * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(renderWave);
    };

    renderWave();
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, entityState]);

  const dv = useLeviathan((s) => s.deviceVitals);
  // Real vitals from a paired PC (via the companion) when present; a paired
  // machine with no reading yet shows "—"; no companion shows the dash too.
  const pct = (v: any) => (typeof v === "number" ? `${Math.round(v)}%` : "—");
  const vitals = dv
    ? [
        { label: "CPU", value: pct(dv.cpu_percent), color: "#38bdf8", d: "M0,10 Q12,2 25,12 T50,8" },
        { label: "MEM", value: pct(dv.memory_percent), color: "#60a5fa", d: "M0,12 Q15,4 30,10 T50,5" },
        { label: "DISK", value: pct(dv.disk_percent), color: "#34d399", d: "M0,8 Q10,14 25,4 T50,11" },
        { label: "BATT", value: dv.battery ?? "—", color: "#f59e0b", d: "M0,11 Q15,3 32,12 T50,7" },
      ]
    : [
        { label: "CPU", value: "—", color: "#38bdf8", d: "M0,10 Q12,2 25,12 T50,8" },
        { label: "MEM", value: "—", color: "#60a5fa", d: "M0,12 Q15,4 30,10 T50,5" },
        { label: "DISK", value: "—", color: "#34d399", d: "M0,8 Q10,14 25,4 T50,11" },
        { label: "BATT", value: "—", color: "#f59e0b", d: "M0,11 Q15,3 32,12 T50,7" },
      ];

  const boltIcon = (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
  // Real operations: live background tasks first, else the genuine recent
  // activity feed, else an honest idle state — never invented data.
  const liveOps =
    tasks.length > 0
      ? tasks.map((t) => ({
          id: t.id,
          icon: boltIcon,
          title: t.label,
          status: t.status === "running" ? "In Progress" : t.status === "done" ? "Completed" : "Failed",
          time: "just now",
          tone: t.status === "failed" ? "text-rose-400" : t.status === "done" ? "text-[#34d399]" : "text-[#38bdf8]",
        }))
      : activity.length > 0
        ? activity.map((a) => ({
            id: String(a.id),
            icon: boltIcon,
            title: a.text,
            status: "done",
            time: relTime(a.at),
            tone: "text-[#38bdf8]",
          }))
        : [
            {
              id: "idle",
              icon: boltIcon,
              title: "Awaiting your command",
              status: "Idle",
              time: "",
              tone: "text-foam/40",
            },
          ];

  return (
    <aside className="pointer-events-auto absolute right-6 top-24 bottom-6 z-20 flex w-80 flex-col gap-4 select-none">
      {/* ACTIVE OPERATIONS */}
      <div className="glass-panel panel-enter flex flex-1 flex-col gap-3.5 overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-foam/45 uppercase">
            Active Operations
          </span>
          <span className="status-live h-1.5 w-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_8px_2px_rgba(56,189,248,0.6)]" />
        </div>

        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
          {liveOps.map((op) => (
            <div
              key={op.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-[#38bdf8]/30 hover:bg-[#38bdf8]/[0.06]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 ${op.tone}`}>
                  {op.icon}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-data text-xs font-medium text-foam/90">
                    {op.title}
                  </span>
                  <span className={`font-data text-[10px] ${op.tone}`}>{op.status}</span>
                </div>
              </div>
              <span className="shrink-0 font-data text-[10px] text-foam/30">{op.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AUDIO WAVEFORM */}
      <div className="glass-panel panel-enter flex flex-col gap-2 p-4">
        <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-foam/45 uppercase">
          Audio Waveform
        </span>
        <div className="relative h-16 w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/50">
          <canvas ref={canvasRef} width={288} height={64} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_40%,rgba(4,7,12,0.6))]" />
        </div>
        <span className="pt-0.5 text-center font-data text-[10px] tracking-wider text-foam/40">
          {entityState === "listening"
            ? "Listening for your command…"
            : entityState === "thinking"
              ? "Processing…"
              : entityState === "speaking"
                ? "Responding…"
                : "Standing by"}
        </span>
      </div>

      {/* CORE VITALS */}
      <div className="glass-panel panel-enter flex flex-col gap-3 p-4">
        <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-foam/45 uppercase">
          Core Vitals
        </span>
        <div className="grid grid-cols-4 gap-2">
          {vitals.map((v) => (
            <div key={v.label} className="flex flex-col items-center gap-1 text-center">
              <span className="font-data text-[9px] uppercase tracking-widest text-foam/35">{v.label}</span>
              <span className="font-data text-sm font-semibold text-foam/90">{v.value}</span>
              <svg className="h-5 w-full" viewBox="0 0 50 15" style={{ color: v.color }}>
                <path d={v.d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
