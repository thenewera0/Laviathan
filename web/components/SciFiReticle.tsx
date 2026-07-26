"use client";

import { useEffect, useState } from "react";
import { useLeviathan } from "@/lib/store";

export default function SciFiReticle() {
  const entityState = useLeviathan((s) => s.entityState);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const stateColor =
    entityState === "listening"
      ? "text-[#22d3ee] border-[#22d3ee]"
      : entityState === "thinking"
      ? "text-[#a855f7] border-[#a855f7]"
      : entityState === "speaking"
      ? "text-[#f472b6] border-[#f472b6]"
      : "text-[#38bdf8] border-[#38bdf8]";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center select-none overflow-hidden">
      
      {/* Outer Rotating Tactical Reticle Ring */}
      <div
        className="relative flex items-center justify-center transition-all duration-700"
        style={{
          width: "min(55vw, 550px)",
          height: "min(55vw, 550px)",
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <svg className="w-full h-full opacity-30" viewBox="0 0 400 400" fill="none">
          {/* Dashed outer ring */}
          <circle
            cx="200"
            cy="200"
            r="190"
            stroke="url(#reticleGradient)"
            strokeWidth="1.5"
            strokeDasharray="8 6 2 6"
          />
          {/* Inner precision ring */}
          <circle
            cx="200"
            cy="200"
            r="165"
            stroke="url(#reticleGradient)"
            strokeWidth="1"
            strokeDasharray="40 10 90 10"
          />
          {/* Cardinal Ticks */}
          <line x1="200" y1="0" x2="200" y2="15" stroke="#22d3ee" strokeWidth="2" />
          <line x1="200" y1="385" x2="200" y2="400" stroke="#22d3ee" strokeWidth="2" />
          <line x1="0" y1="200" x2="15" y2="200" stroke="#22d3ee" strokeWidth="2" />
          <line x1="385" y1="200" x2="400" y2="200" stroke="#22d3ee" strokeWidth="2" />

          <defs>
            <linearGradient id="reticleGradient" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Static Target Bracket Overlays */}
      <div className="absolute flex items-center justify-center pointer-events-none" style={{ width: "min(48vw, 480px)", height: "min(48vw, 480px)" }}>
        {/* Top Left Bracket */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#22d3ee] shadow-[0_0_12px_#22d3ee]" />
        {/* Top Right Bracket */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#f472b6] shadow-[0_0_12px_#f472b6]" />
        {/* Bottom Left Bracket */}
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#a855f7] shadow-[0_0_12px_#a855f7]" />
        {/* Bottom Right Bracket */}
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#22d3ee] shadow-[0_0_12px_#22d3ee]" />

        {/* Telemetry Corner Labels */}
        <span className="absolute top-2 left-3 font-mono text-[9px] text-[#22d3ee]/80 tracking-widest uppercase">
          [TARGET: CORE_ORB]
        </span>
        <span className="absolute top-2 right-3 font-mono text-[9px] text-[#f472b6]/80 tracking-widest uppercase">
          FREQ: 1420.405 MHz
        </span>
        <span className="absolute bottom-2 left-3 font-mono text-[9px] text-[#a855f7]/80 tracking-widest uppercase">
          SYNC: 99.8% QUANTUM
        </span>
        <span className="absolute bottom-2 right-3 font-mono text-[9px] text-[#22d3ee]/80 tracking-widest uppercase">
          STATE: {entityState.toUpperCase()}
        </span>
      </div>

    </div>
  );
}
