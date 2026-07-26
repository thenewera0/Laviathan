"use client";

export default function HudFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
      {/* Sci-Fi Fluid Grid Overlay */}
      <div className="scifi-grid" />

      {/* Extreme Outer Edge Hairpin HUD Brackets — Clean, zero-text overlap */}
      <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#00d4ff]/60 shadow-[0_0_10px_rgba(0,212,255,0.3)]" />
      <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#00d4ff]/60 shadow-[0_0_10px_rgba(0,212,255,0.3)]" />
      <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-[#f59e0b]/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
      <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-[#00d4ff]/60 shadow-[0_0_10px_rgba(0,212,255,0.3)]" />
    </div>
  );
}
