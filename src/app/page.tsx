"use client"
import { useEffect, useRef, useState } from "react"
import { Header }       from "@/components/Header"
import { Sidebar }      from "@/components/Sidebar"
import { ChatMessage }  from "@/components/ChatMessage"
import { ChatInput }    from "@/components/ChatInput"
import { useChat }      from "@/hooks/useChat"
import { useChatStore } from "@/lib/store"
import { v4 as uuidv4 } from "uuid"
import { Message } from "@/types"

function initStore() {
  const store = useChatStore.getState()
  if (store.conversations.length === 0) {
    store.newConversation()
  } else {
    const active = store.conversations.find(c => c.id === store.activeId) || store.conversations[0]
    if (active) {
      useChatStore.setState({
        activeId: active.id,
        messages: active.messages,
        model: active.model,
        agentMode: active.agentMode,
      })
    }
  }
}

const SUGGESTIONS = [
  { icon: "🔍", label: "Search the web",     prompt: "What are the biggest AI breakthroughs this week?" },
  { icon: "🐍", label: "Run Python code",    prompt: "Write and run a Python script that generates the first 20 Fibonacci numbers" },
  { icon: "📄", label: "Analyze a file",     prompt: "I'll attach a file — analyze it and summarize the key points" },
  { icon: "🧠", label: "Deep reasoning",     prompt: "Explain the difference between RAG and fine-tuning for LLMs, with pros and cons of each" },
]

function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-16 select-none">
      {/* Logo mark */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold via-amber-600 to-amber-800 flex items-center justify-center shadow-[0_0_40px_rgba(200,169,110,0.25)]">
          <span className="text-2xl text-ink font-bold">✦</span>
        </div>
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-2xl ring-1 ring-gold/20 scale-110" />
      </div>

      {/* Heading */}
      <h2 className="font-serif text-3xl text-text1 mb-2 tracking-tight">
        How can I help you?
      </h2>
      <p className="text-fog text-sm mb-10 text-center max-w-xs leading-relaxed">
        I can search the web, run code, read files, and think through complex problems.
      </p>

      {/* Suggestion chips */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {SUGGESTIONS.map(s => (
          <button
            key={s.prompt}
            onClick={() => onSend(s.prompt)}
            className="group flex items-start gap-3 px-4 py-3.5 rounded-xl border border-rim hover:border-gold/30 bg-ink2 hover:bg-ink3 transition-all text-left"
          >
            <span className="text-xl mt-0.5 group-hover:scale-110 transition-transform">{s.icon}</span>
            <div>
              <p className="text-text2 text-xs font-medium group-hover:text-text1 transition-colors">{s.label}</p>
              <p className="text-fog text-xs mt-0.5 leading-relaxed line-clamp-2">{s.prompt}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const { isLoading, sendMessage } = useChat()
  const { conversations, activeId } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { initStore() }, [])

  const messages = conversations.find(c => c.id === activeId)?.messages || []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-ink">
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(200,169,110,0.07) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 105%, rgba(78,205,196,0.04) 0%, transparent 50%)"
      }} />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="flex-1 overflow-y-auto py-4">
          {messages.length === 0
            ? <WelcomeScreen onSend={sendMessage} />
            : messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)
          }
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pb-6 pt-2">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
