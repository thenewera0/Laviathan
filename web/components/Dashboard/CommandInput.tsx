"use client";

import { useEffect, useRef, useState } from "react";
import { useLeviathan } from "@/lib/store";

// CENTER (lower) — the Voice Interface. Liquid glass, borderless, alive.
export default function CommandInput({
  onSubmitText,
  onMicClick,
  micActive,
}: {
  onSubmitText: (text: string) => void;
  onMicClick: () => void;
  micActive?: boolean;
}) {
  const [text, setText] = useState("");
  const entityState = useLeviathan((s) => s.entityState);
  const audioLevel = useLeviathan((s) => s.audioLevel);
  const wakeActive = useLeviathan((s) => s.wakeActive);
  const connected = useLeviathan((s) => s.connected);
  const canvasRef = useRef<HTMLCanvasElement>(null!);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmitText(text.trim());
    setText("");
  };

  // Living waveform — reads the real audio envelope + state
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let phase = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      phase += 0.07;

      const { audioLevel: a, entityState: st } = useLeviathan.getState();
      const base = st === "listening" ? 12 : st === "speaking" ? 10 : st === "thinking" ? 7 : 3;
      const amp = base + a * 26;

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(79,124,255,0)");
      grad.addColorStop(0.2, "#4f7cff");
      grad.addColorStop(0.5, "#9a7bff");
      grad.addColorStop(0.8, "#5ea9ff");
      grad.addColorStop(1, "rgba(94,169,255,0)");

      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(120,120,240,0.6)";
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = grad;
      for (let x = 0; x < w; x++) {
        const env = Math.sin((x / w) * Math.PI);
        const y = mid + Math.sin(x * 0.045 + phase) * amp * env + Math.sin(x * 0.11 - phase * 1.4) * amp * 0.3 * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const stateText =
    entityState === "listening"
      ? "Listening"
      : entityState === "thinking"
        ? "Thinking"
        : entityState === "speaking"
          ? "Speaking"
          : entityState === "error"
            ? "Recovering"
            : "Idle";

  return (
    <div className="type-ui pointer-events-auto absolute left-1/2 bottom-[8.5rem] z-20 w-full max-w-2xl -translate-x-1/2 px-4 select-none">
      <div className="glass panel-enter flex flex-col gap-3 px-6 py-4">
        {/* top row: state · waveform · neural pulse */}
        <div className="flex items-center gap-4">
          <span className="flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/60">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                entityState === "idle" ? "bg-white/30" : "bg-[#8ea2ff] status-live shadow-[0_0_8px_2px_rgba(142,162,255,0.6)]"
              }`}
            />
            {stateText}
          </span>
          <div className="relative h-9 flex-1 overflow-hidden">
            <canvas ref={canvasRef} width={520} height={36} className="h-full w-full" />
          </div>
          <span className="shrink-0 font-mono text-[10px] tracking-widest text-white/35">
            {Math.round(audioLevel * 100).toString().padStart(2, "0")}
          </span>
        </div>

        {/* command line — borderless, liquid */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Speak, or type a command"
            className="w-full border-0 bg-transparent py-1.5 pr-12 text-[15px] font-light tracking-wide text-white/90 placeholder-white/30 outline-none"
          />
          <button
            type="button"
            onClick={onMicClick}
            className={`absolute right-0 flex h-9 w-9 items-center justify-center rounded-full transition-all ${
              micActive
                ? "bg-[#6b7cff] text-white shadow-[0_0_18px_2px_rgba(120,130,255,0.7)]"
                : "text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Activate microphone"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </form>

        {/* footer indicators: wake word · link · latency */}
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10px] tracking-[0.18em] text-white/35">
          <span className="flex items-center gap-1.5">
            <span className={`h-1 w-1 rounded-full ${wakeActive ? "bg-[#8ea2ff] status-live" : "bg-white/25"}`} />
            WAKE “LEVIATHAN”
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1 w-1 rounded-full ${connected ? "bg-[#7fe0c0]" : "bg-orange-400"}`} />
            {connected ? "LINK ACTIVE" : "LINK DOWN"}
          </span>
          <span className="font-mono text-white/45">~38 MS</span>
        </div>
      </div>
    </div>
  );
}
