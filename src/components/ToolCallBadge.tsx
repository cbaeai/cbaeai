"use client"
import { ToolCall } from "@/types"

const TOOL_ICONS: Record<string, string> = {
  web_search:             "🔍",
  search_images:          "🖼️",
  get_weather:            "🌤",
  calculator:             "🧮",
  browse_url:             "🌐",
  save_note:              "📝",
  run_code:               "💻",
  moltbook_feed:          "⬡",
  moltbook_post:          "✍️",
  moltbook_search:        "🔎",
  moltbook_profile:       "👤",
  moltbook_comment:       "💬",
  moltbook_discover:      "🤖",
  moltbook_agent_profile: "📋",
  moltbook_follow_agent:  "➕",
  moltbook_read_post:     "📖",
}

const TOOL_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  web_search:             (a) => `Searching "${a.query}"`,
  search_images:          (a) => `Images of "${a.query}"`,
  get_weather:            (a) => `Weather in ${a.location}`,
  calculator:             (a) => `${a.expression}`,
  browse_url:             (a) => `${String(a.url).replace(/^https?:\/\//, "").slice(0, 45)}`,
  save_note:              (_) => `Saving note`,
  run_code:               (a) => `Running ${a.language}`,
  moltbook_feed:          (a) => `Reading ${a.sort || "hot"} feed`,
  moltbook_post:          (a) => `Posting "${a.title}"`,
  moltbook_search:        (a) => `Searching "${a.query}"`,
  moltbook_profile:       (_) => `Checking profile`,
  moltbook_comment:       (a) => `Commenting on ${a.post_id}`,
  moltbook_discover:      (a) => a.query ? `Discovering agents: "${a.query}"` : `Discovering agents`,
  moltbook_agent_profile: (a) => `@${a.agent_name}`,
  moltbook_follow_agent:  (a) => `Following @${a.agent_name}`,
  moltbook_read_post:     (a) => `Post ${a.post_id}`,
}

const HIDE_RESULT = new Set(["search_images"])

export function ToolCallBadge({ tc }: { tc: ToolCall }) {
  const icon = TOOL_ICONS[tc.tool] || "⚙"
  const isMoltbook = tc.tool.startsWith("moltbook_")

  const labelFn = TOOL_LABELS[tc.tool]
  const label = labelFn
    ? labelFn(tc.args)
    : Object.entries(tc.args).filter(([k]) => k !== "key").map(([, v]) => String(v).slice(0, 40)).join(", ")

  return (
    <div className="tool-in flex flex-col gap-1">
      <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 w-fit text-xs border
        ${isMoltbook
          ? "bg-[#4ecdc4]/5 border-[#4ecdc4]/15 text-[#4ecdc4]"
          : "bg-[#d97706]/5 border-[#d97706]/15 text-[#d97706]"
        }`}
      >
        <span>{icon}</span>
        <span className="font-medium">{label}</span>
        {!tc.result ? (
          <svg className="animate-spin w-3 h-3 opacity-60 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 opacity-80">
            <polyline points="2 6 5 9 10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {tc.result && !HIDE_RESULT.has(tc.tool) && (
        <div className="text-xs text-[#8e8e8e] bg-[#252525] border border-[#333] rounded-lg px-3 py-2 ml-5 max-w-sm truncate">
          {tc.result}
        </div>
      )}
    </div>
  )
}
