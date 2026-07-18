"use client";

// The instrument frame: a faint atmospheric grid and four corner brackets
// that frame the entity like the viewport of a deep-sea console. Pure
// chrome — no state, no interaction, sits behind everything.

export default function HudFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div className="hud-grid" />
      {(
        [
          "left-4 top-4 border-l border-t",
          "right-4 top-4 border-r border-t",
          "left-4 bottom-4 border-l border-b",
          "right-4 bottom-4 border-r border-b",
        ] as const
      ).map((pos) => (
        <span
          key={pos}
          className={`hud-bracket absolute h-8 w-8 border-lumen/50 ${pos}`}
        />
      ))}
    </div>
  );
}
