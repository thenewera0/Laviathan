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
  const deviceLinks = useLeviathan((s) => s.deviceLinks);

  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");

  const copyLink = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(""), 1600);
    });
  };

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
      id: "CHAT STUDIO",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: "API KEYS",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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

  const isError = entityState === "error";

  return (
    <aside className="pointer-events-auto absolute left-4 lg:left-6 top-20 bottom-4 z-20 flex w-52 lg:w-56 flex-col justify-between select-none max-h-[calc(100vh-90px)]">
      {/* Navigation Section */}
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
        <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-foam/35 uppercase">
          Core Interface
        </span>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-data text-xs tracking-[0.18em] transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-r from-[#22d3ee]/25 via-[#a855f7]/15 to-transparent text-white font-semibold border-l-2 border-[#22d3ee] shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                    : "text-foam/50 hover:bg-white/[0.05] hover:text-foam"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#22d3ee] shadow-[0_0_12px_#22d3ee]" />
                )}
                <span className={isActive ? "text-[#22d3ee] drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "text-foam/40 group-hover:text-foam/80"}>
                  {item.icon}
                </span>
                <span className="truncate">{item.id}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Entity Status & Clock */}
      <div className="flex flex-col gap-3 pt-2 border-t border-white/10 shrink-0">
        <div className="flex flex-col gap-2">
          <div className="glass-panel flex items-center gap-3 p-3">
            <div className="relative flex h-7 w-7 items-center justify-center shrink-0">
              <span className={`status-live absolute inset-0 rounded-full border ${isError ? "border-rose-500" : "border-[#38bdf8]"} opacity-40`} />
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${isError ? "border-rose-500" : "border-[#38bdf8]"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isError ? "bg-rose-500" : "bg-[#38bdf8]"} shadow-[0_0_8px_2px_rgba(56,189,248,0.7)]`} />
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-data text-[11px] font-semibold tracking-wider text-foam/90 truncate">
                LEVIATHAN CORE
              </span>
              <span className={`font-data text-[9px] uppercase tracking-wider ${isError ? "text-rose-400" : "text-[#7dd3fc]"}`}>
                {isError ? "System Error" : "Online"}
              </span>
            </div>
          </div>
        </div>

        {deviceLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-data text-[10px] font-semibold tracking-[0.3em] text-foam/35 uppercase">
              Device Links
            </span>
            <div className="flex flex-col gap-1.5">
              {deviceLinks.map((l) => (
                <div key={l.url} className="glass-panel flex flex-col gap-1 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-data text-[9px] uppercase tracking-[0.2em] text-[#7dd3fc]">
                      {l.purpose} · active
                    </span>
                    <button
                      onClick={() => copyLink(l.url)}
                      className="font-data text-[9px] uppercase tracking-wider text-foam/50 transition-colors hover:text-[#38bdf8]"
                    >
                      {copiedUrl === l.url ? "copied ✓" : "copy"}
                    </button>
                  </div>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all font-data text-[10px] leading-4 text-foam/55 underline decoration-white/10 underline-offset-2 transition-colors hover:text-[#38bdf8]"
                  >
                    {l.url.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-white/[0.06] pt-4 font-data text-[11px] tracking-widest text-foam/40">
          <div className="flex items-center gap-2">
            <span className="w-9 text-foam/25">TIME</span>
            <span className="font-mono text-foam/80">{timeStr || "19:45:32"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-9 text-foam/25">DATE</span>
            <span className="text-foam/80">{dateStr || "20 May 2025"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
