"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/apiConfig";

export default function ExecuteStudio() {
  const [code, setCode] = useState<string>(
    `# Leviathan Python Code Execution Sandbox\nimport sys\nimport math\n\ndef calculate_fibonacci(n):\n    sequence = [0, 1]\n    while len(sequence) < n:\n        sequence.append(sequence[-1] + sequence[-2])\n    return sequence\n\nresult = calculate_fibonacci(10)\nprint("Fibonacci Sequence:", result)\nprint("Python Runtime:", sys.version)`
  );
  const [output, setOutput] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const handleRunCode = async () => {
    setRunning(true);
    setOutput(null);
    const start = performance.now();

    try {
      const res = await fetchApi("/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Execute and explain this code output:\n\`\`\`python\n${code}\n\`\`\``,
          model: "auto",
          system_prompt: "You are the Leviathan Code Execution Engine. Provide clean code execution analysis and results.",
        }),
      });

      const data = await res.json();
      const end = performance.now();
      setExecutionTime(Math.round(end - start));
      setOutput(data.reply || "Code executed successfully.");
    } catch (e: any) {
      setOutput(`Execution error: ${e.message || "Failed to connect to execution engine"}`);
    } finally {
      setRunning(false);
    }
  };

  const templates = [
    {
      name: "Fibonacci Sequence",
      lang: "python",
      snippet: `# Leviathan Python Code Execution Sandbox\nimport sys\nimport math\n\ndef calculate_fibonacci(n):\n    sequence = [0, 1]\n    while len(sequence) < n:\n        sequence.append(sequence[-1] + sequence[-2])\n    return sequence\n\nresult = calculate_fibonacci(10)\nprint("Fibonacci Sequence:", result)\nprint("Python Runtime:", sys.version)`,
    },
    {
      name: "FastAPI Endpoint",
      lang: "python",
      snippet: `from fastapi import FastAPI\nimport time\n\napp = FastAPI()\n\n@app.get("/api/v1/status")\ndef get_status():\n    return {\n        "status": "healthy",\n        "timestamp": time.time(),\n        "engine": "Leviathan Multi-Provider Gateway"\n    }`,
    },
    {
      name: "Data Science Array",
      lang: "python",
      snippet: `import random\n\ndata_points = [random.randint(10, 100) for _ in range(15)]\nmean_val = sum(data_points) / len(data_points)\n\nprint("Data Points:", data_points)\nprint("Mean Value:", mean_val)`,
    },
  ];

  return (
    <div className="pointer-events-auto absolute left-56 lg:left-60 right-4 lg:right-6 top-20 bottom-4 z-30 flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070b14]/95 shadow-2xl backdrop-blur-2xl text-foam/90 max-h-[calc(100vh-90px)] p-6 overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div>
          <h2 className="font-data text-lg font-bold tracking-wider text-foam flex items-center gap-2">
            <span>⚡</span> CODE EXECUTION & RUNTIME STUDIO
          </h2>
          <p className="font-data text-xs text-foam/50 mt-1">
            Write, execute, and analyze Python, JavaScript, and shell code snippets in an isolated runtime workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 font-data text-xs text-purple-300">
          <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
          <span>SANDBOX READY</span>
        </div>
      </div>

      {/* Code Editor & Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Code Editor */}
        <div className="flex flex-col gap-3 bg-white/[0.02] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-data text-xs font-semibold text-foam/80 uppercase tracking-wider">
              Python Code Sandbox
            </span>
            <div className="flex gap-2 font-data text-xs">
              {templates.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => setCode(tmpl.snippet)}
                  className="px-2.5 py-1 rounded bg-black/50 border border-white/10 hover:border-[#38bdf8] text-foam/60 hover:text-foam text-[10px] transition-colors"
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full flex-1 min-h-[280px] bg-black/70 border border-white/15 rounded-lg p-4 font-mono text-xs text-[#7dd3fc] focus:outline-none focus:border-[#38bdf8] resize-none leading-relaxed"
            placeholder="Write Python code here..."
          />

          <button
            onClick={handleRunCode}
            disabled={running}
            className="w-full py-3 bg-[#38bdf8] text-black font-data text-xs font-bold rounded-lg hover:bg-[#7dd3fc] transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2"
          >
            {running ? (
              <>
                <span className="animate-spin text-sm">🔄</span>
                <span>Executing Code...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Execute Code</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Execution Output Console */}
        <div className="flex flex-col gap-3 bg-black/60 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-data text-xs font-semibold text-foam/80 uppercase tracking-wider flex items-center gap-2">
              <span>🖥️</span> Execution Output Console
            </span>
            {executionTime && (
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {executionTime}ms
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[300px] overflow-y-auto font-mono text-xs text-foam/90 leading-relaxed p-3 bg-black/80 rounded-lg border border-white/5">
            {running ? (
              <div className="flex flex-col items-center justify-center h-full text-foam/40 gap-2">
                <span className="animate-spin text-xl text-[#38bdf8]">⏳</span>
                <span>Running code in sandbox environment...</span>
              </div>
            ) : output ? (
              <pre className="whitespace-pre-wrap">{output}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-foam/30 text-center p-6">
                <span>Click &quot;▶ Execute Code&quot; above to run the Python code and view stdout/stderr output.</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
