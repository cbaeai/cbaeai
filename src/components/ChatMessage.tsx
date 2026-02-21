"use client"
import { useState, useCallback } from "react"
import { CbaeLogo } from "./CbaeLogo"
import { Message } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ToolCallBadge } from "./ToolCallBadge"

/* ── Thinking block ────────────────────────────────────────── */
function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="thinking-appear mb-2">
      {isStreaming && (
        <div className="flex items-center gap-2 mb-1.5 text-xs text-[#8e8e8e]">
          <div className="relative w-4 h-4 flex-shrink-0">
            <svg className="thinking-ring absolute inset-0" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="#3a3a3a" strokeWidth="1.5"/>
              <path d="M8 2 A6 6 0 0 1 14 8" stroke="#4ecdc4" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          Thinking…
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-[#b4b4b4] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        {isStreaming ? "Reasoning…" : "Reasoning"}
        {!isStreaming && <span className="text-[#555]">{thinking.split(" ").length}w</span>}
      </button>
      {open && (
        <div className="mt-2 pl-4 border-l-2 border-[#333]">
          <p className="text-xs text-[#8e8e8e] leading-relaxed font-mono whitespace-pre-wrap">{thinking}</p>
        </div>
      )}
    </div>
  )
}

/* ── Image grid ─────────────────────────────────────────────── */
function SearchImageGrid({ images }: { images: Array<{ url: string; title: string; source: string; thumbnail?: string }> }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [failed, setFailed] = useState<Set<string>>(new Set())

  const valid = images.filter(img => img.url && !failed.has(img.url)).slice(0, 3)

  return (
    <>
      <div className="mt-2 grid grid-cols-3 gap-2 max-w-sm">
        {valid.map((img, i) => (
          <div
            key={i}
            onClick={() => setSelected(img.url)}
            className="relative group cursor-zoom-in rounded-xl overflow-hidden bg-[#2a2a2a] aspect-square"
          >
            <img
              src={img.thumbnail || img.url}
              alt={img.title}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              onError={() => setFailed(f => { const s = new Set(f); s.add(img.url); return s })}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors rounded-xl" />
          </div>
        ))}
      </div>
      {valid.length > 0 && <p className="text-[11px] text-[#555] mt-1">Click to expand</p>}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setSelected(null)}>
          <img src={selected} alt="" className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()} />
          <div className="flex items-center gap-3 mt-4" onClick={e => e.stopPropagation()}>
            <a href={selected} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#7eb8f7] hover:underline">Open original ↗</a>
            <button onClick={() => setSelected(null)} className="text-xs text-white/50 hover:text-white transition-colors">Close ✕</button>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Copy button ─────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[#8e8e8e] hover:text-[#b4b4b4] hover:bg-[#2a2a2a] transition-all text-xs"
      title="Copy"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span className="text-[#4ecdc4]">Copied</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

/* ── Main ChatMessage ─────────────────────────────────────────── */
export function ChatMessage({ msg, isLast, onRegenerate }: {
  msg: Message
  isLast?: boolean
  onRegenerate?: () => void
}) {
  const isUser = msg.role === "user"
  const [hovered, setHovered] = useState(false)

  if (isUser) {
    return (
      <div className="msg-in py-3 px-4 md:px-8 flex justify-end"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="max-w-[75%] flex flex-col items-end gap-1">
          {msg.attachment && (
            <div className="mb-1">
              {msg.attachment.kind === "image" && msg.attachment.previewUrl ? (
                <img src={msg.attachment.previewUrl} alt="Attached"
                  className="max-w-xs max-h-48 rounded-xl object-cover border border-[#3a3a3a]" />
              ) : (
                <div className="inline-flex items-center gap-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl px-3 py-2">
                  <span className="text-lg">{msg.attachment.name.endsWith(".pdf") ? "📄" : msg.attachment.name.endsWith(".zip") ? "🗜️" : "📁"}</span>
                  <div>
                    <p className="text-xs font-medium text-[#ececec]">{msg.attachment.name}</p>
                    <p className="text-[11px] text-[#8e8e8e]">
                      {msg.attachment.fileCount !== undefined ? `${msg.attachment.fileCount} files` : msg.attachment.language || "text extracted"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {msg.content && (
            <div className="bg-[#2f2f2f] border border-[#3a3a3a] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[#ececec] text-sm leading-relaxed">
              {msg.content}
            </div>
          )}
          {hovered && msg.content && (
            <div className="flex items-center gap-1">
              <CopyButton text={msg.content} />
            </div>
          )}
        </div>
      </div>
    )
  }

  /* Assistant message */
  return (
    <div className="msg-in py-5 px-4 md:px-8"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] flex-shrink-0 flex items-center justify-center mt-0.5">
          <CbaeLogo size={16} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Thinking */}
          {msg.thinking && <ThinkingBlock thinking={msg.thinking} isStreaming={msg.isStreaming} />}

          {/* Tool calls */}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {msg.toolCalls.map((tc, i) => <ToolCallBadge key={i} tc={tc} />)}
            </div>
          )}

          {/* Image search results */}
          {msg.searchImages && msg.searchImages.length > 0 && (
            <SearchImageGrid images={msg.searchImages} />
          )}

          {/* Loading spinner — waiting for first token */}
          {msg.isStreaming && !msg.content && !msg.thinking && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-[#555] pulse-dot" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#555] pulse-dot" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#555] pulse-dot" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* Main content */}
          {msg.content && (
            <div className="prose">
              <MarkdownRenderer content={msg.content} />
              {msg.isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-[#ececec]/60 rounded-sm ml-0.5 pulse-dot align-middle" />
              )}
            </div>
          )}

          {/* Action bar */}
          {!msg.isStreaming && hovered && (
            <div className="flex items-center gap-1 mt-2">
              {msg.content && <CopyButton text={msg.content} />}
              {isLast && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[#8e8e8e] hover:text-[#b4b4b4] hover:bg-[#2a2a2a] transition-all text-xs"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                  </svg>
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
