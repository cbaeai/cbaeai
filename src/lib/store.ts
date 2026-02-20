import { create } from "zustand"
import { persist } from "zustand/middleware"
import { Message, ChatStore, ToolCall } from "@/types"

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages:  [],
      isLoading: false,
      agentMode: true,
      model:     "openai/gpt-4o-mini",

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

      setLoading:    (v) => set({ isLoading: v }),
      setAgentMode:  (v) => set({ agentMode: v }),
      setModel:      (m) => set({ model: m }),
      clearMessages: ()  => set({ messages: [] }),
    }),
    {
      name: "cbae-chat",

      // Only persist what should survive a page reload
      partialize: (state) => ({
        messages:  state.messages.map((m) => ({
          ...m,
          // Force any mid-stream message to appear complete after restore
          isStreaming: false,
        })),
        agentMode: state.agentMode,
        model:     state.model,
        // isLoading is intentionally excluded — never restore a loading spinner
      }),
    }
  )
)
