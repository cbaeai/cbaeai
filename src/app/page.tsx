"use client"
import { useEffect, useRef } from "react"
import { Header }      from "@/components/Header"
import { Sidebar }     from "@/components/Sidebar"
import { ChatMessage } from "@/components/ChatMessage"
import { ChatInput }   from "@/components/ChatInput"
import { CbaeLogo }    from "@/components/CbaeLogo"
import { useChat }     from "@/hooks/useChat"
import { useChatStore } from "@/lib/store"
import { useState } from "react"

function initStore() {
  const store = useChatStore.getState()
  if (store.conversations.length === 0) {
    store.newConversation()
  } else {
    const active = store.conversations.find(c => c.id === store.activeId) || store.conversations[0]
    if (active) {
      useChatStore.setState({ activeId: active.id, messages: active.messages, model: active.model, agentMode: active.agentMode })
    }
  }
}

const SUGGESTIONS = [
  { icon: "🔍", label: "Search the web",  prompt: "What are the biggest AI breakthroughs this week?" },
  { icon: "🐍", label: "Run Python",       prompt: "Write and run a Python script that generates the first 20 Fibonacci numbers" },
  { icon: "📄", label: "Analyze a file",   prompt: "I'll attach a file — analyze it and summarize the key points" },
  { icon: "🧠", label: "Deep reasoning",   prompt: "Explain the difference between RAG and fine-tuning for LLMs, with pros and cons" },
]

function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-8 select-none">
      <div className="mb-5 flex items-center justify-center">
        <CbaeLogo size={40} />
      </div>
      <h2 className="text-2xl font-semibold text-[#ececec] mb-1">How can I help you?</h2>
      <p className="text-sm text-[#8e8e8e] mb-8 text-center">
        Search the web, run code, read files, and think through anything.
      </p>
      <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map(s => (
          <button
            key={s.prompt}
            onClick={() => onSend(s.prompt)}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#222] hover:bg-[#252525] transition-all text-left group"
          >
            <span className="text-lg mt-0.5 flex-shrink-0">{s.icon}</span>
            <div>
              <p className="text-sm font-medium text-[#b4b4b4] group-hover:text-[#ececec] transition-colors">{s.label}</p>
              <p className="text-xs text-[#666] mt-0.5 leading-relaxed line-clamp-2">{s.prompt}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const { isLoading, sendMessage, regenerate } = useChat()
  const { conversations, activeId } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { initStore() }, [])

  const messages = conversations.find(c => c.id === activeId)?.messages || []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col h-full">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen onSend={sendMessage} />
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id}
                  msg={msg}
                  isLast={i === messages.length - 1}
                  onRegenerate={regenerate}
                />
              ))}
              <div className="h-6" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2a2a] pt-3 bg-[#1a1a1a]">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
