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
  files?: FileAttachment[];
  timestamp: string;
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
  const [selectedModel, setSelectedModel] = useState("auto");
  const [mode, setMode] = useState<"chat" | "canvas" | "research" | "guided">("chat");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [personalIntelligence, setPersonalIntelligence] = useState(true);
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

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      files: [...attachments],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Update session title if first message
    const isFirstMsg = currentSession.messages.length === 0;
    const newTitle = isFirstMsg ? (input.slice(0, 30) || "Uploaded File Context") : currentSession.title;

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

    const userPrompt = input.trim();
    setInput("");
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
          prompt: userPrompt,
          model: selectedModel === "auto" ? undefined : selectedModel,
          system_prompt: `You are Leviathan AI in ${mode.toUpperCase()} mode. Provide comprehensive, accurate, and visually polished responses.`,
        }),
      });

      const data = await res.json();
      const aiMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: data.reply || "No response received from AI Gateway.",
        provider: data.provider || "gateway",
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
        content: "Error communicating with Leviathan AI Gateway. Please check backend status.",
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

  return (
    <div className="glass-panel pointer-events-auto absolute left-64 right-6 top-24 bottom-6 z-20 flex overflow-hidden rounded-2xl border border-white/10 text-foam/90">
      {/* Left Chat History & Mode Sidebar */}
      <div className="w-64 border-r border-white/10 bg-black/40 flex flex-col justify-between p-3 select-none">
        <div className="flex flex-col gap-3">
          <button
            onClick={createNewChat}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3 font-data text-xs font-semibold tracking-wider text-foam hover:bg-[#38bdf8]/20 hover:text-[#38bdf8] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>NEW CHAT</span>
          </button>

          {/* Mode Switcher */}
          <div className="flex flex-col gap-1 border-y border-white/10 py-2.5 my-1">
            <span className="font-data text-[9px] uppercase tracking-[0.2em] text-foam/30 px-2">Studio Modes</span>
            {[
              { id: "chat", name: "Chat Mode", icon: "💬" },
              { id: "canvas", name: "Canvas", icon: "🎨" },
              { id: "research", name: "Deep Research", icon: "🔍" },
              { id: "guided", name: "Guided Learning", icon: "🎓" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-data text-xs transition-all ${
                  mode === m.id ? "bg-[#38bdf8]/15 text-[#7dd3fc]" : "text-foam/50 hover:bg-white/5"
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.name}</span>
              </button>
            ))}
          </div>

          {/* History List */}
          <span className="font-data text-[9px] uppercase tracking-[0.2em] text-foam/30 px-2">Recent Chats</span>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-360px)]">
            {sessions.map((s) => {
              const active = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-lg font-data text-xs cursor-pointer transition-all ${
                    active ? "bg-[#38bdf8]/20 text-[#bae6fd]" : "text-foam/60 hover:bg-white/5"
                  }`}
                >
                  <span className="truncate pr-4">{s.title}</span>
                  <button
                    onClick={(e) => deleteChat(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-foam/40 hover:text-rose-400 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Labs Toggle */}
        <div className="border-t border-white/10 pt-3 flex items-center justify-between px-2 font-data text-xs text-foam/50">
          <span>Personal Labs</span>
          <button
            onClick={() => setPersonalIntelligence(!personalIntelligence)}
            className={`w-8 h-4 rounded-full transition-colors relative ${personalIntelligence ? "bg-[#38bdf8]" : "bg-white/20"}`}
          >
            <span className={`w-3 h-3 bg-black rounded-full absolute top-0.5 transition-transform ${personalIntelligence ? "left-4.5" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col justify-between bg-black/20">
        {/* Top Model Switcher Bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 bg-black/40">
          <div className="flex items-center gap-2 font-data text-xs text-foam/70">
            <span className="text-[#38bdf8]">●</span>
            <span className="font-semibold uppercase tracking-wider">Model Router:</span>
          </div>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 font-data text-xs text-[#7dd3fc] focus:outline-none focus:border-[#38bdf8]"
          >
            <option value="auto">Auto-Route (Failover Ready)</option>
            <option value="gemini-2.5-flash">Google Gemini 2.5 Flash</option>
            <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B</option>
            <option value="meta-llama/llama-3.3-70b-instruct:free">OpenRouter Free Models</option>
            <option value="mistral-small-latest">Mistral Small</option>
          </select>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {currentSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-foam/40 gap-3">
              <span className="text-4xl">🔱</span>
              <h3 className="font-data text-base font-semibold text-foam/70">Ask Leviathan AI Studio</h3>
              <p className="font-data text-xs max-w-sm">
                Upload files, documents, images, or enter prompts. Requests automatically failover across your configured free AI models.
              </p>
            </div>
          ) : (
            currentSession.messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* File attachments badge */}
                {m.files && m.files.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-1">
                    {m.files.map((f, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-white/10 border border-white/15 font-data text-[10px] text-foam/80 flex items-center gap-1">
                        📎 {f.name}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 font-data text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#38bdf8]/20 border border-[#38bdf8]/40 text-foam"
                      : "bg-white/[0.04] border border-white/10 text-foam/90"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>

                <div className="flex items-center gap-2 font-data text-[9px] text-foam/30 px-1">
                  <span>{m.timestamp}</span>
                  {m.provider && (
                    <span className="text-[#7dd3fc]/60 uppercase font-mono">· via {m.provider}</span>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 font-data text-xs text-[#7dd3fc] animate-pulse">
              <span>🔱</span>
              <span>Leviathan AI routing & generating response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Gemini-Style Attachments & Input Bar */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2">
          {/* Active Attachments Preview Chips */}
          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap pb-2 border-b border-white/10">
              {attachments.map((f, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-[#38bdf8]/15 border border-[#38bdf8]/30 rounded-lg text-xs font-data text-[#7dd3fc]">
                  <span>📄 {f.name}</span>
                  <button
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    className="hover:text-rose-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-center gap-3 bg-black/60 border border-white/15 rounded-2xl px-4 py-3 focus-within:border-[#38bdf8] transition-colors">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />

            {/* Attachments / Tools Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-foam/80 transition-colors text-base"
                title="Upload & Tools"
              >
                +
              </button>

              {/* Gemini Reference Style Popup Menu */}
              {isToolsOpen && (
                <div className="absolute bottom-12 left-0 w-64 bg-black/90 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-xl p-2 flex flex-col gap-1 z-50 text-xs font-data select-none">
                  <button
                    onClick={() => {
                      setIsToolsOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-foam/90 text-left"
                  >
                    <span>📎</span>
                    <span>Upload files</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsToolsOpen(false);
                      const url = prompt("Enter reference document or page URL:");
                      if (url) {
                        setAttachments((prev) => [
                          ...prev,
                          { name: url, url, size: 0, type: "url" },
                        ]);
                      }
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-foam/90 text-left"
                  >
                    <span>📁</span>
                    <span>Add from Drive / URL</span>
                  </button>

                  <div className="border-t border-white/10 my-1" />

                  <div className="px-3 py-1 font-data text-[9px] uppercase tracking-wider text-foam/40">
                    More tools
                  </div>

                  <button
                    onClick={() => { setMode("canvas"); setIsToolsOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-foam/90 text-left"
                  >
                    <span>🎨</span>
                    <span>Canvas</span>
                  </button>

                  <button
                    onClick={() => { setMode("research"); setIsToolsOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-foam/90 text-left"
                  >
                    <span>🔍</span>
                    <span>Deep Research</span>
                  </button>

                  <button
                    onClick={() => { setMode("guided"); setIsToolsOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-foam/90 text-left"
                  >
                    <span>🎓</span>
                    <span>Guided Learning</span>
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
              onClick={handleSend}
              disabled={loading || (!input.trim() && attachments.length === 0)}
              className="w-8 h-8 rounded-full bg-[#38bdf8] text-black font-bold flex items-center justify-center hover:bg-[#7dd3fc] transition-all disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
