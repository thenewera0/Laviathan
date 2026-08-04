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
    <div style={{ "--d": "430ms" } as React.CSSProperties} className="deck-in-center pointer-events-auto absolute left-1/2 bottom-28 z-20 w-full max-w-xl -translate-x-1/2 px-4 select-none">
      <form onSubmit={handleSubmit} className="relative flex items-center p-1.5 skeuo-panel rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.9)]">
        {/* Decorative Hardware Screws/Rivets */}
        <div className="skeuo-screw skeuo-screw-tl" />
        <div className="skeuo-screw skeuo-screw-tr" />
        <div className="skeuo-screw skeuo-screw-bl" />
        <div className="skeuo-screw skeuo-screw-br" />

        <div className="absolute left-6 z-30 font-mono text-xs font-bold core-lit pointer-events-none flex items-center gap-2">
          {micActive ? <ThinkingOrb state="listening" size={20} /> : "SYS_CMD >"}
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Speak or type autonomous instruction..."
          className="relative w-full rounded-xl skeuo-well pl-24 pr-16 py-4 font-data text-sm tracking-wide text-white placeholder-white/35 outline-none transition-all focus:border-[hsl(var(--core-h)_var(--core-s)_60%)]/45"
        />

        {/* Mic & Submit button */}
        <div className="absolute right-4 flex items-center gap-1.5 z-30">
          <button
            type="button"
            onClick={onMicClick}
            className={`flex h-10 w-10 items-center justify-center rounded-xl skeuo-button transition-all ${
              micActive
                ? "active core-lit"
                : "core-lit"
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
