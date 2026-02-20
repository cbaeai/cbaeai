"use client"
import { ToolCall } from "@/types"

const TOOL_ICONS: Record<string, string> = {
  web_search:   "🔍",
  get_weather:  "🌤",
  get_news:     "📰",
  calculator:   "🧮",
  run_python:   "🐍",
  get_datetime: "🕐",
  save_note:    "📝",
  get_note:     "📖",
}

export function ToolCallBadge({ tc }: { tc: ToolCall }) {
  const icon = TOOL_ICONS[tc.tool] || "⚙️"
  const argsStr = Object.entries(tc.args)
    .map(([k, v]) => `${k}: "${String(v).slice(0, 40)}"`)
    .join(", ")

  return (
    <div className="tool-in flex flex-col gap-1 my-1">
      <div className="inline-flex items-center gap-2 bg-gold/5 border border-gold/20 rounded-full px-3 py-1 w-fit">
        <span className="text-xs">{icon}</span>
        <span className="text-gold text-xs font-medium tracking-wide">{tc.tool}</span>
        <span className="text-fog text-xs truncate max-w-[200px]">({argsStr})</span>
      </div>
      {tc.result && (
        <div className="text-xs text-mist bg-ink2 border border-rim rounded-lg px-3 py-2 ml-4 max-w-sm truncate">
          {tc.result}
        </div>
      )}
    </div>
  )
}
