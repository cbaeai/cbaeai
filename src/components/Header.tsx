"use client"
import Link from "next/link"
import { useChatStore } from "@/lib/store"

const MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "anthropic/claude-3-haiku",
  "google/gemini-flash-1.5",
  "mistralai/mistral-small",
]

export function Header() {
  const { agentMode, model, setAgentMode, setModel, clearMessages } = useChatStore()

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-rim">
      <div>
        <h1 className="font-serif text-2xl text-text1 tracking-tight">Cbae</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${agentMode ? "bg-teal shadow-[0_0_6px_#4ecdc4]" : "bg-fog"}`} />
          <span className={`text-xs tracking-wide ${agentMode ? "text-teal" : "text-fog"}`}>
            {agentMode ? "Agent · tools active" : "Direct · fast mode"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select value={model} onChange={e => setModel(e.target.value)}
          className="text-xs text-mist bg-ink3 border border-rim rounded-lg px-2 py-1.5 outline-none focus:border-gold/50 cursor-pointer">
          {MODELS.map(m => <option key={m} value={m}>{m.split("/")[1]?.split(":")[0] || m}</option>)}
        </select>

        <button onClick={() => setAgentMode(!agentMode)}
          className={`relative w-10 h-5 rounded-full transition-colors ${agentMode ? "bg-teal/30 border border-teal/50" : "bg-rim border border-rim2"}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${agentMode ? "left-5 bg-teal" : "left-0.5 bg-fog"}`} />
        </button>

        <button onClick={clearMessages}
          className="text-xs text-fog hover:text-mist border border-rim hover:border-rim2 rounded-lg px-3 py-1.5 transition-colors">
          Clear
        </button>

        <Link href="/moltbook"
          className="text-xs text-fog hover:text-gold border border-rim hover:border-gold/30 rounded-lg px-3 py-1.5 transition-colors">
          ⬡ Moltbook
        </Link>
      </div>
    </div>
  )
}
