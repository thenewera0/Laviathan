"use client";

import { useEffect, useState } from "react";

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
  const [error, setError] = useState("");

  const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_LEVIATHAN_API || "http://localhost:8000") : "http://localhost:8000";

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/keys`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (e) {
      console.error("Failed to load API keys", e);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerateKey = async () => {
    if (!newLabel.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/keys/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedKey(data.key_info.key);
        setNewLabel("");
        fetchKeys();
      } else {
        setError("Failed to generate API key");
      }
    } catch (e) {
      setError("Backend connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="glass-panel pointer-events-auto absolute left-64 right-6 top-24 bottom-6 z-20 flex flex-col p-6 overflow-y-auto text-foam/90">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div>
          <h2 className="font-data text-lg font-bold tracking-wider text-foam">LEVIATHAN AI GATEWAY — API KEYS</h2>
          <p className="font-data text-xs text-foam/50 mt-1">
            Single-channel API key to power your external AI apps & websites. Failover rate-limit routing included.
          </p>
        </div>
        <span className="font-data text-xs px-3 py-1 rounded bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#7dd3fc]">
          ACTIVE GATEWAY
        </span>
      </div>

      {/* Key Generation Section */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 flex flex-col gap-4">
        <h3 className="font-data text-sm font-semibold text-foam/80 tracking-wide uppercase">Generate New Secret Key</h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Key Label (e.g. My Website, Sales Bot, App Gateway)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 font-data text-xs text-foam placeholder:text-foam/30 focus:outline-none focus:border-[#38bdf8]"
          />
          <button
            onClick={handleGenerateKey}
            disabled={loading || !newLabel.trim()}
            className="px-5 py-2.5 rounded-lg bg-[#38bdf8] text-black font-data text-xs font-semibold hover:bg-[#7dd3fc] transition-all disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Key"}
          </button>
        </div>

        {error && <p className="text-xs text-rose-400 font-data">{error}</p>}

        {createdKey && (
          <div className="mt-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex flex-col gap-2">
            <span className="font-data text-xs text-emerald-400 font-semibold uppercase tracking-wider">
              NEW API KEY CREATED — Save it safely!
            </span>
            <div className="flex items-center justify-between bg-black/50 p-3 rounded font-mono text-xs text-emerald-300">
              <span>{createdKey}</span>
              <button
                onClick={() => copyToClipboard(createdKey)}
                className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 rounded transition-colors text-xs"
              >
                {copiedKey ? "COPIED ✓" : "COPY KEY"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keys Table */}
      <div className="flex flex-col gap-3 mb-8">
        <h3 className="font-data text-sm font-semibold text-foam/80 tracking-wide uppercase">Active Internal Keys</h3>
        <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/20">
          <table className="w-full text-left font-data text-xs">
            <thead className="bg-white/[0.05] border-b border-white/10 text-foam/60 uppercase tracking-wider">
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
                    No keys generated yet. Use the form above to generate your first API key.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-white/[0.02]">
                    <td className="p-3.5 font-medium text-foam/90">{k.label}</td>
                    <td className="p-3.5 font-mono text-foam/60">{k.prefix}</td>
                    <td className="p-3.5 text-foam/50">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${k.revoked ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
                        {k.revoked ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {!k.revoked && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-xs text-rose-400/70 hover:text-rose-400 transition-colors uppercase tracking-wider"
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

      {/* Integration Code Snippet */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 flex flex-col gap-3">
        <h3 className="font-data text-sm font-semibold text-foam/80 tracking-wide uppercase">Integration Code Snippet</h3>
        <p className="font-data text-xs text-foam/50">
          Use your generated key in `X-API-Key` header to route requests to Leviathan Gateway:
        </p>

        <div className="bg-black/60 border border-white/10 rounded-lg p-4 font-mono text-xs text-foam/80 space-y-2 overflow-x-auto">
          <div className="text-[#38bdf8]">// cURL Request</div>
          <div>{`curl -X POST http://localhost:8000/v1/chat \\`}</div>
          <div>{`  -H "X-API-Key: YOUR_GENERATED_LVH_KEY" \\`}</div>
          <div>{`  -H "Content-Type: application/json" \\`}</div>
          <div>{`  -d '{"prompt": "Hello Leviathan", "model": "gemini-2.5-flash"}'`}</div>
        </div>
      </div>
    </div>
  );
}
