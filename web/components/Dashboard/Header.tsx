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
        <span className="font-voice text-xl font-bold tracking-[0.45em] celestial-text-gradient drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">
          LEVIATHAN
        </span>
        <span className="font-data text-[9px] tracking-[0.3em] text-[#00d4ff]/90 font-semibold uppercase">
          Autonomous AI Entity
        </span>
      </div>

      {/* Center Header Greeting & Live Status */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-voice text-2xl font-normal tracking-wide text-white drop-shadow-md">
          {getGreeting()}, <span className="celestial-text-gradient font-bold">Akash</span>
        </h1>
        <div className="flex items-center gap-2 font-data text-xs text-[#7dd3fc]">
          <div className="flex h-3 items-center gap-0.5">
            <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-[#00d4ff]" />
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-[#0099ff] delay-75" />
            <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-[#f59e0b] delay-150" />
          </div>
          <span className="max-w-md truncate font-medium text-white/90">{currentSpeech}</span>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 rounded-full border border-[#00d4ff]/50 bg-[#080d1c]/90 px-4 py-1.5 shadow-[0_0_22px_rgba(0,212,255,0.4)] backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#00d4ff] shadow-[0_0_10px_#00d4ff] animate-pulse" />
          <span className="font-data text-xs font-bold tracking-wider text-[#7dd3fc] uppercase">
            VOICE MODE
          </span>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#080d1c]/90 text-white/70 hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all"
            title="System Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 16v-2m6-8h2M4 12H2m15.364 6.364l1.414 1.414M6.343 6.343L4.929 4.929m12.728 0l1.414 1.414M6.343 17.657l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
