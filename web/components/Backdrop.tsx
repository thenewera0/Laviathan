"use client";

/**
 * The room the core stands in.
 *
 * Pure CSS — no shader, no rAF loop, no pointer listener, so the GPU budget
 * belongs entirely to the core. Every warm layer reads --core-* from
 * <CoreLight>, so the whole room re-lights when Leviathan changes state:
 * cool blue while it listens, violet while it thinks, warm while it speaks.
 */
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Deck: machined graphite, lit from high-left like a real enclosure */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 18% -10%, #131c29 0%, #0a0f18 44%, #04070c 74%, #010204 100%)",
        }}
      />

      {/* Volumetric spill FROM the core — the hero light of the scene */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background:
            "radial-gradient(58% 46% at 50% 44%," +
            "hsl(var(--core-h) var(--core-s) 62% / calc(var(--core-glow) * 0.30)) 0%," +
            "hsl(var(--core-h) var(--core-s) 55% / calc(var(--core-glow) * 0.12)) 34%," +
            "transparent 72%)",
        }}
      />

      {/* Bounce off the deck beneath it, so the core reads as standing on something */}
      <div
        className="absolute inset-x-0 bottom-0 h-3/5"
        style={{
          background:
            "radial-gradient(62% 100% at 50% 116%," +
            "hsl(var(--core-h) var(--core-s) 58% / calc(var(--core-glow) * 0.34)) 0%," +
            "transparent 68%)",
        }}
      />

      {/* Engraved grid, etched into the deck and fading with distance */}
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(150,185,225,0.05) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(150,185,225,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(100% 78% at 50% 44%, #000 6%, rgba(0,0,0,0.4) 44%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(100% 78% at 50% 44%, #000 6%, rgba(0,0,0,0.4) 44%, transparent 80%)",
        }}
      />

      {/* Cold rim light catching the top edge of the enclosure */}
      <div
        className="absolute inset-x-0 top-0 h-44"
        style={{
          background:
            "linear-gradient(180deg, rgba(120,170,230,0.10) 0%, rgba(120,170,230,0.025) 40%, transparent 100%)",
        }}
      />

      {/* Fine machining grain — keeps the gradients from banding */}
      <div
        className="absolute inset-0 opacity-[0.30] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Deep cinematic vignette — crushes the corners, pulls the eye centre */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(118% 94% at 50% 46%, transparent 38%, rgba(0,0,0,0.62) 80%, rgba(0,0,0,0.88) 100%)",
        }}
      />
    </div>
  );
}
