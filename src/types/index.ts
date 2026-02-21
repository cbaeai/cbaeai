export type Role = "user" | "assistant" | "system"

export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  result?: string
}

export interface Message {
  id: string
  role: Role
  content: string
  thinking?: string        // agent scratchpad — shown in collapsible UI
  toolCalls?: ToolCall[]
  isStreaming?: boolean
  timestamp: Date
  image?: {               // optional attached image
    base64: string        // raw base64 data (no data: prefix)
    mimeType: string      // e.g. "image/png"
    previewUrl: string    // data: URL for <img> display
  }
}

export interface ChatStore {
  messages: Message[]
  isLoading: boolean
  agentMode: boolean
  model: string
  addMessage: (msg: Message) => void
  updateLastMessage: (content: string) => void
  appendToolCall: (tc: ToolCall) => void
  setLoading: (v: boolean) => void
  setAgentMode: (v: boolean) => void
  setModel: (m: string) => void
  clearMessages: () => void
}
