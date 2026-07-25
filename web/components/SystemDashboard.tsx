"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/apiConfig";
import { useLeviathan } from "@/lib/store";

interface ProviderStats {
  state: string;
  current_rpm: number;
  max_rpm: number;
  utilization_pct: number;
}

export default function SystemDashboard() {
  const [gatewayStats, setGatewayStats] = useState<Record<string, ProviderStats>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const connected = useLeviathan((s) => s.connected);
  const deviceVitals = useLeviathan((s) => s.deviceVitals);
  const audioLevel = useLeviathan((s) => s.audioLevel);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetchApi("/v1/gateway/stats");
      if (res.ok) {
        const data = await res.json();
        setGatewayStats(data.providers || {});
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.error("Failed to load gateway stats", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const pct = (v: any) => (typeof v === "number" ? `${Math.round(v)}%` : "—");

  return (
    <div className="pointer-events-auto absolute left-56 lg:left-60 right-4 lg:right-6 top-20 bottom-4 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070b14]/95 shadow-2xl backdrop-blur-2xl text-foam/90 max-h-[calc(100vh-90px)] p-6 overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div>
          <h2 className="font-data text-lg font-bold tracking-wider text-foam flex items-center gap-2">
            <span>⚙️</span> SYSTEM CORE & AI GATEWAY DIAGNOSTICS
          </h2>
          <p className="font-data text-xs text-foam/50 mt-1">
            Real-time telemetry, rate budget utilization, multi-provider circuit states, and hardware vitals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="font-mono text-[10px] text-foam/40">
              Refreshed: {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foam/70 hover:text-foam hover:bg-white/10 font-data text-xs transition-colors"
          >
            {loading ? "Refreshing..." : "🔄 Refresh Stats"}
          </button>
        </div>
      </div>

      {/* Primary Vitals Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="font-data text-[10px] text-foam/40 uppercase tracking-wider">WebSocket Gateway</span>
          <span className={`font-data text-sm font-bold ${connected ? "text-emerald-400" : "text-rose-400"}`}>
            {connected ? "Connected (Live WS)" : "Standby Mode"}
          </span>
          <span className="font-data text-[10px] text-foam/40">Port 8000 / Engine Core</span>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="font-data text-[10px] text-foam/40 uppercase tracking-wider">CPU Utilization</span>
          <span className="font-data text-sm font-bold text-[#38bdf8] font-mono">{pct(deviceVitals?.cpu_percent)}</span>
          <span className="font-data text-[10px] text-foam/40">Host Machine Process</span>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="font-data text-[10px] text-foam/40 uppercase tracking-wider">Memory Allocation</span>
          <span className="font-data text-sm font-bold text-[#7dd3fc] font-mono">{pct(deviceVitals?.memory_percent)}</span>
          <span className="font-data text-[10px] text-foam/40">RAM Buffer Capacity</span>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="font-data text-[10px] text-foam/40 uppercase tracking-wider">Audio Mic Bitrate</span>
          <span className="font-data text-sm font-bold text-purple-400 font-mono">{Math.round((audioLevel || 0) * 100)} RMS</span>
          <span className="font-data text-[10px] text-foam/40">Web Speech Engine</span>
        </div>
      </div>

      {/* AI Provider Circuit Breaker Telemetry */}
      <div className="flex flex-col gap-3 mb-6">
        <h3 className="font-data text-xs font-semibold text-foam/80 tracking-wider uppercase flex items-center justify-between">
          <span>AI Gateway Multi-Provider Circuit Breakers</span>
          <span className="text-[10px] text-emerald-400 font-mono">Auto-Failover Active</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { id: "gemini", name: "Google Gemini 2.5 Flash", defaultMax: 12 },
            { id: "groq", name: "Groq Llama 3.3 70B & Qwen", defaultMax: 25 },
            { id: "openrouter", name: "OpenRouter DeepSeek Pool", defaultMax: 45 },
            { id: "mistral", name: "Mistral Small Engine", defaultMax: 25 },
            { id: "cohere", name: "Cohere Command-R+", defaultMax: 10 },
            { id: "huggingface", name: "Hugging Face Inference", defaultMax: 20 },
          ].map((provider) => {
            const stat = gatewayStats[provider.id] || {
              state: "CLOSED",
              current_rpm: 0,
              max_rpm: provider.defaultMax,
              utilization_pct: 0,
            };

            const isCircuitOpen = stat.state === "OPEN";

            return (
              <div
                key={provider.id}
                className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-data text-xs font-semibold text-foam">{provider.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      isCircuitOpen
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {stat.state}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-data text-[10px] text-foam/50">
                    <span>RPM Utilization</span>
                    <span className="font-mono">{stat.current_rpm} / {stat.max_rpm} RPM</span>
                  </div>

                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#38bdf8] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, stat.utilization_pct || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
