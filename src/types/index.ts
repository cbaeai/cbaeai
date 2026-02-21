export type Role = "user" | "assistant" | "system"

export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  result?: string
}

// ── Attachment — covers images AND files ───────────────────────
export interface Attachment {
  kind: "image" | "file"
  name: string
  mimeType: string
  size: number
  base64?: string
  previewUrl?: string
  extractedText?: string
  fileCount?: number
  language?: string
}

export interface SearchImage {
  url: string
  title: string
  source: string
  thumbnail?: string
}

export interface Message {
  id: string
  role: Role
  content: string
  thinking?: string
  toolCalls?: ToolCall[]
  isStreaming?: boolean
  timestamp: Date
  attachment?: Attachment
  searchImages?: SearchImage[]  // web image search results
}
