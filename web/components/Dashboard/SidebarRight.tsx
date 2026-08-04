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
  const activity = useLeviathan((s) => s.activity);
  const dv = useLeviathan((s) => s.deviceVitals);

  const canvasRef = useRef<HTMLCanvasElement>(null!);

  // Bioluminescent Cobalt & Copper Gold Spectrum Equalizer (Reference Image 2)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const renderSpectrum = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;
      ctx.clearRect(0, 0, w, h);

      phase += 0.08;
      const amp = 10 + (audioLevel || (entityState === "listening" ? 15 : 5));

      // Cobalt Sapphire Fluid Gradient
      const gradCobalt = ctx.createLinearGradient(0, 0, w, 0);
      gradCobalt.addColorStop(0, "#00d4ff");
      gradCobalt.addColorStop(0.5, "#0099ff");
      gradCobalt.addColorStop(1, "#38bdf8");

      // Primary Wave (Cobalt)
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(0, 212, 255, 0.8)";
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = gradCobalt;

      for (let x = 0; x < w; x++) {
        const env = Math.sin((x / w) * Math.PI);
        const y = mid + Math.sin(x * 0.06 + phase) * amp * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Secondary Wave (Molten Gold Highlight)
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(245, 158, 11, 0.7)";
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";

      for (let x = 0; x < w; x++) {
        const env = Math.sin((x / w) * Math.PI);
        const y = mid - Math.sin(x * 0.09 - phase * 1.3) * amp * 0.65 * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Equalizer Bars
      const numBars = 20;
      const barWidth = w / numBars - 2;
      ctx.fillStyle = "rgba(0, 212, 255, 0.15)";

      for (let i = 0; i < numBars; i++) {
        const barHeight = Math.abs(Math.sin(phase + i * 0.5)) * amp * 0.8;
        const x = i * (barWidth + 2);
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);
      }

      animId = requestAnimationFrame(renderSpectrum);
    };

    renderSpectrum();
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, entityState]);

  const numVal = (v: any) => (typeof v === "number" ? Math.round(v) : 0);

  const cpuPct = dv ? numVal(dv.cpu_percent) : 34;
  const memPct = dv ? numVal(dv.memory_percent) : 48;
  const diskPct = dv ? numVal(dv.disk_percent) : 62;
  const battVal = dv && typeof dv.battery === "number" ? Math.round(dv.battery) : 88;

  const vitalsGauges = [
    { label: "CPU", value: `${cpuPct}%`, pct: cpuPct, color: "#00d4ff" },
    { label: "MEM", value: `${memPct}%`, pct: memPct, color: "#0099ff" },
    { label: "DISK", value: `${diskPct}%`, pct: diskPct, color: "#38bdf8" },
    { label: "BATT", value: `${battVal}%`, pct: battVal, color: "#f59e0b" },
  ];

  const boltIcon = (
    <span className="text-[#00d4ff] font-bold">⚡</span>
  );

  const liveOps =
    tasks.length > 0
      ? tasks.map((t) => ({
          id: t.id,
          icon: boltIcon,
          title: t.label,
          status: t.status === "running" ? "In Progress" : t.status === "done" ? "Completed" : "Failed",
          time: "just now",
          tone: t.status === "failed" ? "text-rose-400" : t.status === "done" ? "text-[#34d399]" : "text-[#00d4ff]",
        }))
      : activity.length > 0
        ? activity.map((a) => ({
            id: String(a.id),
            icon: boltIcon,
            title: a.text,
            status: "done",
            time: relTime(a.at),
            tone: "text-[#00d4ff]",
          }))
        : [
            {
              id: "idle",
              icon: boltIcon,
              title: "Awaiting your command",
              status: "Idle",
              time: "",
              tone: "text-white/40",
            },
          ];

  return (
    <aside className="pointer-events-auto absolute right-4 lg:right-6 top-20 bottom-4 z-20 flex w-72 lg:w-80 flex-col gap-4 select-none max-h-[calc(100vh-90px)] overflow-y-auto pr-1">
      
      {/* ACTIVE OPERATIONS */}
      <div className="skeuo-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-black/60 pb-2 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
          <span className="skeuo-etch font-data text-[9px] font-semibold">
            Active Operations
          </span>
          <span className="h-2 w-2 rounded-full bg-[#5afbff] shadow-[0_0_5px_rgba(90,251,255,0.7)] animate-pulse" />
        </div>

        <div className="flex flex-col gap-2.5 max-h-44 overflow-y-auto">
          {liveOps.slice(0, 4).map((op) => (
            <div
              key={op.id}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#080d1c]/80 border border-white/10 hover:border-[#00d4ff]/50 transition-all"
            >
              <span className="mt-0.5">{op.icon}</span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-data text-xs font-semibold text-white truncate">
                  {op.title}
                </span>
                <div className="flex items-center justify-between font-mono text-[9px] mt-1">
                  <span className={op.tone}>{op.status}</span>
                  {op.time && <span className="text-white/40">{op.time}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AUDIO WAVEFORM SPECTRUM */}
      <div className="skeuo-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-black/60 pb-2 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
          <span className="skeuo-etch font-data text-[9px] font-semibold">
            Audio Spectrum
          </span>
          <span className="font-mono text-[9px] text-[#f59e0b]">44.1 kHz</span>
        </div>

        <div className="relative h-20 w-full overflow-hidden rounded-xl bg-[#040814]/90 border border-white/10 flex items-center justify-center p-2">
          <canvas ref={canvasRef} width={280} height={70} className="w-full h-full" />
        </div>

        <div className="flex items-center justify-between font-mono text-[9px] text-white/50 px-1">
          <span>STATUS: {entityState.toUpperCase()}</span>
          <span className="text-[#00d4ff]">{audioLevel > 0 ? `${Math.round(audioLevel * 100)} RMS` : "STANDBY"}</span>
        </div>
      </div>

      {/* CORE VITALS TELEMETRY GAUGES */}
      <div className="skeuo-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-black/60 pb-2 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
          <span className="skeuo-etch font-data text-[9px] font-semibold">
            Core Vitals
          </span>
          <span className="font-mono text-[9px] text-[#34d399]">HEALTH: 100%</span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {vitalsGauges.map((g, idx) => {
            const strokeDashoffset = 100 - g.pct;

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[#080d1c]/80 border border-white/10">
                {/* Circular SVG Gauge Arc */}
                <div className="relative w-11 h-11 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/10"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      stroke={g.color}
                      strokeWidth="3.5"
                      strokeDasharray="100, 100"
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute font-mono text-[9px] font-bold text-white">
                    {g.pct}%
                  </span>
                </div>

                <span className="font-mono text-[9px] font-semibold text-white/70">
                  {g.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </aside>
  );
}
