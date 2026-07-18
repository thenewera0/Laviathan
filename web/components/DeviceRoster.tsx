"use client";

// Which devices are connected to this session, at a glance. This browser
// is always here; the PC joins when the companion pairs; a shared device
// joins when a consent link goes live.

import { useLeviathan } from "@/lib/store";

export default function DeviceRoster() {
  const companionOnline = useLeviathan((s) => s.companionOnline);
  const media = useLeviathan((s) => s.media);
  const linkLive = media?.kind === "live";

  const devices = [
    { icon: "◉", label: "this console", on: true },
    { icon: "▣", label: "your PC", on: companionOnline },
    { icon: "◈", label: "linked device", on: linkLive },
  ].filter((d) => d.on);

  return (
    <div className="pointer-events-none absolute left-5 top-24 space-y-1">
      <p className="font-data text-[10px] uppercase tracking-[0.3em] text-foam/25">
        connected · {devices.length}
      </p>
      {devices.map((d) => (
        <p
          key={d.label}
          className="font-data text-[11px] tracking-wider text-foam/55"
        >
          <span className="text-lumen/70">{d.icon}</span> {d.label}
        </p>
      ))}
    </div>
  );
}
