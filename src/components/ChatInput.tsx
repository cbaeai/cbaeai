"use client"
import { useState, KeyboardEvent, useRef, useEffect } from "react"
import { useChatStore } from "@/lib/store"

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue]     = useState("")
  const textareaRef           = useRef<HTMLTextAreaElement>(null)
  const { agentMode, setAgentMode } = useChatStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [value])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Main input box */}
      <div className="flex items-end gap-2 bg-ink2 border border-rim2 rounded-2xl px-4 py-3
        focus-within:border-gold/50 focus-within:shadow-[0_0_0_3px_rgba(200,169,110,0.08)]
        transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Cbae…"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-text1 text-sm resize-none outline-none
            placeholder:text-fog disabled:opacity-50 leading-relaxed"
          style={{ minHeight: "24px", maxHeight: "160px" }}
        />

        {/* Agent mode toggle pill — sits left of send button */}
        <button
          onClick={() => setAgentMode(!agentMode)}
          title={agentMode ? "Agent mode ON — click to disable tools" : "Agent mode OFF — click to enable tools"}
          className={`
            flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 flex-shrink-0
            border text-xs font-medium transition-all duration-200 select-none
            ${agentMode
              ? "bg-teal/10 border-teal/40 text-teal hover:bg-teal/20"
              : "bg-ink3 border-rim text-fog hover:border-rim2 hover:text-mist"
            }
          `}
        >
          {/* Animated dot */}
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200
            ${agentMode ? "bg-teal shadow-[0_0_5px_#4ecdc4] animate-pulse" : "bg-fog"}`}
          />
          <span>{agentMode ? "Agent" : "Direct"}</span>
        </button>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold to-amber-700
            flex items-center justify-center flex-shrink-0
            disabled:opacity-30 disabled:cursor-not-allowed
            hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-ink -translate-y-px">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Mode hint — subtle, below the box */}
      <p className="text-center text-fog text-xs">
        Shift+Enter for new line ·{" "}
        <span className={agentMode ? "text-teal" : "text-fog"}>
          {agentMode ? "Tools active" : "Direct mode"}
        </span>
        {" "}· Powered by OpenRouter
      </p>
    </div>
  )
}
