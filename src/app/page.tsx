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
    store.addMessage({
      id: uuidv4(),
      role: "assistant",
      timestamp: new Date(),
      content: "Hello! I'm **Cbae** — your autonomous AI assistant.\n\nI can search the web, run calculations, check weather, save notes, and much more. What can I help you with?",
    })
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

export default function Home() {
  const { isLoading, sendMessage } = useChat()
  const { conversations, activeId } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Zustand persist rehydrates synchronously from localStorage in the browser.
    // By the time useEffect runs, hasHydrated() is always true — just init directly.
    initStore()
  }, [])

  const messages = conversations.find(c => c.id === activeId)?.messages || []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-ink">
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(200,169,110,0.05) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 105%, rgba(78,205,196,0.03) 0%, transparent 50%)"
      }} />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="flex-1 overflow-y-auto py-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="font-serif text-3xl text-text1 mb-2">Cbae</p>
                <p className="text-fog text-sm">What can I help you with?</p>
              </div>
            </div>
          ) : (
            messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pb-6 pt-2">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
