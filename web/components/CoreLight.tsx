"use client";

import { useEffect, useRef } from "react";
import { useLeviathan, type EntityState } from "@/lib/store";

/**
 * The light source of the whole interface.
 *
 * Everything on the deck is lit BY the core rather than merely sitting next to
 * it. This writes four CSS custom properties that the backdrop, panels, keys
 * and type all read from, so a single state change re-lights the entire room:
 *
 *   --core-h      hue of the light
 *   --core-s      saturation
 *   --core-glow   0..1 intensity
 *   --core-pulse  0..1 live audio, for things that should breathe
 *
 * Values are damped per frame instead of being written on every store update —
 * a hard swap looks like a light switch, a damped one looks like a dimmer.
 * Nothing here touches the core itself; it only reads its state.
 */
const PALETTE: Record<EntityState, { h: number; s: number; glow: number }> = {
  // cold, low, patient — the deck at rest
  idle: { h: 212, s: 55, glow: 0.30 },
  // it leans in: cooler and brighter
  listening: { h: 194, s: 88, glow: 0.62 },
  // working — violet, the colour of the veins under its skin
  thinking: { h: 266, s: 78, glow: 0.70 },
  // warmth, because something is being given back
  speaking: { h: 28, s: 82, glow: 0.66 },
  // recoil
  error: { h: 4, s: 84, glow: 0.55 },
};

function damp(current: number, target: number, lambda: number, dt: number) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export default function CoreLight() {
  const raf = useRef(0);
  const last = useRef(performance.now());
  const cur = useRef({ h: 212, s: 55, glow: 0.3, pulse: 0 });

  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tick = (now: number) => {
      const dt = Math.min((now - last.current) / 1000, 0.05);
      last.current = now;

      const { entityState, audioLevel } = useLeviathan.getState();
      const t = PALETTE[entityState] ?? PALETTE.idle;

      // Hue takes the short way round the wheel so violet -> amber doesn't
      // sweep through green on the way.
      let dh = t.h - cur.current.h;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;

      const k = reduced ? 12 : 2.6;
      cur.current.h = (cur.current.h + dh * (1 - Math.exp(-k * dt)) + 360) % 360;
      cur.current.s = damp(cur.current.s, t.s, k, dt);
      cur.current.glow = damp(cur.current.glow, t.glow, k, dt);
      cur.current.pulse = damp(
        cur.current.pulse,
        reduced ? 0 : Math.min(1, audioLevel || 0),
        10,
        dt
      );

      root.style.setProperty("--core-h", cur.current.h.toFixed(1));
      root.style.setProperty("--core-s", `${cur.current.s.toFixed(1)}%`);
      root.style.setProperty("--core-glow", cur.current.glow.toFixed(3));
      root.style.setProperty("--core-pulse", cur.current.pulse.toFixed(3));

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return null;
}
