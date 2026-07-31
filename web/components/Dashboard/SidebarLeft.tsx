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
    { id: "VOICE COMMAND", code: "01", icon: "🎙️" },
    { id: "CHAT STUDIO", code: "02", icon: "💬" },
    { id: "API KEYS", code: "03", icon: "🔑" },
    { id: "EXECUTE", code: "04", icon: "⚡" },
    { id: "DEVICES", code: "05", icon: "📱" },
    { id: "AUTOMATION", code: "06", icon: "◷" },
    { id: "KNOWLEDGE", code: "07", icon: "📚" },
    { id: "MEMORY", code: "08", icon: "⬡" },
    { id: "SYSTEM", code: "09", icon: "⚙️" },
  ];

  const isError = entityState === "error";

  return (
    <aside className="pointer-events-auto absolute left-4 lg:left-6 top-20 bottom-4 z-20 flex w-52 lg:w-56 flex-col justify-between select-none max-h-[calc(100vh-90px)] skeuo-panel p-4">
      {/* Decorative Hardware Screws/Rivets */}
      <div className="skeuo-screw skeuo-screw-tl" />
      <div className="skeuo-screw skeuo-screw-tr" />
      <div className="skeuo-screw skeuo-screw-bl" />
      <div className="skeuo-screw skeuo-screw-br" />

      {/* Navigation Section */}
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <span className="font-data text-[9px] font-bold tracking-[0.3em] text-[#00d4ff] uppercase">
            // TACTICAL SYSTEM NAV
          </span>
          <span className="font-mono text-[9px] text-white/40">SYS.v2.5</span>
        </div>

        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`group relative flex items-center justify-between rounded-xl px-3.5 py-2.5 font-data text-xs tracking-[0.08em] skeuo-button ${
                  isActive
                    ? "active text-white font-bold"
                    : "text-white/70"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={isActive ? "text-[#00d4ff] drop-shadow-[0_0_8px_#00d4ff]" : "text-white/40 group-hover:text-white"}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.id}</span>
                </div>
                <span className="font-mono text-[9px] text-white/40 group-hover:text-[#00d4ff]">
                  [{item.code}]
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Entity Status & Clock */}
      <div className="flex flex-col gap-3 pt-2 border-t border-white/10 shrink-0">
        <div className="flex flex-col gap-2">
          <div className="skeuo-well flex items-center gap-3 p-3 rounded-xl">
            <div className="skeuo-led-socket h-7 w-7 shrink-0">
              <div className={`skeuo-led h-3.5 w-3.5 ${isError ? "glowing-red" : "glowing-cyan"}`} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-data text-[11px] font-bold tracking-wider text-white truncate">
                LEVIATHAN CORE
              </span>
              <span className={`font-mono text-[9px] uppercase tracking-wider ${isError ? "text-rose-400" : "text-[#00d4ff]"}`}>
                {isError ? "SYS_ERROR" : "ONLINE // AES-256"}
              </span>
            </div>
          </div>
        </div>

        {deviceLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-data text-[9px] font-bold tracking-[0.25em] text-[#00d4ff] uppercase">
              // ACTIVE PAIRING LINKS
            </span>
            <div className="flex flex-col gap-1.5">
              {deviceLinks.map((l) => (
                <div key={l.url} className="skeuo-well flex flex-col gap-1 p-2.5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#00d4ff]">
                      {l.purpose} · LIVE
                    </span>
                    <button
                      onClick={() => copyLink(l.url)}
                      className="font-data text-[9px] uppercase tracking-wider text-white/60 transition-colors hover:text-[#00d4ff]"
                    >
                      {copiedUrl === l.url ? "copied ✓" : "copy"}
                    </button>
                  </div>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all font-mono text-[10px] leading-4 text-white/60 underline decoration-white/20 underline-offset-2 transition-colors hover:text-[#00d4ff]"
                  >
                    {l.url.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="skeuo-well flex flex-col gap-1 p-3 rounded-xl font-mono text-[10px] tracking-widest text-white/55">
          <div className="flex items-center justify-between">
            <span className="text-white/35 uppercase">SYS.TIME</span>
            <span className="font-bold text-[#00d4ff]">{timeStr || "19:45:32"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/35 uppercase">SYS.DATE</span>
            <span className="text-white/80">{dateStr || "20 May 2025"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
