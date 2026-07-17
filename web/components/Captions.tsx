"use client";

// Bottom-center captions. Leviathan's speech condenses word by word in a
// light serif; your own words read back in quiet mono while you speak.

import { useLeviathan } from "@/lib/store";

export default function Captions() {
  const captionWords = useLeviathan((s) => s.captionWords);
  const userTranscript = useLeviathan((s) => s.userTranscript);
  const entityState = useLeviathan((s) => s.entityState);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-col items-center gap-3 px-8">
      {userTranscript && entityState === "listening" && (
        <p className="max-w-xl text-center font-data text-[13px] tracking-wide text-foam/50">
          {userTranscript}
        </p>
      )}

      {entityState === "thinking" && (
        <p className="font-data text-[12px] uppercase tracking-[0.35em] text-lumen/40">
          descending
          <span className="status-live">…</span>
        </p>
      )}

      {captionWords.length > 0 && (
        <p className="max-w-2xl text-center font-voice text-2xl font-light italic leading-relaxed text-foam md:text-3xl">
          {captionWords.map((w) => (
            <span key={w.id} className="caption-word">
              {w.text}&nbsp;
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
