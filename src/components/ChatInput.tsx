"use client"
import { useState, KeyboardEvent, useRef, useEffect } from "react"

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue]   = useState("")
  const textareaRef         = useRef<HTMLTextAreaElement>(null)

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
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold to-amber-700
          flex items-center justify-center flex-shrink-0
          disabled:opacity-30 disabled:cursor-not-allowed
          hover:opacity-90 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink -translate-y-px">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
