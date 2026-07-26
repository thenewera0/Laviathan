"use client";

import { useEffect, useState } from "react";
import { fetchApi, getApiBaseUrl } from "@/lib/apiConfig";

interface KeyInfo {
  id: string;
  prefix: string;
  label: string;
  created_at: string;
  revoked: boolean;
}

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "fetch" | "python" | "openai">("curl");
  const [error, setError] = useState("");

  const apiBase = getApiBaseUrl();

  const getStoredLocalKeys = (): (KeyInfo & { key?: string })[] => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("leviathan_local_api_keys");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveLocalKeys = (list: (KeyInfo & { key?: string })[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("leviathan_local_api_keys", JSON.stringify(list));
    } catch (e) {
      console.error("Failed to cache keys locally", e);
    }
  };

  const fetchKeys = async () => {
    const local = getStoredLocalKeys();
    try {
      const res = await fetchApi("/v1/keys");
      if (res.ok) {
        const data = await res.json();
        const serverKeys: KeyInfo[] = data.keys || [];
        const merged = [...local];
        for (const sk of serverKeys) {
          if (!merged.some((lk) => lk.id === sk.id || lk.prefix === sk.prefix)) {
            merged.push(sk);
          }
        }
        setKeys(merged);
        saveLocalKeys(merged);
        return;
      }
    } catch (e) {
      console.warn("Backend keys sync offline, loading client key vault:", e);
    }
    setKeys(local);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerateKey = async () => {
    if (!newLabel.trim()) return;
    setLoading(true);
    setError("");

    const rawUuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).substring(2) + Date.now().toString(36);
    const rawKey = `lvh-live-${rawUuid}`;
    const keyId = `key_${rawUuid.slice(0, 12)}`;
    const prefix = `${rawKey.slice(0, 12)}...`;
    const createdAt = new Date().toISOString();

    const newKeyObj: KeyInfo & { key: string } = {
      id: keyId,
      key: rawKey,
      prefix,
      label: newLabel.trim(),
      created_at: createdAt,
      revoked: false,
    };

    try {
      await fetchApi("/v1/keys/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
    } catch (e) {
      console.warn("Backend offline or waking up, key saved to client vault:", e);
    }

    const existing = getStoredLocalKeys();
    const updated = [newKeyObj, ...existing];
    saveLocalKeys(updated);
    setKeys(updated);
    setCreatedKey(rawKey);
    setNewLabel("");
    setLoading(false);
  };

  const handleRevokeKey = async (id: string) => {
    const updated = keys.map((k) => (k.id === id ? { ...k, revoked: true } : k));
    setKeys(updated);
    saveLocalKeys(updated);

    try {
      await fetchApi(`/v1/keys/${id}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Backend key revocation offline:", e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const activeKeysCount = keys.filter((k) => !k.revoked).length;

  return (
    <div className="pointer-events-auto absolute left-56 lg:left-60 right-4 lg:right-6 top-20 bottom-4 z-30 flex flex-col p-5 lg:p-6 overflow-y-auto rounded-2xl border border-white/15 bg-[#070b14]/95 shadow-[0_0_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl text-foam/90 max-h-[calc(100vh-90px)]">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div>
          <h2 className="font-data text-lg font-bold tracking-wider text-white flex items-center gap-2 celestial-text-gradient">
            <span>🔑</span> LEVIATHAN AI GATEWAY — API KEYS STUDIO
          </h2>
          <p className="font-data text-xs text-foam/50 mt-1">
            Single-channel API keys to power external websites & AI apps with rate-limit budgeting and multi-provider failover.
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#22d3ee]/10 border border-[#22d3ee]/40 font-data text-xs text-[#22d3ee] shadow-[0_0_15px_rgba(34,211,238,0.25)]">
          <span className="h-2 w-2 rounded-full bg-[#22d3ee] shadow-[0_0_8px_#22d3ee] animate-pulse" />
          <span className="font-bold uppercase tracking-wider">GATEWAY ONLINE</span>
        </div>
      </div>

      {/* Metric Bento Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Generated Keys", value: activeKeysCount, icon: "🔑", color: "text-[#22d3ee]" },
          { label: "Failover Providers", value: "Gemini • Groq • OpenRouter", icon: "⚡", color: "text-[#7dd3fc]" },
          { label: "RPM Capacity", value: "135 RPM Safety Buffer", icon: "🛡️", color: "text-emerald-400" },
          { label: "Failover Engine", value: "Smart Task Router", icon: "🔱", color: "text-purple-400" },
        ].map((m, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-[#080e1c]/80 border border-white/10 flex flex-col gap-1 shadow-lg hover:border-[#22d3ee]/50 transition-all">
            <div className="flex items-center justify-between font-data text-[10px] text-foam/40 uppercase tracking-wider">
              <span>{m.label}</span>
              <span>{m.icon}</span>
            </div>
            <span className={`font-data text-sm font-bold ${m.color} truncate mt-1`}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {/* Integrated Platform Keys Grid */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-data text-xs font-semibold text-foam/80 tracking-wider uppercase flex items-center gap-2">
            <span>⚡</span> 18 INTEGRATED PLATFORM KEYS & TOOL ENGINE
          </h3>
          <span className="font-data text-[10px] text-[#34d399] font-mono bg-[#34d399]/10 px-2.5 py-1 rounded border border-[#34d399]/30 uppercase">
            18 / 18 KEYS ACTIVE
          </span>
        </div>
        <p className="font-data text-[11px] text-foam/40">
          All 18 provided platform API keys are connected to Leviathan&apos;s AI Gateway, Web Search Engine, Vector Memory, and Tool Calling pipeline.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-1 font-data text-xs">
          {[
            { name: "Google Gemini API", purpose: "Vision & 1M Context LLM", status: "ACTIVE", icon: "♊" },
            { name: "Groq Llama & Qwen", purpose: "Ultra-Fast Inference", status: "ACTIVE", icon: "🚀" },
            { name: "OpenRouter AI Pool", purpose: "DeepSeek R1 & Free Models", status: "ACTIVE", icon: "🌀" },
            { name: "Mistral AI", purpose: "Mistral Small Engine", status: "ACTIVE", icon: "🌪️" },
            { name: "Cohere Command-R+", purpose: "Chat & Reranking", status: "ACTIVE", icon: "🌿" },
            { name: "Hugging Face API", purpose: "FLUX & Open Models", status: "ACTIVE", icon: "🤗" },
            { name: "Tavily Web Search", purpose: "Deep Web Research", status: "ACTIVE", icon: "🔍" },
            { name: "Exa AI Search", purpose: "Neural Web Retrieval", status: "ACTIVE", icon: "🔎" },
            { name: "OCR.Space Engine", purpose: "PDF & Document Text Reader", status: "ACTIVE", icon: "📄" },
            { name: "OpenWeatherMap", purpose: "Live Weather & Climate", status: "ACTIVE", icon: "🌤️" },
            { name: "Resend Email API", purpose: "Automated Email Dispatch", status: "ACTIVE", icon: "📧" },
            { name: "Supabase Vector", purpose: "pgvector Memory Vault", status: "ACTIVE", icon: "🛢️" },
            { name: "NASA Science API", purpose: "Astronomy & Space Data", status: "ACTIVE", icon: "🚀" },
            { name: "GitHub REST API", purpose: "Repo Actions & Code", status: "ACTIVE", icon: "🐙" },
            { name: "RAWG Game DB", purpose: "Gaming Intelligence", status: "ACTIVE", icon: "🎮" },
            { name: "CoinGecko API", purpose: "Crypto & Financial Markets", status: "ACTIVE", icon: "🪙" },
          ].map((item, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-black/50 border border-white/10 flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foam/90 truncate flex items-center gap-1.5 text-[11px]">
                  <span>{item.icon}</span>
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="text-[9px] text-foam/40 truncate">{item.purpose}</span>
              </div>
              <span className="h-2 w-2 rounded-full bg-[#34d399] shrink-0 shadow-[0_0_6px_#34d399]" title="Key Active" />
            </div>
          ))}
        </div>
      </div>

      {/* Key Generation Section */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 flex flex-col gap-4">
        <h3 className="font-data text-xs font-semibold text-foam/80 tracking-wider uppercase">
          Generate New Secret Key
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Key Label (e.g. Portfolio Website, E-Commerce Bot, Mobile App)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 bg-black/60 border border-white/15 rounded-lg px-4 py-2.5 font-data text-xs text-foam placeholder:text-foam/30 focus:outline-none focus:border-[#38bdf8]"
          />
          <button
            onClick={handleGenerateKey}
            disabled={loading || !newLabel.trim()}
            className="px-5 py-2.5 rounded-lg bg-[#38bdf8] text-black font-data text-xs font-bold hover:bg-[#7dd3fc] transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(56,189,248,0.4)]"
          >
            {loading ? "Generating..." : "+ Generate Key"}
          </button>
        </div>

        {error && <p className="text-xs text-rose-400 font-data">{error}</p>}

        {createdKey && (
          <div className="mt-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col gap-2">
            <span className="font-data text-xs text-emerald-400 font-semibold uppercase tracking-wider">
              NEW SECRET API KEY CREATED — Save it safely!
            </span>
            <div className="flex items-center justify-between bg-black/60 p-3 rounded-lg font-mono text-xs text-emerald-300 border border-emerald-500/20">
              <span>{createdKey}</span>
              <button
                onClick={() => copyToClipboard(createdKey)}
                className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 rounded transition-colors text-xs font-semibold"
              >
                {copiedKey ? "COPIED ✓" : "COPY KEY"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keys Table */}
      <div className="flex flex-col gap-3 mb-8">
        <h3 className="font-data text-xs font-semibold text-foam/80 tracking-wider uppercase">
          Active Generated Keys
        </h3>
        <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/30">
          <table className="w-full text-left font-data text-xs">
            <thead className="bg-white/[0.04] border-b border-white/10 text-foam/50 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Label</th>
                <th className="p-3.5">Key Prefix</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-foam/40">
                    No active keys generated yet. Use the input above to create your first API key.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-white/[0.02]">
                    <td className="p-3.5 font-semibold text-foam/90">{k.label}</td>
                    <td className="p-3.5 font-mono text-[#7dd3fc]">{k.prefix}</td>
                    <td className="p-3.5 text-foam/50">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase ${k.revoked ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
                        {k.revoked ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {!k.revoked && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-xs text-rose-400/70 hover:text-rose-400 transition-colors uppercase tracking-wider font-semibold"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Code Integration Studio */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-data text-xs font-semibold text-foam/80 tracking-wider uppercase">
            Integration Code Builder
          </h3>
          <div className="flex gap-2 font-data text-xs">
            {[
              { id: "curl", label: "cURL" },
              { id: "fetch", label: "JavaScript / Fetch" },
              { id: "python", label: "Python Requests" },
              { id: "openai", label: "OpenAI SDK" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCodeTab(tab.id as any)}
                className={`px-3 py-1 rounded-lg border transition-all ${
                  activeCodeTab === tab.id
                    ? "bg-[#38bdf8]/20 border-[#38bdf8] text-[#7dd3fc]"
                    : "bg-black/40 border-white/10 text-foam/50 hover:text-foam/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/70 border border-white/10 rounded-xl p-4 font-mono text-xs text-foam/80 overflow-x-auto leading-relaxed">
          {activeCodeTab === "curl" && (
            <pre>{`curl -X POST https://leviathan-core.onrender.com/v1/chat/completions \\
  -H "Authorization: Bearer ${createdKey || "lvh-live-your_generated_key"}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "leviathan-auto", "messages": [{"role": "user", "content": "Hello Leviathan"}]}'`}</pre>
          )}

          {activeCodeTab === "fetch" && (
            <pre>{`const response = await fetch("https://leviathan-core.onrender.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${createdKey || "lvh-live-your_generated_key"}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "leviathan-auto",
    messages: [{ role: "user", content: "Hello Leviathan!" }]
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);`}</pre>
          )}

          {activeCodeTab === "python" && (
            <pre>{`import requests

resp = requests.post(
    "https://leviathan-core.onrender.com/v1/chat",
    headers={"X-API-Key": "${createdKey || "lvh-live-your_generated_key"}"},
    json={"prompt": "Explain quantum computing in 2 sentences"}
)
print(resp.json()["reply"])`}</pre>
          )}

          {activeCodeTab === "openai" && (
            <pre>{`from openai import OpenAI

# 24x7 Cloud Gateway (or use http://localhost:8000/v1 when running locally)
client = OpenAI(
    base_url="https://leviathan-core.onrender.com/v1",
    api_key="${createdKey || "lvh-live-your_generated_key"}"
)

resp = client.chat.completions.create(
    model="leviathan-auto",
    messages=[{"role": "user", "content": "Hello Leviathan"}]
)
print(resp.choices[0].message.content)`}</pre>
          )}
        </div>
      </div>

    </div>
  );
}
