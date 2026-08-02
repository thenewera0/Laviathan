"use client";

import { useEffect, useState } from "react";
import { useLeviathan } from "@/lib/store";
import { fetchApi } from "@/lib/apiConfig";

type LibraryWorkflow = {
  id: string;
  name: string;
  category: string;
  trigger_type: string;
  integrations: string[];
  github_raw_url: string;
};

type LibraryCategory = { name: string; count: number };

export default function SchedulesPanel({
  onClose,
  onRefresh,
  onCancel,
}: {
  onClose: () => void;
  onRefresh: () => void;
  onCancel: (id: string) => void;
}) {
  const schedules = useLeviathan((s) => s.schedules);
  const [activeSubTab, setActiveSubTab] = useState<"schedules" | "n8n" | "library">("schedules");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<string | null>(null);
  const [deployOk, setDeployOk] = useState(true);

  const [workflows, setWorkflows] = useState<LibraryWorkflow[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [librarySize, setLibrarySize] = useState<number | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real category list, loaded once the Library tab is first opened.
  useEffect(() => {
    if (activeSubTab !== "library" || categories.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchApi("/v1/workflows/categories");
        const data = await res.json();
        if (cancelled) return;
        setCategories(data.categories ?? []);
        setLibrarySize(data.total_workflows ?? null);
      } catch {
        if (!cancelled) setLibraryError("Couldn't reach the Leviathan backend.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSubTab, categories.length]);

  // Debounced, server-ranked search over the real catalog.
  useEffect(() => {
    if (activeSubTab !== "library") return;
    let cancelled = false;
    setLoadingLibrary(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchQuery, limit: "40" });
        if (selectedCategory !== "All") params.set("category", selectedCategory);
        const res = await fetchApi(`/v1/workflows/search?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        setWorkflows(data.workflows ?? []);
        if (data.library_size) setLibrarySize(data.library_size);
        setLibraryError(null);
      } catch {
        if (!cancelled) setLibraryError("Couldn't reach the Leviathan backend.");
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activeSubTab, searchQuery, selectedCategory]);

  const popularCategories = ["All", ...categories.slice(0, 14).map((c) => c.name)];

  const handleDeploy = async (wf: LibraryWorkflow) => {
    setDeployingId(wf.id);
    setDeployOk(true);
    setDeployStatus(`Importing "${wf.name}" into n8n…`);
    try {
      const res = await fetchApi("/v1/workflows/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wf.id, github_raw_url: wf.github_raw_url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDeployOk(false);
        setDeployStatus(data?.detail || `Deploy failed (HTTP ${res.status}).`);
      } else {
        setDeployOk(true);
        // The backend distinguishes "imported and running" from "imported but
        // needs credentials" — surface whichever actually happened.
        setDeployStatus(data.message || `Imported "${wf.name}".`);
      }
    } catch {
      setDeployOk(false);
      setDeployStatus("Couldn't reach the Leviathan backend to deploy.");
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <div className="pointer-events-auto absolute left-56 lg:left-60 right-4 lg:right-6 top-20 bottom-4 z-30 flex flex-col overflow-hidden skeuo-panel shadow-2xl text-foam/90 max-h-[calc(100vh-90px)] p-1">
      {/* Decorative Hardware Screws/Rivets */}
      <div className="skeuo-screw skeuo-screw-tl" />
      <div className="skeuo-screw skeuo-screw-tr" />
      <div className="skeuo-screw skeuo-screw-bl" />
      <div className="skeuo-screw skeuo-screw-br" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/35 rounded-t-2xl select-none">
        <div className="flex items-center gap-4 font-data text-xs">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab("schedules")}
              className={`px-4 py-2 rounded-xl skeuo-button font-data text-[10px] uppercase tracking-wider ${
                activeSubTab === "schedules" ? "active text-white font-bold" : "text-white/60"
              }`}
            >
              ◷ Schedules & Routines
            </button>
            <button
              onClick={() => setActiveSubTab("n8n")}
              className={`px-4 py-2 rounded-xl skeuo-button font-data text-[10px] uppercase tracking-wider ${
                activeSubTab === "n8n" ? "active text-white font-bold" : "text-white/60"
              }`}
            >
              ⛓ n8n Studio
            </button>
            <button
              onClick={() => setActiveSubTab("library")}
              className={`px-4 py-2 rounded-xl skeuo-button font-data text-[10px] uppercase tracking-wider ${
                activeSubTab === "library" ? "active text-white font-bold bg-[#ff6d5a]/20 border-[#ff6d5a]/50 text-[#ff6d5a]" : "text-white/60"
              }`}
            >
              ⚡ Workflow Library{librarySize ? ` (${librarySize.toLocaleString()})` : ""}
            </button>
          </div>
          {activeSubTab === "schedules" && (
            <span className="px-2 py-1.5 rounded skeuo-well text-[#7dd3fc] font-mono text-[10px] tracking-wider">
              {schedules.length} RUNNING TASKS
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-data text-xs">
          {activeSubTab === "schedules" && (
            <button
              onClick={onRefresh}
              className="px-3.5 py-2 rounded-xl skeuo-button text-foam/80 hover:text-foam transition-all font-bold text-[10px] uppercase tracking-wider"
            >
              🔄 Refresh
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl skeuo-button text-foam/60 flex items-center justify-center transition-all font-bold text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Sub-tab viewports */}
      {activeSubTab === "schedules" ? (
        <div className="flex-1 space-y-2.5 overflow-y-auto p-6 bg-black/10 skeuo-well skeuo-screen rounded-b-2xl m-3 border-t border-white/5">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-foam/40 gap-3 py-12 select-none">
              <span className="text-3xl">🔗</span>
              <p className="font-data text-xs max-w-md">
                Nothing scheduled yet. You can speak commands like <span className="text-[#7dd3fc]">&quot;remind me in 20 minutes to submit code&quot;</span> or <span className="text-[#7dd3fc]">&quot;every morning at 8, brief me&quot;</span> to create automated routines.
              </p>
            </div>
          ) : (
            schedules.map((it) => (
              <div
                key={it.id}
                className="group flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.01] p-4 hover:border-[#38bdf8]/40 hover:bg-white/[0.03] transition-all"
              >
                <div className="flex flex-col gap-1 font-data text-xs leading-relaxed text-foam/90">
                  <span className="text-[#7dd3fc] font-mono text-[9px] uppercase tracking-wider font-semibold">
                    {it.kind === "routine" ? `DAILY ROUTINE · ${it.at_time}` : `ONE-TIME · ${(it.fire_at || "").slice(11, 16)}`}
                  </span>
                  <span className="font-medium text-foam">{it.text}</span>
                </div>
                <button
                  onClick={() => onCancel(it.id)}
                  title="Cancel schedule"
                  className="shrink-0 px-3.5 py-2 rounded-xl skeuo-button font-data text-[10px] text-rose-400 hover:text-rose-300 transition-all uppercase tracking-wider font-semibold"
                >
                  Cancel
                </button>
              </div>
            ))
          )}
        </div>
      ) : activeSubTab === "n8n" ? (
        <div className="flex-1 flex flex-col overflow-y-auto skeuo-well rounded-b-2xl m-3 border-t border-white/5">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/60 font-mono text-[10px] text-white/55 select-none shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
              <span className="font-bold tracking-wider">N8N WORKFLOW ENGINE: ONLINE</span>
            </div>
            <span className="text-white/30">Powered by n8n · Self-hosted on Render</span>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 select-none">
            {/* Hero launch area */}
            <div className="flex flex-col items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ff6d5a] to-[#ff4f1f] flex items-center justify-center shadow-[0_0_40px_rgba(255,79,31,0.3)]">
                <span className="text-4xl">⛓</span>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-foam tracking-wide mb-2">n8n Workflow Studio</h2>
                <p className="text-foam/50 font-data text-xs max-w-md leading-relaxed">
                  Build multi-step automations connecting 400+ apps and services.
                  Design workflows visually, trigger them via webhooks, schedules, or Leviathan voice commands.
                </p>
              </div>
              <a
                href="https://leviathan-n8n.onrender.com"
                target="_blank"
                rel="noreferrer"
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#ff6d5a] to-[#ff4f1f] text-white font-bold text-sm tracking-wider uppercase shadow-[0_4px_20px_rgba(255,79,31,0.4)] hover:shadow-[0_6px_30px_rgba(255,79,31,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                ↗ Open n8n Studio
              </a>
            </div>

            {/* Capabilities grid */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {[
                { icon: "🎙️", title: "Voice Control", desc: "Ask Leviathan to create workflows" },
                { icon: "⚡", title: `${librarySize ? librarySize.toLocaleString() : "2,000+"} Workflows`, desc: "Access the ultimate library" },
                { icon: "🔁", title: "Scheduled Triggers", desc: "Cron, webhook, event-based" },
                { icon: "🤖", title: "AI-Powered", desc: "Leviathan deploys automations for you" },
              ].map((cap) => (
                <div
                  key={cap.title}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 hover:border-[#ff6d5a]/30 hover:bg-white/[0.03] transition-all"
                >
                  <span className="text-lg shrink-0">{cap.icon}</span>
                  <div className="font-data text-[10px] leading-relaxed">
                    <span className="block text-foam font-bold tracking-wider uppercase">{cap.title}</span>
                    <span className="block text-foam/40 mt-0.5">{cap.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Connection info */}
            <div className="flex items-center gap-4 text-[10px] font-mono text-white/30">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                leviathan-n8n.onrender.com
              </span>
              <span>•</span>
              <span>Port 5678</span>
              <span>•</span>
              <span>Singapore Region</span>
            </div>
          </div>
        </div>
      ) : (
        /* WORKFLOW LIBRARY SUB-TAB */
        <div className="flex-1 flex flex-col overflow-hidden skeuo-well rounded-b-2xl m-3 border-t border-white/5 p-4 gap-4">
          {/* Top search & status bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/40 p-3.5 rounded-xl border border-white/5">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder={`Search ${librarySize ? librarySize.toLocaleString() : ""} production-ready n8n workflows...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#ff6d5a]/50 font-data"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-white/40 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-foam/60 shrink-0">
              <span>📚 {librarySize ? librarySize.toLocaleString() : "—"} Index</span>
              <span>•</span>
              <span>{categories.length || "—"} Integrations</span>
            </div>
          </div>

          {/* Category Pill Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {popularCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-data text-[10px] uppercase tracking-wider shrink-0 transition-all ${
                  selectedCategory === cat
                    ? "bg-[#ff6d5a] text-white font-bold shadow-[0_0_12px_rgba(255,109,90,0.4)]"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Deploy Notification */}
          {deployStatus && (
            <div
              className={`px-4 py-2.5 rounded-xl text-xs font-data flex items-start justify-between gap-3 animate-fade-in border ${
                deployOk
                  ? "bg-[#ff6d5a]/10 border-[#ff6d5a]/30 text-[#ff6d5a]"
                  : "bg-amber-500/10 border-amber-500/40 text-amber-300"
              }`}
            >
              <span className="leading-relaxed">{deployStatus}</span>
              <button onClick={() => setDeployStatus(null)} className="text-white/40 hover:text-white shrink-0">✕</button>
            </div>
          )}

          {libraryError && (
            <div className="bg-amber-500/10 border border-amber-500/40 px-4 py-2.5 rounded-xl text-xs font-data text-amber-300">
              {libraryError}
            </div>
          )}

          {/* Workflow Cards Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loadingLibrary && workflows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-data text-foam/40">
                Loading workflows…
              </div>
            ) : workflows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-data text-foam/40">
                {libraryError ? "Library unavailable." : `No workflows match "${searchQuery}".`}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {workflows.map((wf) => (
                  <div
                    key={`${wf.id}-${wf.github_raw_url}`}
                    className="flex flex-col justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-[#ff6d5a]/40 hover:bg-white/[0.04] transition-all group"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#ff6d5a]/20 border border-[#ff6d5a]/30 text-[#ff6d5a] font-mono text-[9px] uppercase font-bold">
                          {wf.category}
                        </span>
                        <span className="text-white/40 font-mono text-[9px] uppercase">
                          ⚡ {wf.trigger_type}
                        </span>
                      </div>
                      <h3 className="font-bold text-xs text-foam group-hover:text-[#ff6d5a] transition-colors leading-snug">
                        {wf.name}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(wf.integrations ?? []).map((integ) => (
                          <span
                            key={integ}
                            className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-foam/60 font-mono text-[9px]"
                          >
                            {integ}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                      <a
                        href={wf.github_raw_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono text-white/40 hover:text-white/80 transition-colors"
                      >
                        View Source ↗
                      </a>
                      <button
                        onClick={() => handleDeploy(wf)}
                        disabled={deployingId === wf.id}
                        className="px-4 py-1.5 rounded-xl bg-[#ff6d5a] hover:bg-[#ff4f1f] text-white font-bold font-data text-[10px] uppercase tracking-wider shadow-[0_2px_10px_rgba(255,109,90,0.3)] transition-all disabled:opacity-50"
                      >
                        {deployingId === wf.id ? "Deploying..." : "⚡ Deploy to n8n"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

