"use client"
import { useChatStore } from "@/lib/store"
import { Message } from "@/types"
import { v4 as uuidv4 } from "uuid"

export function useChat() {
  const { messages, isLoading, agentMode, model, addMessage, setLoading, appendToolCall } = useChatStore()

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    addMessage({ id: uuidv4(), role: "user", content: text, timestamp: new Date() })
    addMessage({ id: uuidv4(), role: "assistant", content: "", isStreaming: true, toolCalls: [], timestamp: new Date() })
    setLoading(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, agent_mode: agentMode, model }),
      })

      if (!res.body) throw new Error("No response body")
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = "", fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === "token") {
              fullText += data.content
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullText }
                return { messages: msgs }
              })
            }
            if (data.type === "tool_call") appendToolCall({ tool: data.tool, args: data.args })
            if (data.type === "tool_result") {
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                const tcs  = [...(last.toolCalls || [])]
                const idx  = tcs.findLastIndex(t => t.tool === data.tool && !t.result)
                if (idx >= 0) tcs[idx] = { ...tcs[idx], result: data.result }
                msgs[msgs.length - 1] = { ...last, toolCalls: tcs }
                return { messages: msgs }
              })
            }
            if (data.type === "done") {
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStreaming: false }
                return { messages: msgs }
              })
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      useChatStore.setState(s => {
        const msgs = [...s.messages]
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`, isStreaming: false }
        return { messages: msgs }
      })
    } finally {
      setLoading(false)
    }
  }

  return { messages, isLoading, agentMode, sendMessage }
}
