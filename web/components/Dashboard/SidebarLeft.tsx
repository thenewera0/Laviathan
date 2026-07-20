"use client";

import { useEffect, useState } from "react";
import { useLeviathan } from "@/lib/store";

export default function SidebarLeft({
  activeTab,
  onSelectTab,
}: {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}) {
  const connected = useLeviathan((s) => s.connected);
  const entityState = useLeviathan((s) => s.entityState);

  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-GB", { hour12: false }));
      setDateStr(now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      id: "VOICE COMMAND",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      id: "EXECUTE",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: "DEVICES",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "AUTOMATION",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      id: "KNOWLEDGE",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      id: "MEMORY",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
    {
      id: "SYSTEM",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="pointer-events-auto absolute left-6 top-24 bottom-6 z-20 flex w-56 flex-col justify-between select-none">
      {/* Navigation Section */}
      <div className="flex flex-col gap-6">
        <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-white/35 uppercase">
          CORE INTERFACE
        </span>

        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-sm font-data text-xs tracking-[0.2em] transition-all duration-300 ${
                  isActive
                    ? "bg-[#64ffda]/10 text-[#64ffda] border-l-2 border-[#64ffda]"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span className={isActive ? "text-[#64ffda]" : "text-white/40"}>
                  {item.icon}
                </span>
                <span>{item.id}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Entity Status & Clock */}
      <div className="flex flex-col gap-6">
        {/* ENTITY STATUS Panel */}
        <div className="flex flex-col gap-2.5">
          <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-white/35 uppercase">
            ENTITY STATUS
          </span>

          <div className="bg-[#0a192f]/40 border border-[#64ffda]/20 rounded-sm flex items-center gap-3.5 p-3.5">
            {/* Status Ring */}
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className={`absolute inset-0 rounded-full border-2 ${entityState === 'error' ? 'border-red-500' : 'border-[#64ffda]'} opacity-30 animate-ping`} />
              <span className={`h-6 w-6 rounded-full border-2 ${entityState === 'error' ? 'border-red-500' : 'border-[#64ffda]'} flex items-center justify-center`}>
                <span className={`h-2 w-2 rounded-full ${entityState === 'error' ? 'bg-red-500' : 'bg-[#64ffda]'}`} />
              </span>
            </div>

            <div className="flex flex-col">
              <span className="font-data text-xs font-semibold tracking-wider text-white/90">
                LEVIATHAN CORE
              </span>
              <span className={`font-data text-[10px] tracking-wider uppercase ${entityState === 'error' ? 'text-red-500' : 'text-[#64ffda]'}`}>
                {entityState === 'error' ? 'SYSTEM ERROR' : 'ONLINE'}
              </span>
              <span className="font-data text-[9px] tracking-wide text-white/40">
                {connected ? 'All systems operational' : 'Standby mode'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Clock & Date */}
        <div className="flex flex-col gap-1 font-data text-[11px] tracking-widest text-white/40">
          <div className="flex items-center gap-2">
            <span className="text-white/25">TIME</span>
            <span className="text-white/80 font-mono">{timeStr || "19:45:32"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/25">DATE</span>
            <span className="text-white/80">{dateStr || "20 May 2025"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
