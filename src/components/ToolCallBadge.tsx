"use client"
import { ToolCall } from "@/types"

const TOOL_ICONS: Record<string, string> = {
  // Server tools
  web_search:            "🔍",
  get_weather:           "🌤",
  calculator:            "🧮",
  browse_url:            "🌐",
  save_note:             "📝",
  get_note:              "📖",
  // Moltbook tools
  moltbook_feed:         "⬡",
  moltbook_post:         "✍️",
  moltbook_search:       "🔎",
  moltbook_profile:      "👤",
  moltbook_comment:      "💬",
  moltbook_discover:     "🤖",
  moltbook_agent_profile:"📋",
  moltbook_follow_agent: "➕",
  moltbook_read_post:    "📖",
}

// Human-readable label for each tool
const TOOL_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  web_search:            (a) => `Searching "${a.query}"`,
  get_weather:           (a) => `Weather in ${a.location}`,
  calculator:            (a) => `Calculating ${a.expression}`,
  browse_url:            (a) => `Browsing ${String(a.url).slice(0, 40)}`,
  save_note:             (a) => `Saving note`,
  moltbook_feed:         (a) => `Reading ${a.sort || "hot"} feed`,
  moltbook_post:         (a) => `Posting "${a.title}"`,
  moltbook_search:       (a) => `Searching "${a.query}"`,
  moltbook_profile:      (_) => `Checking profile`,
  moltbook_comment:      (a) => `Commenting on post ${a.post_id}`,
  moltbook_discover:     (a) => a.query ? `Discovering agents matching "${a.query}"` : `Discovering agents`,
  moltbook_agent_profile:(a) => `Profile of @${a.agent_name}`,
  moltbook_follow_agent: (a) => `Following @${a.agent_name}`,
  moltbook_read_post:    (a) => `Reading post ${a.post_id}`,
}

export function ToolCallBadge({ tc }: { tc: ToolCall }) {
  const icon  = TOOL_ICONS[tc.tool] || "⚙️"
  const isMoltbook = tc.tool.startsWith("moltbook_")

  // Build a clean human label — never show the API key
  const labelFn = TOOL_LABELS[tc.tool]
  const label = labelFn
    ? labelFn(tc.args)
    : Object.entries(tc.args)
        .filter(([k]) => k !== "key")          // always hide key
        .map(([, v]) => String(v).slice(0, 40))
        .join(", ")

  return (
    <div className="tool-in flex flex-col gap-1 my-0.5">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 w-fit
        ${isMoltbook
          ? "bg-teal/5 border border-teal/20"
          : "bg-gold/5 border border-gold/20"
        }`}
      >
        <span className="text-xs">{icon}</span>
        <span className={`text-xs font-medium tracking-wide ${isMoltbook ? "text-teal" : "text-gold"}`}>
          {tc.tool}
        </span>
        <span className="text-fog text-xs truncate max-w-[220px]">
          {label}
        </span>
      </div>

      {tc.result && (
        <div className="text-xs text-mist bg-ink2 border border-rim rounded-lg px-3 py-2 ml-4 max-w-sm truncate">
          {tc.result}
        </div>
      )}
    </div>
  )
}
