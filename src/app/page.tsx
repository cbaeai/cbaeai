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

export default function Home() {
  const { messages, isLoading, sendMessage } = useChat()
  const { conversations, activeId, newConversation, addMessage } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // On first load: create an initial conversation with the welcome message
  useEffect(() => {
    const timer = setTimeout(() => {
      const store = useChatStore.getState()
      // Only auto-init if there are no conversations at all
      if (store.conversations.length === 0) {
        const id = store.newConversation()
        const welcome: Message = {
          id: uuidv4(),
          role: "assistant",
          timestamp: new Date(),
          content: "Hello! I'm **Cbae** — your autonomous AI assistant.\n\nI can search the web, run calculations, check weather, save notes, and much more. What can I help you with?",
        }
        store.addMessage(welcome)
      } else if (!store.activeId) {
        // Conversations exist but none active — activate the first
        store.switchConversation(store.conversations[0].id)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-ink">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(200,169,110,0.05) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 105%, rgba(78,205,196,0.03) 0%, transparent 50%)"
      }} />

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main layout */}
      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="flex-1 overflow-y-auto py-4">
          {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pb-6 pt-2">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
