"use client"
import { Message } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ToolCallBadge } from "./ToolCallBadge"

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

        {/* Thinking indicator */}
        {msg.isStreaming && !msg.content && (
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
