export type Role = "user" | "assistant" | "system"

export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  result?: string
}

// ── Attachment — covers images AND files ───────────────────────
// Images go to the vision API path (base64 + mimeType).
// Files go to the text injection path (extractedText).
// A message can have at most one attachment.
export interface Attachment {
  kind: "image" | "file"

  // ── shared ──────────────────────────────────
  name: string          // original filename, e.g. "report.pdf"
  mimeType: string      // e.g. "application/pdf", "image/png"
  size: number          // bytes

  // ── image-only ──────────────────────────────
  base64?: string       // raw base64 (no data: prefix) — sent to vision API
  previewUrl?: string   // full data: URL — used for <img> display in chat

  // ── file-only ───────────────────────────────
  extractedText?: string  // text extracted from PDF / ZIP / code / etc.
  fileCount?: number      // for ZIP: how many files were inside
  language?: string       // for code: detected language, e.g. "typescript"
}

export interface Message {
  id: string
  role: Role
  content: string
  thinking?: string
  toolCalls?: ToolCall[]
  isStreaming?: boolean
  timestamp: Date
  attachment?: Attachment  // replaces the old `image` field
}

// Store type lives in src/lib/store.ts
