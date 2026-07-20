"use client";

import { useState } from "react";

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
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Speak or type your command"
          className="w-full rounded-full border border-indigo-500/20 bg-black/60 px-6 py-3.5 pr-14 font-data text-sm tracking-wide text-white/90 placeholder-white/35 backdrop-blur-xl outline-none transition-all duration-300 focus:border-cyan-400/50 focus:bg-black/80 focus:ring-1 focus:ring-cyan-400/30"
        />

        {/* Mic & Submit button */}
        <div className="absolute right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onMicClick}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              micActive
                ? "bg-cyan-500 text-white animate-pulse"
                : "text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Activate Microphone"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
