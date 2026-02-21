"use client"
import { useState, KeyboardEvent, useRef, useEffect, useCallback } from "react"
import { useChatStore } from "@/lib/store"

// The image attachment shape — mirrors Message.image
export interface AttachedImage {
  base64: string
  mimeType: string
  previewUrl: string
}

interface Props {
  onSend: (text: string, image?: AttachedImage) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue]           = useState("")
  const [image, setImage]           = useState<AttachedImage | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef                 = useRef<HTMLTextAreaElement>(null)
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const { agentMode, setAgentMode } = useChatStore()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [value])

  // ── Convert a File → AttachedImage ──────────────────────────
  // FileReader reads the raw bytes and gives us a data: URL.
  // We split off the "data:image/png;base64," prefix to get raw base64.
  const processFile = useCallback((file: File): Promise<AttachedImage> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Only image files are supported"))
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error("Image must be under 10 MB"))
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string
        const base64 = previewUrl.split(",")[1]
        resolve({ base64, mimeType: file.type, previewUrl })
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })
  }, [])

  // ── Paste handler — catches Ctrl+V images ────────────────────
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith("image/"))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return
    try {
      const attached = await processFile(file)
      setImage(attached)
    } catch (err: any) {
      console.error(err.message)
    }
  }, [processFile])

  // ── Drag-and-drop handlers ───────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    try {
      const attached = await processFile(file)
      setImage(attached)
    } catch (err: any) {
      console.error(err.message)
    }
  }, [processFile])

  // ── File picker ──────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const attached = await processFile(file)
      setImage(attached)
    } catch (err: any) {
      console.error(err.message)
    }
    e.target.value = ""
  }, [processFile])

  // ── Send ─────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = value.trim()
    if ((!trimmed && !image) || disabled) return
    onSend(trimmed || "What's in this image?", image ?? undefined)
    setValue("")
    setImage(null)
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Image preview strip */}
      {image && (
        <div className="flex items-center gap-3 px-4 py-2 bg-ink2 border border-rim rounded-xl">
          <img
            src={image.previewUrl}
            alt="Attached"
            className="w-12 h-12 object-cover rounded-lg border border-rim2 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-text2 text-xs truncate">Image attached</p>
            <p className="text-fog text-xs">{image.mimeType} · ready to send</p>
          </div>
          <button
            onClick={() => setImage(null)}
            className="w-6 h-6 rounded-full bg-ink3 border border-rim2 flex items-center justify-center
              text-fog hover:text-text1 hover:bg-rim transition-all flex-shrink-0"
            title="Remove image"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Main input box — the whole area is a drop zone */}
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
        {/* Hidden file input triggered by paperclip button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Paperclip / attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Attach image"
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
            border transition-all duration-200
            ${image
              ? "border-gold/50 text-gold bg-gold/10"
              : "border-rim text-fog hover:border-rim2 hover:text-mist"
            } disabled:opacity-30`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        {/* Textarea with paste handler wired up */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          placeholder={isDragging ? "Drop image here…" : "Message Cbae… (paste or drop an image)"}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-text1 text-sm resize-none outline-none
            placeholder:text-fog disabled:opacity-50 leading-relaxed"
          style={{ minHeight: "24px", maxHeight: "160px" }}
        />

        {/* Agent mode toggle */}
        <button
          onClick={() => setAgentMode(!agentMode)}
          title={agentMode ? "Agent mode ON" : "Agent mode OFF"}
          className={`
            flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 flex-shrink-0
            border text-xs font-medium transition-all duration-200 select-none
            ${agentMode
              ? "bg-teal/10 border-teal/40 text-teal hover:bg-teal/20"
              : "bg-ink3 border-rim text-fog hover:border-rim2 hover:text-mist"
            }
          `}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200
            ${agentMode ? "bg-teal shadow-[0_0_5px_#4ecdc4] animate-pulse" : "bg-fog"}`}
          />
          <span>{agentMode ? "Agent" : "Direct"}</span>
        </button>

        {/* Send button — enabled with image even if no text */}
        <button
          onClick={handleSend}
          disabled={disabled || (!value.trim() && !image)}
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold to-amber-700
            flex items-center justify-center flex-shrink-0
            disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-ink -translate-y-px">
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
        {" "}· Paste or drop an image to analyze it
      </p>
    </div>
  )
}
