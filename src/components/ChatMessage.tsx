"use client"
import { useState } from "react"
import { Message } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ToolCallBadge } from "./ToolCallBadge"

function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="group flex items-center gap-2 text-xs text-[#6b6b8a] hover:text-[#9a9ab8] transition-colors"
      >
        {/* Animated brain pulse while streaming */}
        <span className={`text-sm ${isStreaming && !open ? "animate-pulse" : ""}`}>
          🧠
        </span>
        <span className="font-medium tracking-wide">
          {isStreaming ? "Cbae is reasoning…" : "Cbae's reasoning"}
        </span>
        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {/* Token count hint */}
        {!isStreaming && (
          <span className="text-[#3a3a55] ml-1">
            {thinking.split(" ").length} words
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 ml-1 border-l-2 border-[#2e2e40] pl-3">
          <div className="bg-[#0e0e18] border border-[#2e2e40] rounded-xl px-4 py-3">
            <p className="text-[#7a7a98] text-xs leading-relaxed font-mono whitespace-pre-wrap">
              {thinking}
            </p>
          </div>
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

        {/* Thinking block — assistant only, shown above tools and content */}
        {!isUser && msg.thinking && (
          <ThinkingBlock thinking={msg.thinking} isStreaming={msg.isStreaming} />
        )}

        {/* Tool calls (assistant only) */}
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-col gap-0.5 mb-1">
            {msg.toolCalls.map((tc, i) => (
              <ToolCallBadge key={i} tc={tc} />
            ))}
          </div>
        )}

        {/* Message bubble */}
        {msg.content && (
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

            {/* Streaming cursor */}
            {msg.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-gold/70 rounded-sm ml-0.5 pulse-dot align-middle" />
            )}
          </div>
        )}

        {/* Thinking indicator — shown while waiting for first token */}
        {msg.isStreaming && !msg.content && !msg.thinking && (
          <div className="flex items-center gap-1.5 px-4 py-3">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 bg-gold/50 rounded-full pulse-dot"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
