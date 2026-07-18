"use client";

// The IDE panel: when Leviathan builds something, its files appear here
// with tabs, copy, and download. The code also lands on the user's disk
// (via the companion) — this is the on-screen view of that work.

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
    <div className="absolute bottom-16 left-1/2 z-20 flex h-[62vh] w-[min(920px,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-lumen/20 bg-abyss/92 shadow-[0_0_60px_rgba(103,232,221,0.10)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-foam/10 px-4 py-2">
        <p className="font-data text-[11px] uppercase tracking-[0.25em] text-lumen/70">
          ▤ {project ? `project · ${project}` : "code"}
        </p>
        <div className="flex items-center gap-3 font-data text-[11px]">
          <button
            onClick={() => files.forEach((f) => download(f.path, f.content))}
            className="text-foam/60 transition-colors hover:text-lumen"
          >
            download all
          </button>
          <button
            onClick={() => setCodeProject(null)}
            aria-label="Close code panel"
            className="text-foam/40 transition-colors hover:text-lumen"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* file rail */}
        <div className="w-52 shrink-0 overflow-y-auto border-r border-foam/10 py-1">
          {files.map((f, i) => (
            <button
              key={f.path}
              onClick={() => setActive(i)}
              className={`block w-full truncate px-3 py-1.5 text-left font-data text-[11px] transition-colors ${
                i === active
                  ? "bg-lumen/10 text-lumen"
                  : "text-foam/50 hover:text-foam/80"
              }`}
              title={f.path}
            >
              {f.path}
            </button>
          ))}
        </div>

        {/* code */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-foam/5 px-4 py-1.5">
            <span className="truncate font-data text-[11px] text-foam/40">
              {file.path}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(file.content)}
              className="font-data text-[11px] text-foam/50 transition-colors hover:text-lumen"
            >
              copy
            </button>
          </div>
          <pre className="flex-1 overflow-auto px-4 py-3 font-data text-[12px] leading-5 text-foam/85">
            <code>{file.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
