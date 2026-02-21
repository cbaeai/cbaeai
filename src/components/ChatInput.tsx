"use client"
import { useState, KeyboardEvent, useRef, useEffect, useCallback } from "react"
import { useChatStore } from "@/lib/store"
import { processFile, formatFileSize, fileIcon, classifyFile } from "@/lib/fileParser"
import type { Attachment } from "@/types"

export type { Attachment }

interface Props {
  onSend: (text: string, attachment?: Attachment) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue]           = useState("")
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parseError, setParseError] = useState("")
  const [parsing, setParsing]       = useState(false)
  const textareaRef                 = useRef<HTMLTextAreaElement>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const { agentMode, setAgentMode } = useChatStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [value])

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

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const fileItem = items.find(item => item.kind === "file")
    if (!fileItem) return
    e.preventDefault()
    const file = fileItem.getAsFile()
    if (!file) return
    await handleFile(file)
  }, [handleFile])

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }, [handleFile])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    e.target.value = ""
  }, [handleFile])

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

  const canSend = (value.trim() || attachment) && !disabled && !parsing

  const acceptedTypes = [
    "image/*", ".pdf", ".zip",
    ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs",
    ".java", ".c", ".cpp", ".cs", ".php", ".swift", ".kt",
    ".sql", ".html", ".css", ".scss", ".json", ".yaml", ".yml",
    ".toml", ".xml", ".md", ".mdx", ".txt", ".csv", ".sh",
    ".bash", ".env", ".graphql", ".gql",
  ].join(",")

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-[#252525] border border-[#333] rounded-xl">
          {attachment.kind === "image" && attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="preview" className="w-10 h-10 object-cover rounded-lg border border-[#3a3a3a] flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 text-xl">
              {fileIcon(attachment)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#ececec] truncate">{attachment.name}</p>
            <p className="text-[11px] text-[#8e8e8e] mt-0.5">
              {formatFileSize(attachment.size)}
              {attachment.kind === "file" && (
                <> · <span className="text-[#4ecdc4]">
                  {attachment.fileCount !== undefined ? `${attachment.fileCount} files` : attachment.language || "extracted"}
                </span></>
              )}
            </p>
          </div>
          <button
            onClick={() => { setAttachment(null); setParseError("") }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#3a3a3a] transition-colors flex-shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {parseError && (
        <div className="px-3 py-2 mb-2 bg-red-500/8 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-xs">{parseError}</p>
        </div>
      )}

      {/* Main input box — Claude style */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col bg-[#2f2f2f] border rounded-2xl transition-all duration-150
          ${isDragging ? "border-[#4ecdc4]/50 bg-[#4ecdc4]/5" : "border-[#3a3a3a] hover:border-[#454545] focus-within:border-[#555]"}`}
      >
        <input ref={fileInputRef} type="file" accept={acceptedTypes} className="hidden" onChange={handleFileChange} />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          placeholder={parsing ? "Reading file…" : isDragging ? "Drop file here…" : "Message Cbae"}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-[#ececec] text-sm resize-none outline-none
            placeholder:text-[#555] disabled:opacity-50 leading-relaxed
            px-4 pt-3.5 pb-1"
          style={{ minHeight: "28px", maxHeight: "200px" }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-1">
            {/* Attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || parsing}
              title="Attach file"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30
                ${attachment ? "text-[#4ecdc4] bg-[#4ecdc4]/10" : "text-[#8e8e8e] hover:text-[#b4b4b4] hover:bg-[#3a3a3a]"}`}
            >
              {parsing ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              )}
            </button>

            {/* Agent toggle */}
            <button
              onClick={() => setAgentMode(!agentMode)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all select-none
                ${agentMode
                  ? "bg-[#4ecdc4]/10 text-[#4ecdc4] border border-[#4ecdc4]/25 hover:bg-[#4ecdc4]/15"
                  : "text-[#8e8e8e] border border-transparent hover:bg-[#3a3a3a] hover:text-[#b4b4b4]"
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agentMode ? "bg-[#4ecdc4] animate-pulse" : "bg-[#555]"}`} />
              {agentMode ? "Agent on" : "Agent off"}
            </button>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
              ${canSend
                ? "bg-[#ececec] hover:bg-white text-[#1a1a1a]"
                : "bg-[#3a3a3a] text-[#555] cursor-not-allowed"
              }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>

      <p className="text-center text-[#555] text-[11px] mt-2">
        Cbae can make mistakes. Shift+Enter for new line.
      </p>
    </div>
  )
}
