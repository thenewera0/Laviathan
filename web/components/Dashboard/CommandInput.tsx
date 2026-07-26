"use client";

import { useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

export default function CommandInput({
  onSubmitText,
  onMicClick,
  micActive,
}: {
  onSubmitText: (text: string) => void;
  onMicClick: () => void;
  micActive?: boolean;
}) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmitText(text.trim());
    setText("");
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 bottom-28 z-20 w-full max-w-xl -translate-x-1/2 px-4 select-none">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        {/* Soft aura behind the pill */}
        <div className="pointer-events-none absolute -inset-1.5 rounded-full bg-gradient-to-r from-[#00d4ff]/35 via-[#0099ff]/30 to-[#f59e0b]/25 blur-xl" />
        <div className="absolute left-5 z-30 font-mono text-xs font-bold text-[#00d4ff] pointer-events-none flex items-center gap-2">
          {micActive ? <ThinkingOrb state="listening" size={20} /> : "SYS_CMD >"}
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Speak or type autonomous instruction..."
          className="relative w-full rounded-full border border-[#00d4ff]/40 bg-[#080d1c]/95 pl-24 pr-14 py-4 font-data text-sm tracking-wide text-white placeholder-white/40 shadow-[0_10px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl outline-none transition-all duration-300 focus:border-[#00d4ff] focus:ring-2 focus:ring-[#00d4ff]/30"
        />

        {/* Mic & Submit button */}
        <div className="absolute right-3 flex items-center gap-1.5 z-30">
          <button
            type="button"
            onClick={onMicClick}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
              micActive
                ? "animate-pulse bg-gradient-to-r from-[#00d4ff] via-[#0099ff] to-[#f59e0b] text-white shadow-[0_0_22px_rgba(0,212,255,0.8)]"
                : "text-[#00d4ff] hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Activate Microphone"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
