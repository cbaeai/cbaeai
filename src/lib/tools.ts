// Server-side only — no "use client"
// Exports: TOOLS (OpenAI function schemas) + executeTool (server-side execution)

import { memorize } from "@/lib/memory"

export const TOOLS: object[] = [
  // ── Web / utility ─────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, news, facts, or anything that may have changed recently.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browse_url",
      description: "Fetch and read the content of a URL.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_images",
      description: "Search the web for images. Use this when the user asks to find, show, or search for images of something. Returns a grid of real image results from the web.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search images for" },
          count: { type: "number", description: "Number of images to return (default: 6, max: 9)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Evaluate a mathematical expression and return the result.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "A math expression, e.g. '2 + 2 * 10'" },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City and country, e.g. 'London, UK'" },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_note",
      description: "Save a note or piece of information to memory for later.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The note content to save" },
        },
        required: ["content"],
      },
    },
  },

  // ── Code execution ───────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "run_code",
      description: "Execute Python or JavaScript code and return the output. Use this to verify code you write, run calculations, process data, or test logic. Always run code you are unsure about before presenting it.",
      parameters: {
        type: "object",
        properties: {
          language: { type: "string", enum: ["python", "javascript"], description: "Language to run" },
          code:     { type: "string", description: "The code to execute" },
        },
        required: ["language", "code"],
      },
    },
  },

  // ── Moltbook core ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "moltbook_feed",
      description: "Read the Moltbook feed. Returns recent posts from the social network.",
      parameters: {
        type: "object",
        properties: {
          key:   { type: "string", description: "Moltbook API key" },
          sort:  { type: "string", enum: ["hot", "new", "top", "rising"], description: "Feed sort order" },
          limit: { type: "number", description: "Number of posts to fetch (max 25)" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moltbook_post",
      description: "Create a new post on Moltbook.",
      parameters: {
        type: "object",
        properties: {
          key:      { type: "string", description: "Moltbook API key" },
          title:    { type: "string", description: "Post title" },
          content:  { type: "string", description: "Post body content" },
          submolt:  { type: "string", description: "Submolt/community to post in (default: general)" },
        },
        required: ["key", "title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moltbook_search",
      description: "Search Moltbook for posts or agents.",
      parameters: {
        type: "object",
        properties: {
          key:   { type: "string", description: "Moltbook API key" },
          query: { type: "string", description: "Search query" },
        },
        required: ["key", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moltbook_profile",
      description: "Get your own Moltbook agent profile and stats.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Moltbook API key" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moltbook_comment",
      description: "Post a comment on a Moltbook post.",
      parameters: {
        type: "object",
        properties: {
          key:     { type: "string", description: "Moltbook API key" },
          post_id: { type: "string", description: "ID of the post to comment on" },
          content: { type: "string", description: "Comment text" },
        },
        required: ["key", "post_id", "content"],
      },
    },
  },

  // ── Moltbook multi-agent ───────────────────────────────────────
  {
    type: "function",
    function: {
      name: "moltbook_discover",
      description: "Scan the Moltbook feed and discover other active AI agents. Returns a list of agents with their recent activity.",
      parameters: {
        type: "object",
        properties: {
          key:   { type: "string", description: "Moltbook API key" },
          query: { type: "string", description: "Optional topic or name filter" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moltbook_agent_profile",
      description: "Get the full profile and recent posts of a specific Moltbook agent by username.",
      parameters: {
        type: "object",
        properties: {
          key:        { type: "string", description: "Moltbook API key" },
          agent_name: { type: "string", description: "The agent's username (without @)" },
        },
        required: ["key", "agent_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moltbook_follow_agent",
      description: "Follow another agent on Moltbook.",
      parameters: {
        type: "object",
        properties: {
          key:        { type: "string", description: "Moltbook API key" },
          agent_name: { type: "string", description: "The agent's username to follow (without @)" },
        },
        required: ["key", "agent_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moltbook_read_post",
      description: "Read the full content and all comments of a specific Moltbook post. Use this before commenting so you write something relevant.",
      parameters: {
        type: "object",
        properties: {
          key:     { type: "string", description: "Moltbook API key" },
          post_id: { type: "string", description: "The post ID to read" },
        },
        required: ["key", "post_id"],
      },
    },
  },
]

// ── Server-side tool execution ─────────────────────────────────
// Only non-Moltbook tools run here. Moltbook tools are delegated to the browser.

export async function executeTool(tool: string, args: Record<string, any>): Promise<string> {
  try {
    switch (tool) {

      case "search_images": {
        const query = encodeURIComponent(args.query || "")
        const count = Math.min(args.count || 6, 9)
        const res = await fetch(
          `https://api.search.brave.com/res/v1/images/search?q=${query}&count=${count}&safesearch=moderate`,
          {
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": process.env.BRAVE_KEY || "",
            },
          }
        )
        const data = await res.json()
        const results = data.results || []
        if (!results.length) return `SEARCH_IMAGES_EMPTY:No images found for: "${args.query}"`
        const images = results.slice(0, count).map((r: any) => ({
          url: r.properties?.url || r.url || "",
          thumbnail: r.thumbnail?.src || r.properties?.url || "",
          title: r.title || "",
          source: r.source || r.meta_url?.hostname || "",
        }))
        return `SEARCH_IMAGES:${JSON.stringify(images)}`
      }

      case "web_search": {
        const query = encodeURIComponent(args.query || "")
        const res = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${query}&count=5`,
          {
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": process.env.BRAVE_KEY || "",
            },
          }
        )
        const data = await res.json()
        const results = data.web?.results || []
        if (!results.length) return `No results found for: "${args.query}"`
        return results.slice(0, 5).map((r: any, i: number) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description || ""}`
        ).join("\n\n")
      }

      case "browse_url": {
        const res = await fetch(args.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Cbae/1.0)" },
          signal: AbortSignal.timeout(10000),
        })
        const text = await res.text()
        // Strip HTML tags, collapse whitespace
        const clean = text
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
        return clean.slice(0, 3000) + (clean.length > 3000 ? "\n...[truncated]" : "")
      }

      case "calculator": {
        // Safe eval using Function
        const expr = args.expression || ""
        // Basic sanity check — only allow math chars
        if (!/^[0-9+\-*/().\s%^]+$/.test(expr.replace(/Math\.\w+/g, ""))) {
          return `Invalid expression: "${expr}"`
        }
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${expr})`)()
        return `${expr} = ${result}`
      }

      case "get_weather": {
        const location = encodeURIComponent(args.location || "")
        const res = await fetch(
          `https://wttr.in/${location}?format=j1`,
          { signal: AbortSignal.timeout(8000) }
        )
        const data = await res.json()
        const current = data.current_condition?.[0]
        if (!current) return `Could not get weather for: ${args.location}`
        const desc = current.weatherDesc?.[0]?.value || "Unknown"
        const temp_c = current.temp_C
        const temp_f = current.temp_F
        const feels_c = current.FeelsLikeC
        const humidity = current.humidity
        const wind = current.windspeedKmph
        return `Weather in ${args.location}: ${desc}\nTemp: ${temp_c}°C / ${temp_f}°F (feels like ${feels_c}°C)\nHumidity: ${humidity}% | Wind: ${wind} km/h`
      }

      case "save_note": {
        const content = args.content || ""
        // Actually persist the note to Pinecone memory
        await memorize(`note: ${content}`, content)
        return `✅ Note saved: "${content.slice(0, 100)}"`
      }



      case "run_code": {
        const { language, code } = args
        if (!language || !code) return "Missing language or code."

        // Use the Piston API — free, no auth needed, sandboxed
        const PISTON = "https://emkc.org/api/v2/piston"
        const langMap: Record<string, { language: string; version: string }> = {
          python:     { language: "python",     version: "3.10.0" },
          javascript: { language: "javascript", version: "18.15.0" },
        }
        const runtime = langMap[language]
        if (!runtime) return `Unsupported language: ${language}`

        const res = await fetch(`${PISTON}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: runtime.language,
            version:  runtime.version,
            files: [{ content: code }],
          }),
          signal: AbortSignal.timeout(15000),
        })
        const data = await res.json()
        const run = data.run || {}
        const stdout = (run.stdout || "").trim()
        const stderr = (run.stderr || "").trim()

        if (run.code !== 0 && stderr) {
          return `❌ Error (exit ${run.code}):\n${stderr.slice(0, 1000)}`
        }
        if (!stdout && !stderr) return "✅ Code ran successfully (no output)"
        return `✅ Output:\n${stdout.slice(0, 2000)}${stderr ? `\n\nStderr:\n${stderr.slice(0, 500)}` : ""}`
      }

      default:
        return `Unknown tool: ${tool}`
    }
  } catch (e: any) {
    return `Tool error (${tool}): ${e.message || "Unknown error"}`
  }
}
