"use client";

import { useLeviathan } from "@/lib/store";
import { useState } from "react";

export default function DeviceRoster({
  onRequestLink,
}: {
  onRequestLink?: (purpose: string) => void;
}) {
  const pcDevices = useLeviathan((s) => s.pcDevices);
  const deviceVitals = useLeviathan((s) => s.deviceVitals);
  const media = useLeviathan((s) => s.media);
  const linkLive = media?.kind === "live";

  const [linkPurpose, setLinkPurpose] = useState("camera input");

  const pct = (v: any) => (typeof v === "number" ? `${Math.round(v)}%` : "—");

  return (
    <div className="pointer-events-auto absolute left-56 lg:left-60 right-4 lg:right-6 top-20 bottom-4 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070b14]/95 shadow-2xl backdrop-blur-2xl text-foam/90 max-h-[calc(100vh-90px)] p-6 overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div>
          <h2 className="font-data text-lg font-bold tracking-wider text-foam flex items-center gap-2">
            <span>📱</span> CONNECTED DEVICES & MESH MESHWORK
          </h2>
          <p className="font-data text-xs text-foam/50 mt-1">
            Real-time status of paired PC companion agents, mobile cameras, and linked WebRTC devices.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/30 font-data text-xs text-[#7dd3fc]">
          <span className="h-2 w-2 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />
          <span>MESH ONLINE</span>
        </div>
      </div>

      {/* Metric Bento Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="font-data text-[10px] text-foam/40 uppercase tracking-wider">Console Host</span>
          <span className="font-data text-sm font-bold text-[#38bdf8]">Primary Dashboard</span>
          <span className="font-data text-[10px] text-emerald-400">Connected (Browser WebGL)</span>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="font-data text-[10px] text-foam/40 uppercase tracking-wider">Paired PC Companions</span>
          <span className="font-data text-sm font-bold text-[#7dd3fc]">{pcDevices.length > 0 ? pcDevices.join(", ") : "1 Machine Active"}</span>
          <span className="font-data text-[10px] text-foam/50">Companion Agent Daemon</span>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="font-data text-[10px] text-foam/40 uppercase tracking-wider">Camera & Vision Link</span>
          <span className="font-data text-sm font-bold text-purple-400">{linkLive ? "Live Stream Active" : "Standby"}</span>
          <span className="font-data text-[10px] text-foam/50">WebRTC Encrypted Peer</span>
        </div>
      </div>

      {/* Device Link Inviter Box */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 flex flex-col gap-4">
        <h3 className="font-data text-xs font-semibold text-foam/80 tracking-wider uppercase">
          Link New Mobile Device or Camera
        </h3>
        <p className="font-data text-xs text-foam/50">
          Generate an instant, secure pairing link to stream a smartphone camera, secondary display, or audio mic into Leviathan.
        </p>

        <div className="flex gap-3">
          <select
            value={linkPurpose}
            onChange={(e) => setLinkPurpose(e.target.value)}
            className="bg-black/60 border border-white/15 rounded-lg px-4 py-2.5 font-data text-xs text-foam focus:outline-none focus:border-[#38bdf8]"
          >
            <option value="camera input">📷 Phone Camera Stream</option>
            <option value="screen share">🖥️ Secondary Display Screen</option>
            <option value="microphone audio">🎙️ Remote Microphone</option>
          </select>

          <button
            onClick={() => onRequestLink?.(linkPurpose)}
            className="px-5 py-2.5 rounded-lg bg-[#38bdf8] text-black font-data text-xs font-bold hover:bg-[#7dd3fc] transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)]"
          >
            + Generate Device Pairing Link
          </button>
        </div>
      </div>

      {/* Active Device Roster Table */}
      <div className="flex flex-col gap-3">
        <h3 className="font-data text-xs font-semibold text-foam/80 tracking-wider uppercase">
          Active Device Roster
        </h3>

        <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/30">
          <table className="w-full text-left font-data text-xs">
            <thead className="bg-white/[0.04] border-b border-white/10 text-foam/50 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Device Name</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">CPU Usage</th>
                <th className="p-3.5">RAM Usage</th>
                <th className="p-3.5">Battery</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-semibold text-foam flex items-center gap-2">
                  <span className="text-[#38bdf8]">💻</span>
                  <span>Primary Console (Host Web)</span>
                </td>
                <td className="p-3.5 text-foam/60">Dashboard Client</td>
                <td className="p-3.5 font-mono text-[#7dd3fc]">{pct(deviceVitals?.cpu_percent)}</td>
                <td className="p-3.5 font-mono text-[#7dd3fc]">{pct(deviceVitals?.memory_percent)}</td>
                <td className="p-3.5 text-foam/60">{deviceVitals?.battery || "Plugged In"}</td>
                <td className="p-3.5 text-right">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    Connected
                  </span>
                </td>
              </tr>

              {pcDevices.map((pcName) => (
                <tr key={pcName} className="hover:bg-white/[0.02]">
                  <td className="p-3.5 font-semibold text-foam flex items-center gap-2">
                    <span className="text-[#7dd3fc]">🖥️</span>
                    <span>{pcName}</span>
                  </td>
                  <td className="p-3.5 text-foam/60">PC Companion Daemon</td>
                  <td className="p-3.5 font-mono text-[#7dd3fc]">{pct(deviceVitals?.cpu_percent)}</td>
                  <td className="p-3.5 font-mono text-[#7dd3fc]">{pct(deviceVitals?.memory_percent)}</td>
                  <td className="p-3.5 text-foam/60">{deviceVitals?.battery || "AC Power"}</td>
                  <td className="p-3.5 text-right">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                      Paired
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
