"use client"
import { useState, KeyboardEvent, useRef, useEffect, useCallback } from "react"
import { useChatStore } from "@/lib/store"
import { processFile, formatFileSize, fileIcon, classifyFile } from "@/lib/fileParser"
import type { Attachment } from "@/types"

// Re-export so useChat.ts can import from here (backwards compat)
export type { Attachment }

interface Props {
  onSend: (text: string, attachment?: Attachment) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue]             = useState("")
  const [attachment, setAttachment]   = useState<Attachment | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [parseError, setParseError]   = useState("")
  const [parsing, setParsing]         = useState(false)
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)
  const fileInputRef                  = useRef<HTMLInputElement>(null)
  const { agentMode, setAgentMode }   = useChatStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [value])

  // ── Process any file through the unified parser ───────────────
  const handleFile = useCallback(async (file: File) => {
    setParseError("")
    setParsing(true)
    try {
      const result = await processFile(file)
      setAttachment(result)
    } catch (err: any) {
      setParseError(err.message || "Failed to read file")
      setAttachment(null)
    } finally {
      setParsing(false)
    }
  }, [])

  // ── Paste — images AND file drops from Finder/Explorer ───────
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const fileItem = items.find(item => item.kind === "file")
    if (!fileItem) return
    e.preventDefault()
    const file = fileItem.getAsFile()
    if (!file) return
    await handleFile(file)
  }, [handleFile])

  // ── Drag & drop ───────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }, [handleFile])

  // ── File picker ───────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    e.target.value = ""
  }, [handleFile])

  // ── Send ──────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = value.trim()
    if ((!trimmed && !attachment) || disabled || parsing) return
    onSend(trimmed || (attachment?.kind === "image" ? "What's in this image?" : `Analyze this ${attachment?.name}`), attachment ?? undefined)
    setValue("")
    setAttachment(null)
    setParseError("")
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Accept string for file input ─────────────────────────────
  // Images + PDFs + ZIPs + all code extensions
  const acceptedTypes = [
    "image/*",
    ".pdf",
    ".zip",
    ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs",
    ".java", ".c", ".cpp", ".cs", ".php", ".swift", ".kt",
    ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml",
    ".toml", ".xml", ".md", ".mdx", ".txt", ".csv", ".sh",
    ".bash", ".env", ".graphql", ".gql",
  ].join(",")

  return (
    <div className="flex flex-col gap-2">

      {/* ── Attachment preview strip ──────────────────────────── */}
      {attachment && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-ink2 border border-rim rounded-xl">
          {/* Image: show thumbnail. File: show icon */}
          {attachment.kind === "image" && attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt="preview"
              className="w-12 h-12 object-cover rounded-lg border border-rim2 flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg border border-rim2 bg-ink3 flex items-center justify-center flex-shrink-0 text-2xl">
              {fileIcon(attachment)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-text2 text-xs font-medium truncate">{attachment.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-fog text-xs">{formatFileSize(attachment.size)}</span>
              {attachment.kind === "file" && (
                <>
                  <span className="text-rim2">·</span>
                  <span className="text-teal text-xs">
                    {attachment.fileCount !== undefined
                      ? `${attachment.fileCount} files extracted`
                      : attachment.language
                        ? attachment.language
                        : "text extracted"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Remove */}
          <button
            onClick={() => { setAttachment(null); setParseError("") }}
            className="w-6 h-6 rounded-full bg-ink3 border border-rim2 flex items-center justify-center
              text-fog hover:text-text1 hover:bg-rim transition-all flex-shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Parse error ───────────────────────────────────────── */}
      {parseError && (
        <div className="px-4 py-2 bg-red-500/5 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-xs">{parseError}</p>
        </div>
      )}

      {/* ── Main input ────────────────────────────────────────── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-end gap-2 bg-ink2 border rounded-2xl px-4 py-3
          focus-within:shadow-[0_0_0_3px_rgba(200,169,110,0.08)] transition-all duration-200
          ${isDragging
            ? "border-gold/60 bg-gold/5 shadow-[0_0_0_3px_rgba(200,169,110,0.12)]"
            : "border-rim2 focus-within:border-gold/50"
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Attach button — paperclip, glows gold when file is loaded */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || parsing}
          title="Attach file (image, PDF, ZIP, code…)"
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
            border transition-all duration-200
            ${attachment
              ? "border-gold/50 text-gold bg-gold/10"
              : "border-rim text-fog hover:border-rim2 hover:text-mist"
            } disabled:opacity-30`}
        >
          {parsing ? (
            // Spinner while parsing
            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            // Paperclip
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          )}
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          placeholder={
            parsing       ? "Reading file…" :
            isDragging    ? "Drop file here…" :
            "Message Cbae… (paste, drop, or attach a file)"
          }
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-text1 text-sm resize-none outline-none
            placeholder:text-fog disabled:opacity-50 leading-relaxed"
          style={{ minHeight: "24px", maxHeight: "160px" }}
        />

        {/* Agent mode toggle */}
        <button
          onClick={() => setAgentMode(!agentMode)}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 flex-shrink-0
            border text-xs font-medium transition-all duration-200 select-none
            ${agentMode
              ? "bg-teal/10 border-teal/40 text-teal hover:bg-teal/20"
              : "bg-ink3 border-rim text-fog hover:border-rim2 hover:text-mist"
            }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agentMode ? "bg-teal shadow-[0_0_5px_#4ecdc4] animate-pulse" : "bg-fog"}`} />
          <span>{agentMode ? "Agent" : "Direct"}</span>
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={disabled || parsing || (!value.trim() && !attachment)}
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold to-amber-700
            flex items-center justify-center flex-shrink-0
            disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink -translate-y-px">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      <p className="text-center text-fog text-xs">
        Shift+Enter for new line ·{" "}
        <span className={agentMode ? "text-teal" : "text-fog"}>
          {agentMode ? "Tools active" : "Direct mode"}
        </span>
        {" "}· Images, PDFs, ZIPs, code files supported
      </p>
    </div>
  )
}
