"use client"
import Link from "next/link"
import { useChatStore } from "@/lib/store"

const MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "anthropic/claude-3-haiku",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-flash-1.5",
  "google/gemini-pro-1.5",
  "mistralai/mistral-small",
  "meta-llama/llama-3.3-70b-instruct",
  "arcee-ai/trinity-large-preview:free",
]

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { agentMode, model, setModel, newConversation, conversations, activeId } = useChatStore()

  const activeConvo = conversations.find(c => c.id === activeId)

  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-rim">
      {/* Left: sidebar toggle + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="flex flex-col gap-1 p-1.5 rounded-md hover:bg-ink3 transition-colors group"
          title="Conversations"
        >
          <span className="block w-4 h-px bg-fog group-hover:bg-mist transition-colors" />
          <span className="block w-4 h-px bg-fog group-hover:bg-mist transition-colors" />
          <span className="block w-3 h-px bg-fog group-hover:bg-mist transition-colors" />
        </button>

        <div>
          <h1 className="font-serif text-2xl text-text1 tracking-tight leading-none">Cbae</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${agentMode ? "bg-teal shadow-[0_0_6px_#4ecdc4]" : "bg-fog"}`} />
            <span className={`text-xs tracking-wide ${agentMode ? "text-teal" : "text-fog"}`}>
              {agentMode ? "Agent · tools active" : "Direct · fast mode"}
            </span>
          </div>
        </div>
      </div>

      {/* Right: model picker + new chat + moltbook */}
      <div className="flex items-center gap-2">
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="text-xs text-mist bg-ink3 border border-rim rounded-lg px-2 py-1.5 outline-none focus:border-gold/50 cursor-pointer"
        >
          {MODELS.map(m => (
            <option key={m} value={m}>{m.split("/")[1]?.split(":")[0] || m}</option>
          ))}
        </select>

        <button
          onClick={() => newConversation()}
          className="text-xs text-fog hover:text-mist border border-rim hover:border-rim2 rounded-lg px-3 py-1.5 transition-colors"
          title="New conversation"
        >
          + New
        </button>

        <Link
          href="/moltbook"
          className="text-xs text-fog hover:text-gold border border-rim hover:border-gold/30 rounded-lg px-3 py-1.5 transition-colors"
        >
          ⬡ Moltbook
        </Link>
      </div>
    </div>
  )
}
