"use client";

/**
 * The chassis Leviathan sits in.
 *
 * Replaces the old fullscreen WebGL liquid-metal shader, which tracked the
 * cursor and ran a second GL context underneath the core's canvas. This is
 * pure CSS — no shader, no rAF loop, no pointer listener — so the GPU budget
 * belongs entirely to the core.
 *
 * Read as: machined graphite deck, cold rim light, engraved grid, deep vignette.
 */
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base: brushed graphite, lit from high-left like a real enclosure */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 18% -10%, #16202e 0%, #0b111a 42%, #05080d 72%, #020305 100%)",
        }}
      />

      {/* Engraved grid — etched into the deck, fading with distance */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,160,210,0.055) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(120,160,210,0.055) 1px, transparent 1px)",
          backgroundSize: "62px 62px",
          maskImage:
            "radial-gradient(105% 80% at 50% 42%, #000 8%, rgba(0,0,0,0.45) 46%, transparent 82%)",
          WebkitMaskImage:
            "radial-gradient(105% 80% at 50% 42%, #000 8%, rgba(0,0,0,0.45) 46%, transparent 82%)",
        }}
      />

      {/* Fine machining grain — breaks up the flat gradient */}
      <div
        className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.030) 0px, rgba(255,255,255,0.030) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Cold rim light along the top edge — the enclosure catching light */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, rgba(90,150,220,0.11) 0%, rgba(90,150,220,0.03) 38%, transparent 100%)",
        }}
      />

      {/* Warm floor bounce under the core, so it reads as standing on something */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 118%, rgba(60,120,190,0.14) 0%, transparent 70%)",
        }}
      />

      {/* Deep vignette — pulls the eye to the centre */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(115% 92% at 50% 46%, transparent 42%, rgba(0,0,0,0.55) 82%, rgba(0,0,0,0.82) 100%)",
        }}
      />
    </div>
  );
}
