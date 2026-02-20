import { create } from "zustand"
import { Message, ChatStore, ToolCall } from "@/types"

export const useChatStore = create<ChatStore>((set) => ({
  messages:  [],
  isLoading: false,
  agentMode: true,
  model:     "arcee-ai/trinity-large-preview:free",

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content, isStreaming: false }
      }
      return { messages: msgs }
    }),

  appendToolCall: (tc: ToolCall) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1]
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: [...(last.toolCalls || []), tc],
        }
      }
      return { messages: msgs }
    }),

  setLoading:   (v) => set({ isLoading: v }),
  setAgentMode: (v) => set({ agentMode: v }),
  setModel:     (m) => set({ model: m }),
  clearMessages:()  => set({ messages: [] }),
}))
