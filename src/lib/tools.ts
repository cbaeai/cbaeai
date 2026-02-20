// Server-side only — no "use client"
import { memorize } from "@/lib/memory"

export const TOOLS: object[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, news, facts, or anything that may have changed recently.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query" } },
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
        properties: { url: { type: "string", description: "The URL to fetch" } },
        required: ["url"],
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
        properties: { expression: { type: "string", description: "A math expression, e.g. '2 + 2 * 10'" } },
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
        properties: { location: { type: "string", description: "City and country, e.g. 'London, UK'" } },
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
        properties: { content: { type: "string", description: "The note content to save" } },
        required: ["content"],
      },
    },
  },
  // Fix #5: Image generation tool
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image from a text description using DALL-E. Use this when the user asks to create, draw, generate, or make an image, picture, illustration, or artwork.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "A detailed description of the image to generate" },
          size: { type: "string", enum: ["1024x1024", "1792x1024", "1024x1792"], description: "Image dimensions. Default 1024x1024. Use 1792x1024 for landscape, 1024x1792 for portrait." },
        },
        required: ["prompt"],
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
          key:     { type: "string", description: "Moltbook API key" },
          title:   { type: "string", description: "Post title" },
          content: { type: "string", description: "Post body content" },
          submolt: { type: "string", description: "Submolt/community to post in (default: general)" },
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
        properties: { key: { type: "string", description: "Moltbook API key" } },
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
  {
    type: "function",
    function: {
      name: "moltbook_discover",
      description: "Scan the Moltbook feed and discover other active AI agents.",
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
      description: "Read the full content and all comments of a specific Moltbook post.",
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

export async function executeTool(tool: string, args: Record<string, any>): Promise<string> {
  try {
    switch (tool) {

      case "web_search": {
        const query = encodeURIComponent(args.query || "")
        const res = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${query}&count=5`,
          { headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": process.env.BRAVE_KEY || "" } }
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
        const clean = text
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ").trim()
        return clean.slice(0, 3000) + (clean.length > 3000 ? "\n...[truncated]" : "")
      }

      case "calculator": {
        const expr = args.expression || ""
        if (!/^[0-9+\-*/().\s%^]+$/.test(expr.replace(/Math\.\w+/g, ""))) {
          return `Invalid expression: "${expr}"`
        }
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${expr})`)()
        return `${expr} = ${result}`
      }

      case "get_weather": {
        const location = encodeURIComponent(args.location || "")
        const res = await fetch(`https://wttr.in/${location}?format=j1`, { signal: AbortSignal.timeout(8000) })
        const data = await res.json()
        const current = data.current_condition?.[0]
        if (!current) return `Could not get weather for: ${args.location}`
        return `Weather in ${args.location}: ${current.weatherDesc?.[0]?.value || "Unknown"}\nTemp: ${current.temp_C}°C / ${current.temp_F}°F (feels like ${current.FeelsLikeC}°C)\nHumidity: ${current.humidity}% | Wind: ${current.windspeedKmph} km/h`
      }

      case "save_note": {
        await memorize(`note: ${args.content}`, args.content)
        return `✅ Note saved: "${(args.content || "").slice(0, 100)}"`
      }

      // Fix #5: Image generation
      case "generate_image": {
        const prompt = args.prompt || ""
        const size = args.size || "1024x1024"
        const res = await fetch("https://openrouter.ai/api/v1/images/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_KEY!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "openai/dall-e-3", prompt, n: 1, size }),
          signal: AbortSignal.timeout(60000),
        })
        const data = await res.json()
        const url = data.data?.[0]?.url
        if (!url) return `Image generation failed: ${JSON.stringify(data).slice(0, 200)}`
        // Return a special marker the route handler will detect and send as image event
        return `__IMAGE__${url}__PROMPT__${prompt}`
      }

      default:
        return `Unknown tool: ${tool}`
    }
  } catch (e: any) {
    return `Tool error (${tool}): ${e.message || "Unknown error"}`
  }
}
