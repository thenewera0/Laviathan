"use client";

/**
 * Chassis corners.
 *
 * Previously this also painted a full-screen `scifi-grid`, which fought with
 * the Backdrop's engraved grid — two grids at different scales over the same
 * pixels. The grid now lives in exactly one place, and these read as milled
 * corner brackets on the enclosure rather than glowing HUD neon.
 */
const CORNER = "absolute h-7 w-7 border-[#8fb4dd]/22";

export default function HudFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
      <div className={`${CORNER} left-3 top-3 rounded-tl-md border-l border-t`} />
      <div className={`${CORNER} right-3 top-3 rounded-tr-md border-r border-t`} />
      <div className={`${CORNER} bottom-3 left-3 rounded-bl-md border-b border-l`} />
      <div className={`${CORNER} bottom-3 right-3 rounded-br-md border-b border-r`} />
    </div>
  );
}
