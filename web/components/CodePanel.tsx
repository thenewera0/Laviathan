"use client";

import { useEffect, useState } from "react";
import { useLeviathan } from "@/lib/store";

export default function CodePanel() {
  const codeProject = useLeviathan((s) => s.codeProject);
  const setCodeProject = useLeviathan((s) => s.setCodeProject);
  const [active, setActive] = useState(0);

  useEffect(() => setActive(0), [codeProject]);

  if (!codeProject || codeProject.files.length === 0) return null;
  const { project, files } = codeProject;
  const file = files[Math.min(active, files.length - 1)];

  const download = (path: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = path.split("/").pop() || "file.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="pointer-events-auto absolute left-56 lg:left-60 right-4 lg:right-6 top-20 bottom-4 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070b14]/95 shadow-2xl backdrop-blur-2xl text-foam/90 max-h-[calc(100vh-90px)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/50">
        <p className="font-data text-xs font-bold uppercase tracking-wider text-[#7dd3fc] flex items-center gap-2">
          <span>▤</span>
          <span>{project ? `PROJECT · ${project}` : "CODE WORKSPACE"}</span>
        </p>
        <div className="flex items-center gap-3 font-data text-xs">
          <button
            onClick={() => files.forEach((f) => download(f.path, f.content))}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foam/70 hover:text-foam hover:bg-white/10 transition-colors"
          >
            📥 Download All
          </button>
          <button
            onClick={() => setCodeProject(null)}
            aria-label="Close code panel"
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:text-rose-400 text-foam/60 flex items-center justify-center transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-black/30">
        {/* File Rail */}
        <div className="w-60 shrink-0 overflow-y-auto border-r border-white/10 p-2 flex flex-col gap-1 bg-black/50">
          {files.map((f, i) => (
            <button
              key={f.path}
              onClick={() => setActive(i)}
              className={`block w-full truncate px-3 py-2 rounded-lg text-left font-data text-xs transition-colors ${
                i === active
                  ? "bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#7dd3fc]"
                  : "text-foam/50 hover:bg-white/5 hover:text-foam/80"
              }`}
              title={f.path}
            >
              📄 {f.path}
            </button>
          ))}
        </div>

        {/* Code Content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-black/40">
            <span className="truncate font-mono text-xs text-[#7dd3fc]">
              {file.path}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(file.content)}
              className="px-3 py-1 rounded bg-white/10 border border-white/15 text-foam/80 hover:text-white font-data text-xs transition-colors"
            >
              COPY CODE
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed text-foam/90 bg-black/60">
            <code>{file.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
