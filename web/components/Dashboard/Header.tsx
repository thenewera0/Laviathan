"use client";

import { useLeviathan } from "@/lib/store";

export default function Header({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const entityState = useLeviathan((s) => s.entityState);
  const userTranscript = useLeviathan((s) => s.userTranscript);
  const captionWords = useLeviathan((s) => s.captionWords);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const currentSpeech = userTranscript
    ? `"${userTranscript}"`
    : captionWords.length > 0
    ? captionWords.map((w) => w.text).join(" ")
    : entityState === "listening"
    ? "I am listening. How may I assist you?"
    : entityState === "thinking"
    ? "Processing query and executing tools..."
    : entityState === "speaking"
    ? "Transmitting response..."
    : "I am listening. How may I assist you?";

  return (
    <header className="pointer-events-auto absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-8 py-5 select-none">
      {/* Top Left Branding */}
      <div className="flex flex-col gap-0.5">
        <span className="font-voice text-xl font-bold tracking-[0.45em] celestial-text-gradient drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]">
          LEVIATHAN
        </span>
        <span className="font-data text-[9px] tracking-[0.3em] text-[#7dd3fc]/70 font-semibold uppercase">
          Autonomous AI Entity
        </span>
      </div>

      {/* Center Header Greeting & Live Status */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-voice text-2xl font-normal tracking-wide text-white drop-shadow-md">
          {getGreeting()}, <span className="celestial-text-gradient font-semibold">Akash</span>
        </h1>
        <div className="flex items-center gap-2 font-data text-xs text-[#7dd3fc]">
          <div className="flex h-3 items-center gap-0.5">
            <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-[#22d3ee]" />
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-[#a855f7] delay-75" />
            <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-[#38bdf8] delay-150" />
          </div>
          <span className="max-w-md truncate font-medium text-foam/90">{currentSpeech}</span>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 rounded-full border border-[#22d3ee]/40 bg-[#070b18]/80 px-4 py-1.5 shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#22d3ee] shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <span className="font-data text-xs font-bold tracking-wider text-[#bae6fd] uppercase">
            VOICE MODE
          </span>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-foam/70 transition-colors hover:border-[#22d3ee]/50 hover:text-white"
          aria-label="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>
    </header>
  );
}
