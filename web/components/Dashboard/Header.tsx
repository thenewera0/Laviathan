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
      {/* Top Left Branding: Physical Metallic Badge */}
      <div className="skeuo-panel px-4 py-2 rounded-xl flex flex-col gap-0.5 min-w-[170px] shadow-lg">
        {/* Decorative rivets */}
        <div className="skeuo-screw skeuo-screw-tl" style={{ top: "4px", left: "4px", width: "5px", height: "5px" }} />
        <div className="skeuo-screw skeuo-screw-tr" style={{ top: "4px", right: "4px", width: "5px", height: "5px" }} />
        <div className="skeuo-screw skeuo-screw-bl" style={{ bottom: "4px", left: "4px", width: "5px", height: "5px" }} />
        <div className="skeuo-screw skeuo-screw-br" style={{ bottom: "4px", right: "4px", width: "5px", height: "5px" }} />
        <span className="font-voice text-lg font-bold tracking-[0.45em] celestial-text-gradient drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">
          LEVIATHAN
        </span>
        <span className="font-data text-[8px] tracking-[0.3em] text-[#00d4ff]/90 font-semibold uppercase">
          Autonomous AI Entity
        </span>
      </div>

      {/* Center Header Greeting & Live Status Monitor Panel */}
      <div className="skeuo-panel px-6 py-2.5 rounded-2xl flex flex-col items-center gap-1 shadow-[0_10px_35px_rgba(0,0,0,0.85)] max-w-xl">
        {/* Decorative corner screws */}
        <div className="skeuo-screw skeuo-screw-tl" style={{ top: "5px", left: "5px", width: "5px", height: "5px" }} />
        <div className="skeuo-screw skeuo-screw-tr" style={{ top: "5px", right: "5px", width: "5px", height: "5px" }} />
        <div className="skeuo-screw skeuo-screw-bl" style={{ bottom: "5px", left: "5px", width: "5px", height: "5px" }} />
        <div className="skeuo-screw skeuo-screw-br" style={{ bottom: "5px", right: "5px", width: "5px", height: "5px" }} />
        
        <h1 className="font-voice text-xl font-normal tracking-wide text-white drop-shadow-md">
          {getGreeting()}, <span className="celestial-text-gradient font-bold">Akash</span>
        </h1>
        
        {/* Recessed display screen for the live transcription stream */}
        <div className="skeuo-well skeuo-screen rounded-lg px-4 py-1.5 flex items-center gap-2.5 font-data text-xs text-[#7dd3fc] w-full min-w-[280px] max-w-md justify-center border-t border-white/5">
          <div className="flex h-3 items-center gap-0.5">
            <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-[#00d4ff]" />
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-[#0099ff] delay-75" />
            <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-[#f59e0b] delay-150" />
          </div>
          <span className="max-w-xs truncate font-medium text-[#7dd3fc] drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]">
            {currentSpeech}
          </span>
        </div>
      </div>

      {/* Top Right Controls: Emissive LED Socket & Mechanical Buttons */}
      <div className="flex items-center gap-3">
        <div className="skeuo-panel px-4 py-2 rounded-xl flex items-center gap-2.5 border-t border-white/5 shadow-md">
          <div className="skeuo-led-socket h-5 w-5 shrink-0">
            <div className="skeuo-led glowing-cyan h-2.5 w-2.5" />
          </div>
          <span className="font-data text-[10px] font-bold tracking-wider text-[#7dd3fc] uppercase">
            VOICE MODE
          </span>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="skeuo-button flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:text-[#00d4ff]"
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
