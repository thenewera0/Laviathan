"use client";

export default function HudFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden">
      {/* Sci-Fi Tactical Grid Overlay */}
      <div className="scifi-grid" />

      {/* Top Hairline Scale Ticks */}
      <div className="absolute top-0 left-0 right-0 h-1 flex justify-between px-12 opacity-40">
        <div className="h-full w-32 bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent" />
        <div className="flex gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="h-1.5 w-0.5 bg-[#f472b6]" />
          ))}
        </div>
        <div className="h-full w-32 bg-gradient-to-r from-transparent via-[#a855f7] to-transparent" />
      </div>

      {/* 4 Laser Chamfered Corner HUD Brackets */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 border-t-2 border-l-2 border-[#22d3ee] p-2 pl-2.5 pt-1.5 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="font-mono text-[9px] font-bold text-[#22d3ee] tracking-widest">
          SYS.HUD_v4.8 // ALPHA
        </span>
        <span className="font-mono text-[8px] text-white/40">GRID: #8809-X9</span>
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-1 border-t-2 border-r-2 border-[#f472b6] p-2 pr-2.5 pt-1.5 shadow-[0_0_15px_rgba(244,114,182,0.4)]">
        <span className="font-mono text-[9px] font-bold text-[#f472b6] tracking-widest">
          SECTOR 07 // DEEP SPACE
        </span>
        <span className="font-mono text-[8px] text-white/40">FLUX: 1.2ms</span>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-1 border-b-2 border-l-2 border-[#a855f7] p-2 pl-2.5 pb-1.5 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
        <span className="font-mono text-[9px] font-bold text-[#a855f7] tracking-widest">
          ENCRYPTION: AES-256 GCM
        </span>
        <span className="font-mono text-[8px] text-white/40">GATEWAY: ACTIVE</span>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1 border-b-2 border-r-2 border-[#22d3ee] p-2 pr-2.5 pb-1.5 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
        <span className="font-mono text-[9px] font-bold text-[#22d3ee] tracking-widest">
          NEURAL LINK // READY
        </span>
        <span className="font-mono text-[8px] text-white/40">MODE: AUTONOMOUS</span>
      </div>

      {/* Subtle Scanline Animation Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-15 pointer-events-none" />
    </div>
  );
}
