"use client";

// Gesture control: an opt-in toggle, the small learnable grammar, and a
// glyph that lights up when a gesture lands. All processing is on-device.

import { useEffect, useState } from "react";
import { useLeviathan } from "@/lib/store";

const GLYPHS: Record<string, string> = {
  Open_Palm: "✋ hush",
  Closed_Fist: "✊ stop",
  Thumb_Up: "👍 yes",
  Thumb_Down: "👎 no",
  Victory: "✌ listening",
  Pointing_Up: "☝ continue",
  ILoveYou: "🤟 that's all",
};

export default function GestureLayer({
  onToggle,
}: {
  onToggle: (on: boolean) => void;
}) {
  const gesturesOn = useLeviathan((s) => s.gesturesOn);
  const lastGesture = useLeviathan((s) => s.lastGesture);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!lastGesture) return;
    setFlash(GLYPHS[lastGesture.name] ?? lastGesture.name);
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [lastGesture]);

  return (
    <>
      <div className="absolute bottom-5 left-5 flex flex-col gap-1">
        <button
          onClick={() => onToggle(!gesturesOn)}
          className={`w-fit font-data text-[11px] tracking-wider transition-colors focus-visible:text-lumen ${
            gesturesOn ? "text-lumen" : "text-foam/40 hover:text-foam/70"
          }`}
        >
          ✋ gestures {gesturesOn ? "on" : "off"}
        </button>
        {gesturesOn && (
          <p className="max-w-[260px] font-data text-[10px] leading-4 text-foam/30">
            ✋ hush · ✊ stop · 👍 yes · 👎 no · ✌ listen · ☝ continue · 🤟
            done — hands read on-device, nothing leaves this browser
          </p>
        )}
      </div>

      {flash && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
          <span className="caption-word font-data text-sm tracking-[0.3em] text-lumen/80">
            {flash}
          </span>
        </div>
      )}
    </>
  );
}
