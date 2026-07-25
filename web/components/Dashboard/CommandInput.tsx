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
        {/* soft aura behind the pill */}
        <div className="pointer-events-none absolute -inset-1.5 rounded-full bg-gradient-to-r from-[#f472b6]/35 via-[#c084fc]/30 to-[#38bdf8]/35 blur-xl" />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Speak or type your command..."
          className="relative w-full rounded-full border border-[#f472b6]/40 bg-[#0f172a]/95 px-6 py-4 pr-14 font-data text-sm tracking-wide text-white placeholder-white/45 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl outline-none transition-all duration-300 focus:border-[#c084fc] focus:ring-2 focus:ring-[#f472b6]/30"
        />

        {/* Mic & Submit button */}
        <div className="absolute right-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onMicClick}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
              micActive
                ? "animate-pulse bg-gradient-to-r from-[#f472b6] via-[#c084fc] to-[#38bdf8] text-white shadow-[0_0_22px_rgba(244,114,182,0.8)]"
                : "text-[#f472b6] hover:bg-white/10 hover:text-white"
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
