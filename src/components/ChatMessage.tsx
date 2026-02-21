"use client"
import { useState, useCallback } from "react"
import { CbaeLogo } from "./CbaeLogo"
import { Message } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ToolCallBadge } from "./ToolCallBadge"

function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="thinking-appear mb-3">
      {isStreaming && (
        <div className="flex items-center gap-3 mb-2">
          <div className="relative w-7 h-7 flex-shrink-0">
            <svg className="thinking-ring absolute inset-0" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke="#2e2e40" strokeWidth="2" />
              <path d="M14 3 A11 11 0 0 1 25 14" stroke="#4ecdc4" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <svg className="thinking-ring-inner absolute inset-0" viewBox="0 0 28 28" fill="none">
              <path d="M14 25 A11 11 0 0 1 3 14" stroke="#c8a96e" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-teal pulse-dot" />
            </div>
          </div>
          <span className="text-xs text-[#6b6b8a] font-medium tracking-wide">Cbae is thinking…</span>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="group flex items-center gap-2 text-xs text-[#6b6b8a] hover:text-[#9a9ab8] transition-colors"
      >
        <div className="relative w-4 h-4 flex-shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="w-full h-full">
            <circle cx="8" cy="8" r="6" stroke="#2e2e40" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2.5" fill={isStreaming ? "#4ecdc4" : "#6b6b8a"} opacity={isStreaming ? "0.8" : "0.5"} />
          </svg>
        </div>
        <span className="font-medium">{isStreaming ? "reasoning…" : "Cbae's reasoning"}</span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {!isStreaming && <span className="text-[#3a3a55]">{thinking.split(" ").length}w</span>}
      </button>
      {open && (
        <div className="mt-2 ml-1 border-l-2 border-[#2e2e40] pl-3">
          <div className="bg-[#0e0e18] border border-[#2e2e40] rounded-xl px-4 py-3">
            <p className="text-[#7a7a98] text-xs leading-relaxed font-mono whitespace-pre-wrap">{thinking}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Generated image with loading state ────────────────────────
function GeneratedImage({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <>
      <div className="mt-3 rounded-2xl overflow-hidden border border-rim2 max-w-sm">
        {!loaded && !error && (
          <div className="flex items-center justify-center h-48 bg-ink3">
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin w-6 h-6 text-[#4a7ec3]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="text-fog text-xs">Loading image…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-24 bg-ink3 text-fog text-xs">
            Failed to load image
          </div>
        )}
        <img
          src={url}
          alt="AI generated image"
          className={`w-full object-cover cursor-zoom-in transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0 h-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          onClick={() => setFullscreen(true)}
        />
        {loaded && (
          <div className="flex items-center justify-between px-3 py-2 bg-ink3 border-t border-rim">
            <span className="text-fog text-xs">AI generated</span>
            <a
              href={url}
              download="cbae-generated.png"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#4a7ec3] hover:text-[#6b9fd6] transition-colors flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          </div>
        )}
      </div>

      {/* Fullscreen lightbox */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setFullscreen(false)}
        >
          <img src={url} alt="AI generated" className="max-w-full max-h-full rounded-xl object-contain" />
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl leading-none"
          >✕</button>
        </div>
      )}
    </>
  )
}

// ── Copy button ───────────────────────────────────────────────
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
      title="Copy message"
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-fog hover:text-mist hover:bg-ink3 transition-all text-xs"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span className="text-teal">Copied</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

// ── Main ChatMessage ──────────────────────────────────────────
export function ChatMessage({
  msg,
  isLast,
  onRegenerate,
}: {
  msg: Message
  isLast?: boolean
  onRegenerate?: () => void
}) {
  const isUser = msg.role === "user"
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`msg-in flex gap-3 px-4 py-3 group ${isUser ? "flex-row-reverse" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold
        ${isUser ? "bg-ink3 border border-rim2 text-mist" : "bg-[#0d1a2e] border border-[#1e3d6e]"}`}
      >
        {isUser ? "U" : <CbaeLogo size={22} />}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : ""}`}>

        {/* Thinking block */}
        {!isUser && msg.thinking && (
          <ThinkingBlock thinking={msg.thinking} isStreaming={msg.isStreaming} />
        )}

        {/* Tool calls */}
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-col gap-0.5 mb-1">
            {msg.toolCalls.map((tc, i) => <ToolCallBadge key={i} tc={tc} />)}
          </div>
        )}

        {/* Message bubble */}
        {(msg.content || msg.attachment) && (
          <div className={`rounded-2xl px-4 py-3 text-sm
            ${isUser
              ? "bg-ink3 border border-rim2 text-text1 rounded-tr-sm"
              : "text-text1 rounded-tl-sm"
            }`}
          >
            {/* Attachment */}
            {msg.attachment && (
              <div className="mb-2">
                {msg.attachment.kind === "image" && msg.attachment.previewUrl ? (
                  <img src={msg.attachment.previewUrl} alt="Attached image"
                    className="max-w-xs max-h-48 rounded-xl object-cover border border-rim2" />
                ) : (
                  <div className="inline-flex items-center gap-2 bg-ink3 border border-rim2 rounded-xl px-3 py-2">
                    <span className="text-lg">{
                      msg.attachment.name.endsWith(".pdf") ? "📄" :
                      msg.attachment.name.endsWith(".zip") ? "🗜️" : "📁"
                    }</span>
                    <div>
                      <p className="text-text2 text-xs font-medium">{msg.attachment.name}</p>
                      <p className="text-fog text-xs">
                        {msg.attachment.fileCount !== undefined
                          ? `${msg.attachment.fileCount} files`
                          : msg.attachment.language || "text extracted"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isUser ? (
              <p className="text-text1 text-sm leading-relaxed">{msg.content}</p>
            ) : (
              <MarkdownRenderer content={msg.content} />
            )}

            {/* Streaming cursor */}
            {msg.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-gold/70 rounded-sm ml-0.5 pulse-dot align-middle" />
            )}
          </div>
        )}

        {/* Generated image */}
        {!isUser && msg.generatedImageUrl && (
          <GeneratedImage url={msg.generatedImageUrl} />
        )}

        {/* Thinking indicator — while waiting for first token */}
        {msg.isStreaming && !msg.content && !msg.thinking && (
          <div className="flex items-center gap-3 px-1 py-2">
            <div className="relative w-7 h-7 flex-shrink-0">
              <svg className="thinking-ring absolute inset-0" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="11" stroke="#2e2e40" strokeWidth="2" />
                <path d="M14 3 A11 11 0 0 1 25 14" stroke="#4ecdc4" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <svg className="thinking-ring-inner absolute inset-0" viewBox="0 0 28 28" fill="none">
                <path d="M14 25 A11 11 0 0 1 3 14" stroke="#c8a96e" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-teal pulse-dot" />
              </div>
            </div>
            <span className="text-xs text-[#6b6b8a] font-medium">Thinking…</span>
          </div>
        )}

        {/* Action bar — copy + regenerate, shown on hover when not streaming */}
        {!msg.isStreaming && hovered && (
          <div className={`flex items-center gap-1 mt-0.5 ${isUser ? "flex-row-reverse" : ""}`}>
            {msg.content && <CopyButton text={msg.content} />}
            {/* Regenerate — only on last assistant message */}
            {!isUser && isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Regenerate response"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-fog hover:text-mist hover:bg-ink3 transition-all text-xs"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
