"use client"
import Link from "next/link"
import { useChatStore } from "@/lib/store"
import { CbaeLogo } from "./CbaeLogo"

const MODELS = [
  { id: "openai/gpt-4o-mini",                        label: "GPT-4o mini" },
  { id: "openai/gpt-4o",                             label: "GPT-4o" },
  { id: "anthropic/claude-3-haiku",                  label: "Claude 3 Haiku" },
  { id: "anthropic/claude-3.5-sonnet",               label: "Claude 3.5 Sonnet" },
  { id: "google/gemini-flash-1.5",                   label: "Gemini Flash 1.5" },
  { id: "google/gemini-pro-1.5",                     label: "Gemini Pro 1.5" },
  { id: "mistralai/mistral-small",                   label: "Mistral Small" },
  { id: "meta-llama/llama-3.3-70b-instruct",         label: "Llama 3.3 70B" },
  { id: "arcee-ai/trinity-large-preview:free",        label: "Trinity Large" },
]

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { agentMode, model, setModel, newConversation } = useChatStore()

  return (
    <div className="flex items-center justify-between px-4 h-14 border-b border-[#2a2a2a] flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSidebar}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
          title="Open sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="flex items-center gap-2 ml-1">
          <CbaeLogo size={22} />
          <span className="font-semibold text-[#ececec] text-sm">Cbae</span>
          {agentMode && (
            <span className="flex items-center gap-1 text-[11px] text-[#4ecdc4] bg-[#4ecdc4]/10 border border-[#4ecdc4]/20 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ecdc4] animate-pulse" />
              Agent
            </span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="text-xs text-[#b4b4b4] bg-transparent border border-[#3a3a3a] rounded-lg px-2.5 py-1.5 outline-none hover:border-[#555] focus:border-[#555] cursor-pointer transition-colors"
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id} className="bg-[#2a2a2a]">{m.label}</option>
          ))}
        </select>

        <button
          onClick={() => newConversation()}
          className="flex items-center gap-1.5 text-xs text-[#b4b4b4] hover:text-[#ececec] border border-[#3a3a3a] hover:border-[#555] rounded-lg px-2.5 py-1.5 transition-colors"
          title="New chat"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New
        </button>

        <Link
          href="/moltbook"
          className="text-xs text-[#b4b4b4] hover:text-[#ececec] border border-[#3a3a3a] hover:border-[#555] rounded-lg px-2.5 py-1.5 transition-colors"
        >
          ⬡ Moltbook
        </Link>
      </div>
    </div>
  )
}
