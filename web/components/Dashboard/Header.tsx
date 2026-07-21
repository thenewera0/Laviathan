"use client";

import { useLeviathan } from "@/lib/store";

export default function Header({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const entityState = useLeviathan((s) => s.entityState);
  const userTranscript = useLeviathan((s) => s.userTranscript);
  const captionWords = useLeviathan((s) => s.captionWords);

  // Dynamic greeting based on current time
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
    <header className="type-ui pointer-events-auto absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-10 py-7 select-none">
      {/* Top Left Branding */}
      <div className="flex flex-col gap-1">
        <span className="text-lg font-thin tracking-[0.5em] text-white/90">
          LEVIATHAN
        </span>
        <span className="text-[10px] font-light tracking-[0.3em] text-white/35">
          Autonomous AI Entity
        </span>
      </div>

      {/* Center Header Greeting & Live Status */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-thin tracking-[0.06em] text-white/95">
          {getGreeting()}, Akash
        </h1>
        <div className="flex items-center gap-2 font-data text-xs text-[#a99cf5]/90">
          {/* Animated sound wave icon */}
          <div className="flex h-3 items-center gap-0.5">
            <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-[#60a5fa]" />
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-[#8f7bf0] delay-75" />
            <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-[#a855f7] delay-150" />
          </div>
          <span className="max-w-md truncate">{currentSpeech}</span>
        </div>
      </div>

      {/* Top Right Controls (Voice Mode badge & Settings) */}
      <div className="flex items-center gap-3">
        <div className="glass flex items-center gap-2 !rounded-full px-4 py-2">
          <svg className="h-3.5 w-3.5 text-[#8ea2ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
          </svg>
          <span className="text-[11px] font-light uppercase tracking-[0.2em] text-white/75">
            Voice Mode
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8ea2ff] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8ea2ff]" />
          </span>
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="glass flex h-10 w-10 items-center justify-center !rounded-2xl text-white/60 transition-colors hover:text-white"
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
