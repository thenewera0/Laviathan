"use client";

import { useEffect, useRef, useState } from "react";

interface FileAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
  files?: FileAttachment[];
  timestamp: string;
  codeSnippet?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}

export default function ChatStudio() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("auto");
  const [mode, setMode] = useState<"chat" | "canvas" | "research" | "guided">("chat");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [personalIntelligence, setPersonalIntelligence] = useState(true);
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_LEVIATHAN_API || "http://localhost:8000") : "http://localhost:8000";

  // Load chat history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("leviathan_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewChat();
        }
      } catch (e) {
        createNewChat();
      }
    } else {
      createNewChat();
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("leviathan_chat_sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  // Scroll to bottom of message stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, currentSessionId, loading]);

  const createNewChat = () => {
    const newId = `chat_${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "New Conversation",
      updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setCanvasContent(null);
    setIsCanvasOpen(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id);
      } else {
        createNewChat();
      }
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId) || {
    id: "",
    title: "",
    updatedAt: "",
    messages: [],
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${API_BASE}/v1/upload`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              url: data.url,
              size: file.size,
              type: file.type,
            },
          ]);
        }
      } catch (err) {
        console.error("File upload error", err);
      }
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const promptText = customPrompt || input;
    if ((!promptText.trim() && attachments.length === 0) || loading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: promptText.trim(),
      files: [...attachments],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const isFirstMsg = currentSession.messages.length === 0;
    const newTitle = isFirstMsg ? (promptText.slice(0, 32) || "File Attachment Context") : currentSession.title;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              title: newTitle,
              messages: [...s.messages, userMessage],
            }
          : s
      )
    );

    if (!customPrompt) setInput("");
    setAttachments([]);
    setIsToolsOpen(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: promptText.trim(),
          model: selectedModel === "auto" ? undefined : selectedModel,
          system_prompt: `You are Leviathan AI Studio in ${mode.toUpperCase()} mode. Deliver expert, clean, structured code and markdown answers.`,
        }),
      });

      const data = await res.json();
      const replyText = data.reply || "No response from gateway.";

      // Extract code block for split canvas view if present
      const codeMatch = replyText.match(/```(?:\w+)?\n([\s\S]*?)```/);
      let extractedCode = undefined;
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1];
        setCanvasContent(extractedCode);
        setIsCanvasOpen(true);
      }

      const aiMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: replyText,
        provider: data.provider || "gateway",
        model: data.model || selectedModel,
        codeSnippet: extractedCode,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, aiMessage] }
            : s
        )
      );
    } catch (e) {
      const errorMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: "Unable to reach Leviathan Gateway. Please verify backend service status.",
        provider: "error",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, errorMsg] }
            : s
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const copyCanvas = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const exportChat = () => {
    const text = currentSession.messages
      .map((m) => `[${m.timestamp}] ${m.role.toUpperCase()}:\n${m.content}\n`)
      .join("\n---\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentSession.title.replace(/\s+/g, "_")}.md`;
    a.click();
  };

  return (
    <div className="pointer-events-auto absolute left-64 right-6 top-24 bottom-6 z-30 flex overflow-hidden rounded-2xl border border-white/15 bg-[#070b14]/95 shadow-[0_0_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl text-foam/90">
      
      {/* ------------------------------------------------ Left Sidebar */}
      <div className="w-64 border-r border-white/10 bg-black/60 flex flex-col justify-between p-3.5 select-none shrink-0">
        <div className="flex flex-col gap-3">
          
          {/* New Chat Button */}
          <button
            onClick={createNewChat}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#38bdf8]/20 via-[#38bdf8]/10 to-transparent border border-[#38bdf8]/40 px-4 py-3 font-data text-xs font-semibold tracking-wider text-[#bae6fd] hover:border-[#38bdf8] hover:shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all"
          >
            <span className="text-base font-normal">+</span>
            <span>NEW CHAT</span>
          </button>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 font-data text-[11px] text-foam placeholder:text-foam/30 focus:outline-none focus:border-[#38bdf8]"
            />
          </div>

          {/* Mode Switcher */}
          <div className="flex flex-col gap-1 border-y border-white/10 py-2.5 my-0.5">
            <span className="font-data text-[9px] uppercase tracking-[0.25em] text-foam/35 px-2">Studio Modes</span>
            {[
              { id: "chat", name: "Chat Studio", icon: "💬" },
              { id: "canvas", name: "Canvas Split", icon: "🎨" },
              { id: "research", name: "Deep Research", icon: "🔍" },
              { id: "guided", name: "Guided Learning", icon: "🎓" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id as any);
                  if (m.id === "canvas") setIsCanvasOpen(true);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-data text-xs transition-all ${
                  mode === m.id
                    ? "bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#7dd3fc]"
                    : "text-foam/50 hover:bg-white/5 hover:text-foam/80"
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.name}</span>
              </button>
            ))}
          </div>

          {/* Chat History List */}
          <div className="flex flex-col gap-1">
            <span className="font-data text-[9px] uppercase tracking-[0.25em] text-foam/35 px-2">Recent History</span>
            <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-420px)] pr-1">
              {filteredSessions.length === 0 ? (
                <span className="font-data text-[10px] text-foam/30 px-2 py-1">No chats found.</span>
              ) : (
                filteredSessions.map((s) => {
                  const active = s.id === currentSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setCurrentSessionId(s.id)}
                      className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg font-data text-xs cursor-pointer transition-all ${
                        active
                          ? "bg-gradient-to-r from-[#38bdf8]/20 to-transparent border-l-2 border-[#38bdf8] text-[#bae6fd]"
                          : "text-foam/60 hover:bg-white/5 hover:text-foam/90"
                      }`}
                    >
                      <span className="truncate pr-3">{s.title}</span>
                      <button
                        onClick={(e) => deleteChat(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-foam/40 hover:text-rose-400 transition-opacity font-bold"
                        title="Delete Chat"
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Labs Toggle */}
        <div className="border-t border-white/10 pt-3 flex items-center justify-between px-2 font-data text-xs text-foam/40">
          <span>Personal Labs</span>
          <button
            onClick={() => setPersonalIntelligence(!personalIntelligence)}
            className={`w-8 h-4 rounded-full transition-colors relative ${personalIntelligence ? "bg-[#38bdf8]" : "bg-white/20"}`}
          >
            <span className={`w-3 h-3 bg-black rounded-full absolute top-0.5 transition-transform ${personalIntelligence ? "left-4.5" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ Main Workspace */}
      <div className="flex-1 flex flex-col justify-between bg-black/30 overflow-hidden relative">
        
        {/* Top Action & Telemetry Bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 bg-black/50 backdrop-blur-md">
          <div className="flex items-center gap-3 font-data text-xs">
            <span className="h-2 w-2 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />
            <span className="font-semibold text-foam/90 tracking-wider">LEVIATHAN AI STUDIO</span>
            <span className="text-foam/30">|</span>
            <span className="text-[#7dd3fc]/80 font-mono text-[11px] uppercase">
              {mode} Mode
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Selector Pill */}
            <div className="flex items-center gap-2 bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 font-data text-xs">
              <span className="text-foam/40">Router:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-[#7dd3fc] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="auto" className="bg-gray-900 text-white">Auto-Route (Smart Failover)</option>
                <option value="gemini-2.5-flash" className="bg-gray-900 text-white">Google Gemini 2.5 Flash</option>
                <option value="llama-3.3-70b-versatile" className="bg-gray-900 text-white">Groq Llama 3.3 70B</option>
                <option value="meta-llama/llama-3.3-70b-instruct:free" className="bg-gray-900 text-white">OpenRouter Free Pool</option>
                <option value="mistral-small-latest" className="bg-gray-900 text-white">Mistral Small</option>
              </select>
            </div>

            {/* Canvas Toggle Button */}
            <button
              onClick={() => setIsCanvasOpen(!isCanvasOpen)}
              className={`px-3 py-1.5 rounded-lg border font-data text-xs transition-all ${
                isCanvasOpen
                  ? "bg-[#38bdf8]/20 border-[#38bdf8] text-[#7dd3fc]"
                  : "bg-white/5 border-white/10 text-foam/60 hover:bg-white/10"
              }`}
            >
              🎨 Canvas {isCanvasOpen ? "ON" : "OFF"}
            </button>

            {/* Export Button */}
            {currentSession.messages.length > 0 && (
              <button
                onClick={exportChat}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foam/60 hover:text-foam hover:bg-white/10 font-data text-xs transition-all"
              >
                📥 Export
              </button>
            )}
          </div>
        </div>

        {/* Workspace Body: Split Screen when Canvas is open */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main Messages Thread */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            
            {/* Empty State: Bento Prompt Starters */}
            {currentSession.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto gap-8 my-auto select-none">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-[#38bdf8]/10 border border-[#38bdf8]/30 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(56,189,248,0.2)]">
                    🔱
                  </div>
                  <h2 className="font-data text-xl font-bold tracking-wider text-foam">
                    How can Leviathan AI assist you today?
                  </h2>
                  <p className="font-data text-xs text-foam/45 max-w-md">
                    Requests auto-route across Gemini, Groq, OpenRouter & Mistral free tiers with failover.
                  </p>
                </div>

                {/* 4 Bento Quick Cards */}
                <div className="grid grid-cols-2 gap-4 w-full">
                  {[
                    {
                      title: "🚀 Build API Route",
                      desc: "Generate production FastAPI or Next.js endpoint with validation",
                      prompt: "Build a production FastAPI route for user auth with JWT & validation",
                    },
                    {
                      title: "🎨 Cyberpunk UI Component",
                      desc: "Design responsive React + Tailwind glassmorphic dashboard component",
                      prompt: "Create a modern dark-tech glassmorphism dashboard bento card component in React & Tailwind CSS",
                    },
                    {
                      title: "🔍 Deep Web Research",
                      desc: "Synthesize latest technical research across web pages",
                      prompt: "Perform deep research on current state-of-the-art AI Gateway router architectures",
                    },
                    {
                      title: "📄 Document & PDF Analysis",
                      desc: "Extract insights & summarize structured document files",
                      prompt: "Analyze the attached document and provide a structured summary with actionable takeaways",
                    },
                  ].map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(card.prompt)}
                      className="group flex flex-col gap-1.5 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#38bdf8]/50 hover:bg-[#38bdf8]/10 text-left transition-all duration-300"
                    >
                      <span className="font-data text-xs font-semibold text-foam/90 group-hover:text-[#7dd3fc]">
                        {card.title}
                      </span>
                      <span className="font-data text-[11px] text-foam/40 group-hover:text-foam/70">
                        {card.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message Thread */
              currentSession.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  {/* File Attachment Badges */}
                  {m.files && m.files.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-1">
                      {m.files.map((f, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30 font-data text-[11px] text-[#7dd3fc] flex items-center gap-1.5">
                          📎 {f.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-2xl rounded-2xl p-4 font-data text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#38bdf8]/20 border border-[#38bdf8]/40 text-foam shadow-[0_0_20px_rgba(56,189,248,0.15)]"
                        : "bg-white/[0.04] border border-white/10 text-foam/90"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* Interactive Code Button if present */}
                    {m.codeSnippet && (
                      <button
                        onClick={() => {
                          setCanvasContent(m.codeSnippet || null);
                          setIsCanvasOpen(true);
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/30 font-data text-[11px] text-[#7dd3fc] hover:bg-[#38bdf8]/20 flex items-center gap-1.5 transition-colors"
                      >
                        <span>🎨</span> View Code in Interactive Canvas
                      </button>
                    )}
                  </div>

                  {/* Telemetry Footer */}
                  <div className="flex items-center gap-2 font-data text-[10px] text-foam/30 px-1">
                    <span>{m.timestamp}</span>
                    {m.provider && (
                      <span className="text-[#7dd3fc]/70 uppercase font-mono tracking-wider">
                        · via {m.provider} ({m.model || "auto-routed"})
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 max-w-sm text-xs font-data text-[#7dd3fc] animate-pulse">
                <span className="text-base">🔱</span>
                <span>Leviathan Gateway routing & generating...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ------------------------------------------------ Interactive Split Canvas */}
          {isCanvasOpen && (
            <div className="w-[45%] border-l border-white/10 bg-black/80 flex flex-col justify-between p-4 overflow-hidden select-text">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2 font-data text-xs text-foam/80 font-semibold">
                  <span>🎨</span>
                  <span>INTERACTIVE CANVAS WORKSPACE</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => canvasContent && copyCanvas(canvasContent)}
                    className="px-2.5 py-1 rounded bg-white/10 border border-white/15 text-foam/80 hover:text-white font-data text-[11px]"
                  >
                    {copiedCode ? "COPIED ✓" : "COPY CODE"}
                  </button>
                  <button
                    onClick={() => setIsCanvasOpen(false)}
                    className="text-foam/40 hover:text-rose-400 px-1 text-sm font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-xs text-foam/90 bg-black/60 border border-white/10 rounded-xl p-4 leading-relaxed">
                {canvasContent ? (
                  <pre className="whitespace-pre-wrap">{canvasContent}</pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-foam/30 text-center font-data">
                    <span>No code or document selected yet.</span>
                    <span className="text-[10px] mt-1">Ask Leviathan to generate code or click 'View in Canvas'.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------ Gemini-Style Floating Input Bar */}
        <div className="p-4 border-t border-white/10 bg-black/60 backdrop-blur-xl flex flex-col gap-2">
          
          {/* Active Attachment Chips */}
          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap pb-2 border-b border-white/10">
              {attachments.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-[#38bdf8]/15 border border-[#38bdf8]/30 rounded-lg text-xs font-data text-[#7dd3fc]">
                  <span>📄 {f.name}</span>
                  <button
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    className="hover:text-rose-400 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Floating Input Container */}
          <div className="relative flex items-center gap-3 bg-black/70 border border-white/15 rounded-2xl px-4 py-3 focus-within:border-[#38bdf8] focus-within:shadow-[0_0_20px_rgba(56,189,248,0.2)] transition-all">
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />

            {/* Plus / Upload Tools Button */}
            <div className="relative">
              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#38bdf8]/20 hover:text-[#38bdf8] flex items-center justify-center text-foam/80 transition-colors text-base font-normal"
                title="Upload & Tools"
              >
                +
              </button>

              {/* Gemini Reference Popup Menu */}
              {isToolsOpen && (
                <div className="absolute bottom-12 left-0 w-64 bg-[#090d16]/95 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-2xl p-2 flex flex-col gap-1 z-50 text-xs font-data select-none">
                  <button
                    onClick={() => {
                      setIsToolsOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-foam/90 text-left transition-colors"
                  >
                    <span>📎</span>
                    <span>Upload files (Images, PDFs, Docs)</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsToolsOpen(false);
                      const url = prompt("Enter document or reference URL:");
                      if (url) {
                        setAttachments((prev) => [
                          ...prev,
                          { name: url, url, size: 0, type: "url" },
                        ]);
                      }
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-foam/90 text-left transition-colors"
                  >
                    <span>📁</span>
                    <span>Add from Drive / URL</span>
                  </button>

                  <div className="border-t border-white/10 my-1" />
                  <div className="px-3 py-1 font-data text-[9px] uppercase tracking-wider text-foam/40">
                    Studio Modes
                  </div>

                  <button
                    onClick={() => { setMode("canvas"); setIsCanvasOpen(true); setIsToolsOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-foam/90 text-left"
                  >
                    <span>🎨</span>
                    <span>Canvas Split Workspace</span>
                  </button>

                  <button
                    onClick={() => { setMode("research"); setIsToolsOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-foam/90 text-left"
                  >
                    <span>🔍</span>
                    <span>Deep Research Mode</span>
                  </button>
                </div>
              )}
            </div>

            {/* Input Prompt Box */}
            <input
              type="text"
              placeholder="Ask Gemini, Groq, or Leviathan Gateway..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-transparent font-data text-xs text-foam placeholder:text-foam/30 focus:outline-none"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSend()}
              disabled={loading || (!input.trim() && attachments.length === 0)}
              className="w-8 h-8 rounded-full bg-[#38bdf8] text-black font-bold flex items-center justify-center hover:bg-[#7dd3fc] transition-all disabled:opacity-30 shadow-[0_0_10px_#38bdf8]"
            >
              ↑
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
