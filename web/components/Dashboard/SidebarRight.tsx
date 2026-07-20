"use client";

import { useEffect, useRef } from "react";
import { useLeviathan } from "@/lib/store";

export default function SidebarRight() {
  const tasks = useLeviathan((s) => s.tasks);
  const audioLevel = useLeviathan((s) => s.audioLevel);
  const entityState = useLeviathan((s) => s.entityState);
  const pcDevices = useLeviathan((s) => s.pcDevices);

  const canvasRef = useRef<HTMLCanvasElement>(null!);

  // Default operations matching Reference Image 2 if no live tasks
  const defaultOps = [
    {
      id: "op-1",
      icon: (
        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Optimizing system performance",
      status: "In Progress",
      time: "2s ago",
      color: "text-purple-400",
    },
    {
      id: "op-2",
      icon: (
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      title: "Controlling Living Room Lights",
      status: "Executed",
      time: "12s ago",
      color: "text-blue-400",
    },
    {
      id: "op-3",
      icon: (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: pcDevices.length > 0 ? `Connected to ${pcDevices[0]}` : "Connected to MacBook Pro",
      status: "Active",
      time: "15s ago",
      color: "text-emerald-400",
    },
    {
      id: "op-4",
      icon: (
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: "Email sent to Project Team",
      status: "Completed",
      time: "45s ago",
      color: "text-amber-400",
    },
    {
      id: "op-5",
      icon: (
        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Generating monthly report",
      status: "In Progress",
      time: "1m ago",
      color: "text-purple-400",
    },
  ];

  // Draw real-time glowing audio spectrum waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;

      phase += 0.08;
      const amp = 8 + (audioLevel || (entityState === "listening" ? 12 : 4));

      // Gradient stroke
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#38bdf8");
      grad.addColorStop(0.5, "#a855f7");
      grad.addColorStop(1, "#ec4899");

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = grad;

      for (let x = 0; x < w; x++) {
        const y = mid + Math.sin(x * 0.05 + phase) * amp * Math.sin((x / w) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Second overlay wave
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
      for (let x = 0; x < w; x++) {
        const y = mid + Math.sin(x * 0.08 - phase * 1.2) * (amp * 0.6) * Math.sin((x / w) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(renderWave);
    };

    renderWave();
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, entityState]);

  return (
    <aside className="pointer-events-auto absolute right-6 top-24 bottom-6 z-20 flex w-80 flex-col gap-5 select-none">
      {/* ACTIVE OPERATIONS PANEL */}
      <div className="bg-[#0a192f]/40 border border-[#64ffda]/20 rounded-sm flex flex-col gap-3.5 p-4 flex-1 overflow-hidden">
        <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-white/40 uppercase">
          ACTIVE OPERATIONS
        </span>

        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Render tasks dynamically or fallback to defaultOps */}
          {(tasks.length > 0
            ? tasks.map((t) => ({
                id: t.id,
                icon: (
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: t.label,
                status: t.status === "running" ? "In Progress" : t.status === "done" ? "Completed" : "Failed",
                time: "just now",
                color: t.status === "running" ? "text-purple-400" : "text-emerald-400",
              }))
            : defaultOps
          ).map((op) => (
            <div key={op.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#64ffda]/10 border border-[#64ffda]/20 text-[#64ffda]">
                  {op.icon}
                </div>
                <div className="flex flex-col">
                  <span className="font-data text-xs text-white/85 font-medium truncate max-w-[150px]">
                    {op.title}
                  </span>
                  <span className={`font-data text-[10px] ${op.color}`}>
                    {op.status}
                  </span>
                </div>
              </div>
              <span className="font-data text-[10px] text-white/30 whitespace-nowrap">
                {op.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* REAL-TIME LISTENING PANEL */}
      <div className="bg-[#0a192f]/40 border border-[#64ffda]/20 rounded-sm flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-white/40 uppercase">
            AUDIO WAVEFORM
          </span>
        </div>

        {/* Spectrum Canvas */}
        <div className="relative h-16 w-full overflow-hidden rounded-lg bg-black/40 border border-white/5 flex items-center justify-center">
          <canvas ref={canvasRef} width={280} height={64} className="w-full h-full" />
        </div>

        <span className="font-data text-[10px] text-center tracking-wider text-white/40 pt-1">
          Listening for your command...
        </span>
      </div>

    {/* CORE VITALS PANEL */}
      <div className="bg-[#0a192f]/40 border border-[#64ffda]/20 rounded-sm flex flex-col gap-3 p-4">
        <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-white/40 uppercase">
          CORE VITALS
        </span>

        <div className="grid grid-cols-4 gap-2">
          {/* CPU */}
          <div className="flex flex-col gap-1 text-center">
            <span className="font-data text-[9px] text-white/30 uppercase tracking-widest">CPU</span>
            <span className="font-data text-sm font-semibold text-white/90">23%</span>
            <svg className="w-full h-5 text-[#a855f7]" viewBox="0 0 50 15">
              <path d="M0,10 Q12,2 25,12 T50,8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          {/* MEMORY */}
          <div className="flex flex-col gap-1 text-center">
            <span className="font-data text-[9px] text-white/30 uppercase tracking-widest">MEM</span>
            <span className="font-data text-sm font-semibold text-white/90">66%</span>
            <svg className="w-full h-5 text-[#818cf8]" viewBox="0 0 50 15">
              <path d="M0,12 Q15,4 30,10 T50,5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          {/* NETWORK */}
          <div className="flex flex-col gap-1 text-center">
            <span className="font-data text-[9px] text-white/30 uppercase tracking-widest">NET</span>
            <span className="font-data text-sm font-semibold text-white/90">42%</span>
            <svg className="w-full h-5 text-[#64ffda]" viewBox="0 0 50 15">
              <path d="M0,8 Q10,14 25,4 T50,11" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          {/* TEMP */}
          <div className="flex flex-col gap-1 text-center">
            <span className="font-data text-[9px] text-white/30 uppercase tracking-widest">TMP</span>
            <span className="font-data text-sm font-semibold text-white/90">42°C</span>
            <svg className="w-full h-5 text-[#f59e0b]" viewBox="0 0 50 15">
              <path d="M0,11 Q15,3 32,12 T50,7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>
    </aside>
  );
}
