"use client";

import { useState } from "react";
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
    <header className="pointer-events-auto absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-8 py-6 select-none">
      {/* Top Left Branding */}
      <div className="flex flex-col gap-0.5">
        <span className="font-voice text-xl font-light tracking-[0.45em] text-white/90">
          LEVIATHAN
        </span>
        <span className="font-data text-[10px] tracking-[0.25em] text-white/40">
          Autonomous AI Entity
        </span>
      </div>

      {/* Center Header Greeting & Live Status */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-voice text-xl font-light tracking-wide text-white/90">
          {getGreeting()}, Akash
        </h1>
        <div className="flex items-center gap-2 font-data text-xs text-indigo-300/80">
          {/* Animated sound wave icon */}
          <div className="flex items-center gap-0.5 h-3">
            <span className="w-0.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
            <span className="w-0.5 h-3 bg-purple-400 rounded-full animate-pulse delay-75" />
            <span className="w-0.5 h-1.5 bg-blue-400 rounded-full animate-pulse delay-150" />
          </div>
          <span className="max-w-md truncate">{currentSpeech}</span>
        </div>
      </div>

      {/* Top Right Controls (Voice Mode badge & Settings) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-black/40 px-3.5 py-1.5 backdrop-blur-md">
          {/* Sound wave icon */}
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
          </svg>
          <span className="font-data text-[11px] font-medium tracking-widest text-white/80 uppercase">
            VOICE MODE
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:border-white/20 hover:text-white"
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
