"use client"
import { ToolCall } from "@/types"

const TOOL_ICONS: Record<string, string> = {
  // Server tools
  web_search:             "🔍",
  search_images:          "🖼️",
  get_weather:            "🌤",
  calculator:             "🧮",
  browse_url:             "🌐",
  save_note:              "📝",
  run_code:               "💻",
  // Moltbook tools
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

// Human-readable label for each tool
const TOOL_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  web_search:             (a) => `Searching "${a.query}"`,
  search_images:          (a) => `Images of "${a.query}"`,
  get_weather:            (a) => `Weather in ${a.location}`,
  calculator:             (a) => `Calculating ${a.expression}`,
  browse_url:             (a) => `Browsing ${String(a.url).slice(0, 40)}`,
  save_note:              (_) => `Saving note`,
  run_code:               (a) => `Running ${a.language} code`,
  moltbook_feed:          (a) => `Reading ${a.sort || "hot"} feed`,
  moltbook_post:          (a) => `Posting "${a.title}"`,
  moltbook_search:        (a) => `Searching "${a.query}"`,
  moltbook_profile:       (_) => `Checking profile`,
  moltbook_comment:       (a) => `Commenting on post ${a.post_id}`,
  moltbook_discover:      (a) => a.query ? `Discovering agents matching "${a.query}"` : `Discovering agents`,
  moltbook_agent_profile: (a) => `Profile of @${a.agent_name}`,
  moltbook_follow_agent:  (a) => `Following @${a.agent_name}`,
  moltbook_read_post:     (a) => `Reading post ${a.post_id}`,
}

// Tools whose result pill should be hidden (shown in the UI another way)
const HIDE_RESULT = new Set(["search_images"])

export function ToolCallBadge({ tc }: { tc: ToolCall }) {
  const icon = TOOL_ICONS[tc.tool] || "⚙️"
  const isMoltbook = tc.tool.startsWith("moltbook_")

  // Build a clean human label — never show the API key
  const labelFn = TOOL_LABELS[tc.tool]
  const label = labelFn
    ? labelFn(tc.args)
    : Object.entries(tc.args)
        .filter(([k]) => k !== "key")
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
          {label}
        </span>
        {/* Spinner while waiting for result */}
        {!tc.result && (
          <svg className="animate-spin w-3 h-3 text-fog flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
        {/* Checkmark when done */}
        {tc.result && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
            <polyline points="2 6 5 9 10 3" stroke="#4ecdc4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Result pill — hidden for tools that show results in the UI (e.g. image grid) */}
      {tc.result && !HIDE_RESULT.has(tc.tool) && (
        <div className="text-xs text-mist bg-ink2 border border-rim rounded-lg px-3 py-2 ml-4 max-w-sm truncate">
          {tc.result}
        </div>
      )}
    </div>
  )
}
