import { create } from "zustand"
import { persist } from "zustand/middleware"
import { Message, ToolCall } from "@/types"
import { v4 as uuidv4 } from "uuid"

// ── Conversation type ─────────────────────────────────────────
export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: Message[]
  model: string
  agentMode: boolean
}

interface ConversationStore {
  conversations: Conversation[]
  activeId: string | null
  isLoading: boolean
  model: string
  agentMode: boolean
  messages: Message[]
  newConversation: () => string
  switchConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  addMessage: (msg: Message) => void
  updateLastMessage: (content: string) => void
  appendToolCall: (tc: ToolCall) => void
  setLoading: (v: boolean) => void
  setAgentMode: (v: boolean) => void
  setModel: (m: string) => void
  clearMessages: () => void
}

function makeNew(model: string, agentMode: boolean): Conversation {
  return {
    id: uuidv4(),
    title: "New conversation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    model,
    agentMode,
  }
}

export const useChatStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      isLoading: false,
      model: "openai/gpt-4o-mini",
      agentMode: true,

      get messages(): Message[] {
        const { conversations, activeId } = get()
        return conversations.find(c => c.id === activeId)?.messages || []
      },

      newConversation: () => {
        const { model, agentMode } = get()
        const convo = makeNew(model, agentMode)
        set(s => ({ conversations: [convo, ...s.conversations], activeId: convo.id, messages: [] }))
        return convo.id
      },

      switchConversation: (id) => {
        const convo = get().conversations.find(c => c.id === id)
        if (!convo) return
        set({ activeId: id, model: convo.model, agentMode: convo.agentMode, messages: convo.messages })
      },

      deleteConversation: (id) => {
        const { conversations, activeId } = get()
        const remaining = conversations.filter(c => c.id !== id)
        const newActiveId = activeId === id ? (remaining[0]?.id || null) : activeId
        const newMsgs = remaining.find(c => c.id === newActiveId)?.messages || []
        set({ conversations: remaining, activeId: newActiveId, messages: newMsgs })
      },

      renameConversation: (id, title) =>
        set(s => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, title } : c) })),

      addMessage: (msg) => {
        set(s => {
          let { conversations, activeId } = s
          if (!activeId || !conversations.find(c => c.id === activeId)) {
            const convo = makeNew(s.model, s.agentMode)
            conversations = [convo, ...conversations]
            activeId = convo.id
          }
          const updated = conversations.map(c => {
            if (c.id !== activeId) return c
            const messages = [...c.messages, msg]
            const title = c.title === "New conversation" && msg.role === "user" && msg.content.trim()
              ? msg.content.trim().slice(0, 52) + (msg.content.length > 52 ? "…" : "")
              : c.title
            return { ...c, messages, title, updatedAt: new Date().toISOString() }
          })
          const newMsgs = updated.find(c => c.id === activeId)?.messages || []
          return { conversations: updated, activeId, messages: newMsgs }
        })
      },

      updateLastMessage: (content) =>
        set(s => {
          const updated = s.conversations.map(c => {
            if (c.id !== s.activeId) return c
            const msgs = [...c.messages]
            if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content, isStreaming: false }
            return { ...c, messages: msgs }
          })
          const newMsgs = updated.find(c => c.id === s.activeId)?.messages || []
          return { conversations: updated, messages: newMsgs }
        }),

      appendToolCall: (tc: ToolCall) =>
        set(s => {
          const updated = s.conversations.map(c => {
            if (c.id !== s.activeId) return c
            const msgs = [...c.messages]
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1]
              msgs[msgs.length - 1] = { ...last, toolCalls: [...(last.toolCalls || []), tc] }
            }
            return { ...c, messages: msgs }
          })
          const newMsgs = updated.find(c => c.id === s.activeId)?.messages || []
          return { conversations: updated, messages: newMsgs }
        }),

      setLoading: (v) => set({ isLoading: v }),

      setAgentMode: (v) =>
        set(s => ({
          agentMode: v,
          conversations: s.conversations.map(c => c.id === s.activeId ? { ...c, agentMode: v } : c),
        })),

      setModel: (m) =>
        set(s => ({
          model: m,
          conversations: s.conversations.map(c => c.id === s.activeId ? { ...c, model: m } : c),
        })),

      clearMessages: () =>
        set(s => ({
          conversations: s.conversations.map(c =>
            c.id === s.activeId
              ? { ...c, messages: [], title: "New conversation", updatedAt: new Date().toISOString() }
              : c
          ),
          messages: [],
        })),
    }),
    {
      name: "cbae-chat-v2",
      partialize: (state) => ({
        conversations: state.conversations.map(c => ({
          ...c,
          messages: c.messages.map(m => ({ ...m, isStreaming: false })),
        })),
        activeId:  state.activeId,
        model:     state.model,
        agentMode: state.agentMode,
        // messages is derived — not persisted, rehydrated on load
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const active = state.conversations.find(c => c.id === state.activeId)
          state.messages = active?.messages || []
        }
      },
    }
  )
)
