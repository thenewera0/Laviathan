"use client";

// Live roster of everything joined to this session — this console always,
// each paired PC by its real hostname, and any consent-linked device.
// Every row reflects an actual connection.

import { useLeviathan } from "@/lib/store";

export default function DeviceRoster() {
  const pcDevices = useLeviathan((s) => s.pcDevices);
  const media = useLeviathan((s) => s.media);
  const linkLive = media?.kind === "live";

  const rows = [
    { icon: "◉", label: "this console", tone: "text-lumen/70" },
    ...pcDevices.map((name) => ({
      icon: "▣",
      label: name,
      tone: "text-lumen/70",
    })),
    ...(linkLive
      ? [{ icon: "◈", label: "linked device", tone: "text-glint/70" }]
      : []),
  ];

  return (
    <div className="hud-enter pointer-events-none absolute left-8 top-28 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-data text-[9px] uppercase tracking-[0.35em] text-foam/25">
          mesh
        </span>
        <span className="font-data text-[10px] text-foam/40">{rows.length}</span>
      </div>
      {rows.map((r) => (
        <p
          key={r.label}
          className="font-data text-[11px] tracking-wide text-foam/60"
        >
          <span className={r.tone}>{r.icon}</span> {r.label}
        </p>
      ))}
    </div>
  );
}
