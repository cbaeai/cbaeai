"use client"
import { useEffect } from "react"
import { useRef } from "react"
import { Header }       from "@/components/Header"
import { ChatMessage }  from "@/components/ChatMessage"
import { ChatInput }    from "@/components/ChatInput"
import { useChat }      from "@/hooks/useChat"
import { useChatStore } from "@/lib/store"
import { v4 as uuidv4 } from "uuid"
import { Message } from "@/types"

export default function Home() {
  const { messages, isLoading, sendMessage } = useChat()
  const { addMessage } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // setTimeout(0) yields one tick so Zustand persist can rehydrate
    // from localStorage before we check if messages are empty
    const timer = setTimeout(() => {
      const store = useChatStore.getState()
      if (store.messages.length === 0) {
        const welcome: Message = {
          id: uuidv4(), role: "assistant", timestamp: new Date(),
          content: "Hello! I'm **Cbae** — your autonomous AI assistant.\n\nI can search the web, run calculations, check weather, save notes, and much more. What can I help you with?",
        }
        store.addMessage(welcome)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-ink">
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(200,169,110,0.05) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 85% 105%, rgba(78,205,196,0.03) 0%, transparent 50%)"
      }} />
      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full">
        <Header />
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
