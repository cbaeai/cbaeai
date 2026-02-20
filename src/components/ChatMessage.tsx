"use client"
import { useState } from "react"
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
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
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

// Fix #5: Image display component
function GeneratedImage({ url, prompt }: { url: string; prompt: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-[#2e2e40] max-w-sm">
      {!loaded && !error && (
        <div className="bg-[#0e0e18] h-48 flex items-center justify-center">
          <div className="text-[#4a4a60] text-xs animate-pulse">Loading image…</div>
        </div>
      )}
      {error && (
        <div className="bg-[#0e0e18] h-24 flex items-center justify-center">
          <div className="text-[#4a4a60] text-xs">Image failed to load</div>
        </div>
      )}
      <img
        src={url}
        alt={prompt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0 h-0"}`}
      />
      {loaded && (
        <div className="bg-[#0c0c16] px-3 py-2 flex items-center justify-between gap-2">
          <p className="text-[#4a4a60] text-[10px] truncate">{prompt}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#c8a96e] hover:text-[#d4b87a] whitespace-nowrap transition-colors"
          >
            Open ↗
          </a>
        </div>
      )}
    </div>
  )
}

export function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"

  return (
    <div className={`msg-in flex gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold
        ${isUser
          ? "bg-ink3 border border-rim2 text-mist"
          : "bg-gradient-to-br from-gold to-amber-700 text-ink"
        }`}
      >
        {isUser ? "U" : "✦"}
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

        {/* Fix #5: Generated image */}
        {!isUser && msg.imageUrl && (
          <GeneratedImage url={msg.imageUrl} prompt={msg.content || "Generated image"} />
        )}

        {/* Message bubble */}
        {msg.content && !msg.imageUrl && (
          <div className={`rounded-2xl px-4 py-3 text-sm
            ${isUser
              ? "bg-ink3 border border-rim2 text-text1 rounded-tr-sm"
              : "text-text1 rounded-tl-sm"
            }`}
          >
            {isUser ? (
              <p className="text-text1 text-sm leading-relaxed">{msg.content}</p>
            ) : (
              <MarkdownRenderer content={msg.content} />
            )}
            {msg.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-gold/70 rounded-sm ml-0.5 pulse-dot align-middle" />
            )}
          </div>
        )}

        {/* Show text below image if any */}
        {msg.content && msg.imageUrl && (
          <div className="text-text1 text-sm rounded-tl-sm">
            <MarkdownRenderer content={msg.content} />
          </div>
        )}

        {/* Thinking spinner when no content yet */}
        {msg.isStreaming && !msg.content && !msg.thinking && !msg.imageUrl && (
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
      </div>
    </div>
  )
}
