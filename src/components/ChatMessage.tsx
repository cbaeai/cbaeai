"use client"
import { useState } from "react"
import { Message } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ToolCallBadge } from "./ToolCallBadge"

function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="thinking-appear mb-3">
      {/* Visible thinking circle — shown while streaming */}
      {isStreaming && (
        <div className="flex items-center gap-3 mb-2">
          {/* Spinning arc circle */}
          <div className="relative w-7 h-7 flex-shrink-0">
            {/* Outer spinning arc */}
            <svg className="thinking-ring absolute inset-0" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke="#2e2e40" strokeWidth="2" />
              <path
                d="M14 3 A11 11 0 0 1 25 14"
                stroke="#4ecdc4"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {/* Inner counter-spinning arc */}
            <svg className="thinking-ring-inner absolute inset-0" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 25 A11 11 0 0 1 3 14"
                stroke="#c8a96e"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
            </svg>
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-teal pulse-dot" />
            </div>
          </div>
          <span className="text-xs text-[#6b6b8a] font-medium tracking-wide">
            Cbae is thinking…
          </span>
        </div>
      )}

      {/* Collapsible toggle — always shown once there's content */}
      <button
        onClick={() => setOpen(o => !o)}
        className="group flex items-center gap-2 text-xs text-[#6b6b8a] hover:text-[#9a9ab8] transition-colors"
      >
        {/* Small static circle indicator (replaces emoji) */}
        <div className="relative w-4 h-4 flex-shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="w-full h-full">
            <circle cx="8" cy="8" r="6" stroke="#2e2e40" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2.5" fill={isStreaming ? "#4ecdc4" : "#6b6b8a"} opacity={isStreaming ? "0.8" : "0.5"} />
          </svg>
        </div>
        <span className="font-medium">
          {isStreaming ? "reasoning…" : "Cbae's reasoning"}
        </span>
        {/* Chevron */}
        <svg
          width="11" height="11" viewBox="0 0 12 12" fill="none"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {!isStreaming && (
          <span className="text-[#3a3a55]">{thinking.split(" ").length}w</span>
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
        {(msg.content || msg.image) && (
          <div className={`rounded-2xl px-4 py-3 text-sm
            ${isUser
              ? "bg-ink3 border border-rim2 text-text1 rounded-tr-sm"
              : "text-text1 rounded-tl-sm"
            }`}
          >
            {/* Image thumbnail — shown above text in user messages */}
            {msg.image && (
              <div className="mb-2">
                <img
                  src={msg.image.previewUrl}
                  alt="Attached image"
                  className="max-w-xs max-h-48 rounded-xl object-cover border border-rim2"
                />
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

        {/* Thinking indicator — shown while waiting for first token and no thinking block yet */}
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
      </div>
    </div>
  )
}
