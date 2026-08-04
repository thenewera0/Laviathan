"use client";

export default function QuickActions({
  onAction,
}: {
  onAction: (prompt: string) => void;
}) {
  const actions = [
    {
      title: "FOCUS MODE",
      subtitle: "Minimize distractions",
      prompt: "Enable focus mode and clear active notifications.",
      icon: (
        <svg className="w-5 h-5 text-[#7fb2e0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
    {
      title: "DEEP WORK",
      subtitle: "AI concentration",
      prompt: "Initiate deep work session.",
      icon: (
        <svg className="w-5 h-5 text-[#7fb2e0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      title: "QUICK TASK",
      subtitle: "Execute instantly",
      prompt: "What task can I help you execute right now?",
      icon: (
        <svg className="w-5 h-5 text-[#7fb2e0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      title: "SYSTEM SCAN",
      subtitle: "Check all vitals",
      prompt: "Run a complete system scan and report vitals.",
      icon: (
        <svg className="w-5 h-5 text-[#7fb2e0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: "SMART ROUTINES",
      subtitle: "Automate life",
      prompt: "Show active smart routines.",
      icon: (
        <svg className="w-5 h-5 text-[#7fb2e0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    // A single machined key strip rather than five floating cards. The
    // subtitle only appears on hover — showing both lines for all five at
    // once was most of the visual noise down here.
    <div className="pointer-events-auto absolute left-1/2 bottom-5 z-20 -translate-x-1/2 select-none">
      <div className="skeuo-panel flex items-center gap-1 px-2 py-2">
        {actions.map((act, i) => (
          <div key={act.title} className="flex items-center">
            {i > 0 && <div className="mx-1 h-9 w-px bg-black/70 shadow-[1px_0_0_rgba(255,255,255,0.04)]" />}
            <button
              onClick={() => onAction(act.prompt)}
              title={act.subtitle}
              className="skeuo-button group flex h-[52px] w-[104px] flex-col items-center justify-center gap-1 rounded-xl px-2"
            >
              <span className="opacity-80 transition-opacity duration-200 group-hover:opacity-100">
                {act.icon}
              </span>
              <span className="skeuo-etch font-data text-[9px] font-semibold leading-none transition-colors duration-200 group-hover:text-[#9fd8ff]">
                {act.title}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
