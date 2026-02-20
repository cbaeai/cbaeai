// Map API paths to proxy action names
function pathToAction(path: string): string {
  if (path.startsWith("/agents/status")) return "status"
  if (path.startsWith("/agents/me"))     return "me"
  if (path.startsWith("/feed"))          return "feed"
  if (path.startsWith("/search"))        return "search"
  if (path.startsWith("/submolts"))      return "submolts"
  if (path.includes("/upvote"))          return "upvote"
  if (path.includes("/comments"))        return "comment"
  if (path.startsWith("/posts"))         return "post"
  return "me"
}

// Route through the /api/moltbook proxy which calls moltbook directly
// This avoids the Vercel server-side fetch timeout issue
async function mbFetch(key: string, path: string, method = "GET", body?: object): Promise<string> {
  try {
    const action = pathToAction(path)
    const qs = new URLSearchParams({ api_key: key, action })

    // Extract post_id for comment/upvote
    const postIdMatch = path.match(/\/posts\/([^\/]+)/)
    if (postIdMatch) qs.set("post_id", postIdMatch[1])

    // Extract search query
    const qMatch = path.match(/[?&]q=([^&]+)/)
    if (qMatch) qs.set("q", decodeURIComponent(qMatch[1]))

    // Extract sort/limit
    const sortMatch = path.match(/sort=([^&]+)/)
    if (sortMatch) qs.set("sort", sortMatch[1])
    const limitMatch = path.match(/limit=([^&]+)/)
    if (limitMatch) qs.set("limit", limitMatch[1])

    const baseUrl = typeof window !== "undefined" ? "" : "http://localhost:3000"
    const res = await fetch(`${baseUrl}/api/moltbook?${qs}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json()
    return JSON.stringify(data)
  } catch (e: any) {
    return JSON.stringify({ error: e?.message || "Request failed" })
  }
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "web_search":        return await webSearch(args.query as string)
      case "get_weather":       return await getWeather(args.city as string)
      case "get_news":          return await getNews(args.topic as string)
      case "calculator":        return calculator(args.expression as string)
      case "get_datetime":      return getDatetime()
      case "save_note":         return saveNote(args.title as string, args.content as string)
      case "get_note":          return getNote(args.title as string)
      case "browse_url":        return await browseUrl(args.url as string)
      case "moltbook_feed":     return await moltbookFeed(args.key as string, args.sort as string, args.limit as number)
      case "moltbook_post":     return await moltbookPost(args.key as string, args.title as string, args.content as string, args.submolt as string)
      case "moltbook_search":   return await moltbookSearch(args.key as string, args.query as string)
      case "moltbook_profile":  return await moltbookProfile(args.key as string)
      case "moltbook_comment":  return await moltbookComment(args.key as string, args.post_id as string, args.content as string)
      default:                  return `Unknown tool: ${name}`
    }
  } catch (e) {
    return `Tool error: ${e}`
  }
}

// ── Moltbook tools ────────────────────────────────────────────

async function moltbookFeed(key: string, sort = "hot", limit = 10): Promise<string> {
  if (!key) return "No Moltbook API key provided. Ask the user to provide their key."
  const raw = await mbFetch(key, `/feed?sort=${sort}&limit=${limit}`)
  const data = JSON.parse(raw)
  if (data.error) return `Moltbook error: ${data.error}`
  const posts = data.posts || []
  if (!posts.length) return "No posts found in feed."
  return posts.slice(0, limit).map((p: any, i: number) =>
    `${i+1}. [${p.id}] "${p.title}" by @${p.author?.name} in m/${p.submolt?.name} — ${p.upvotes ?? 0} upvotes\n   ${(p.content || "").slice(0, 120)}...`
  ).join("\n\n")
}

async function moltbookPost(key: string, title: string, content: string, submolt = "general"): Promise<string> {
  if (!key) return "No Moltbook API key provided."
  const raw = await mbFetch(key, "/posts", "POST", { submolt, title, content })
  const data = JSON.parse(raw)
  if (data.error) return `Failed to post: ${data.error}`
  // Handle verification challenge if present
  if (data.post?.verification?.challenge_text) {
    const challenge = data.post.verification.challenge_text
    const code = data.post.verification.verification_code
    // Parse the math challenge — strip obfuscation and extract numbers + operator
    const clean = challenge.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").toLowerCase()
    const numMatches = clean.match(/\d+(\.\d+)?/g) || []
    const nums = numMatches.map(Number)
    let answer = 0
    if (clean.includes("add") || clean.includes("plus") || clean.includes("sum")) answer = nums[0] + nums[1]
    else if (clean.includes("subtract") || clean.includes("minus") || clean.includes("slow") || clean.includes("less")) answer = nums[0] - nums[1]
    else if (clean.includes("multipl") || clean.includes("times")) answer = nums[0] * nums[1]
    else if (clean.includes("divid") || clean.includes("per")) answer = nums[0] / nums[1]
    else answer = nums[0] - nums[1] // default: subtraction (most common in challenges)
    const answerStr = answer.toFixed(2)
    const verifyRaw = await mbFetch(key, "/verify", "POST", { verification_code: code, answer: answerStr })
    const verifyData = JSON.parse(verifyRaw)
    if (verifyData.success) return `✅ Posted and verified! Title: "${title}" in m/${submolt}`
    return `Post created but verification failed (tried ${answerStr}). Challenge: ${challenge}`
  }
  return data.success ? `✅ Posted: "${title}" in m/${submolt}` : `Response: ${raw.slice(0, 200)}`
}

async function moltbookSearch(key: string, query: string): Promise<string> {
  if (!key) return "No Moltbook API key provided."
  const raw = await mbFetch(key, `/search?q=${encodeURIComponent(query)}&type=all&limit=10`)
  const data = JSON.parse(raw)
  if (data.error) return `Search error: ${data.error}`
  const results = data.results || []
  if (!results.length) return `No results found for: "${query}"`
  return results.map((r: any, i: number) =>
    `${i+1}. [${r.type}] "${r.title || r.content?.slice(0,60)}" by @${r.author?.name} — similarity: ${r.similarity?.toFixed(2)}`
  ).join("\n")
}

async function moltbookProfile(key: string): Promise<string> {
  if (!key) return "No Moltbook API key provided."
  const raw = await mbFetch(key, "/agents/me")
  const data = JSON.parse(raw)
  if (data.error) return `Profile error: ${data.error}`
  const a = data.agent || data
  return `@${a.name} — ${a.description || "no description"}
Karma: ${a.karma ?? 0} | Followers: ${a.follower_count ?? 0} | Following: ${a.following_count ?? 0}
Status: ${a.is_claimed ? "✅ Claimed" : "⏳ Pending"} | Active: ${a.is_active ? "Yes" : "No"}
Profile: https://www.moltbook.com/u/${a.name}`
}

async function moltbookComment(key: string, post_id: string, content: string): Promise<string> {
  if (!key) return "No Moltbook API key provided."
  const raw = await mbFetch(key, `/posts/${post_id}/comments`, "POST", { content })
  const data = JSON.parse(raw)
  if (data.error) return `Comment error: ${data.error}`
  if (data.comment?.verification?.challenge_text) {
    return `Comment created but needs verification. Challenge: ${data.comment.verification.challenge_text}`
  }
  return data.success ? `✅ Comment posted on post ${post_id}` : `Response: ${raw.slice(0, 200)}`
}

// ── Existing tools ────────────────────────────────────────────

async function webSearch(query: string): Promise<string> {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)
  const data = await res.json()
  const results = data.RelatedTopics?.slice(0, 5).map((r: any) => r.Text || "").filter(Boolean).join("\n\n")
  return results || "No results found."
}

async function getWeather(city: string): Promise<string> {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`)
  return res.text()
}

async function getNews(topic: string): Promise<string> {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic + " news")}&format=json&no_html=1`)
  const data = await res.json()
  const results = data.RelatedTopics?.slice(0, 5).map((r: any) => r.Text || "").filter(Boolean).join("\n\n")
  return results || "No news found."
}

function calculator(expression: string): string {
  try {
    if (!/^[0-9+\-*/().\s%]+$/.test(expression)) return "Invalid expression"
    const result = Function(`"use strict"; return (${expression})`)()
    return `= ${result}`
  } catch {
    return "Could not evaluate expression"
  }
}

function getDatetime(): string {
  return new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit"
  })
}

const NOTES: Record<string, string> = {}

function saveNote(title: string, content: string): string {
  NOTES[title] = content
  return `Note saved: ${title}`
}

function getNote(title: string): string {
  const key = Object.keys(NOTES).find(k => k.toLowerCase().includes(title.toLowerCase()))
  return key ? `${key}:\n${NOTES[key]}` : `No note found for: ${title}`
}

async function browseUrl(url: string): Promise<string> {
  const res  = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
  const html = await res.text()
  const text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, "")
                   .replace(/<[^>]+>/g, " ")
                   .replace(/\s{2,}/g, "\n")
                   .trim()
  return text.slice(0, 3000)
}

export const TOOLS = [
  { type: "function", function: { name: "web_search",       description: "Search the web for information",                    parameters: { type: "object", properties: { query:      { type: "string" } }, required: ["query"] }}},
  { type: "function", function: { name: "get_weather",      description: "Get current weather for a city",                    parameters: { type: "object", properties: { city:       { type: "string" } }, required: ["city"] }}},
  { type: "function", function: { name: "get_news",         description: "Get latest news on a topic",                        parameters: { type: "object", properties: { topic:      { type: "string" } }, required: ["topic"] }}},
  { type: "function", function: { name: "calculator",       description: "Evaluate a math expression",                        parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] }}},
  { type: "function", function: { name: "get_datetime",     description: "Get current date and time",                         parameters: { type: "object", properties: {} }}},
  { type: "function", function: { name: "save_note",        description: "Save a note",                                       parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title","content"] }}},
  { type: "function", function: { name: "get_note",         description: "Retrieve a saved note",                             parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] }}},
  { type: "function", function: { name: "browse_url",       description: "Fetch and read a webpage",                         parameters: { type: "object", properties: { url:        { type: "string" } }, required: ["url"] }}},
  { type: "function", function: { name: "moltbook_feed",    description: "Read posts from Moltbook feed. Sort options: hot, new, top, rising.",
    parameters: { type: "object", properties: {
      key:   { type: "string", description: "Moltbook API key" },
      sort:  { type: "string", description: "Sort order: hot, new, top, rising", default: "hot" },
      limit: { type: "number", description: "Number of posts to fetch (max 25)", default: 10 },
    }, required: ["key"] }}},
  { type: "function", function: { name: "moltbook_post",    description: "Create a new post on Moltbook as the AI agent.",
    parameters: { type: "object", properties: {
      key:     { type: "string", description: "Moltbook API key" },
      title:   { type: "string", description: "Post title" },
      content: { type: "string", description: "Post content" },
      submolt: { type: "string", description: "Community to post in (default: general)", default: "general" },
    }, required: ["key","title","content"] }}},
  { type: "function", function: { name: "moltbook_search",  description: "Semantic search across Moltbook posts and comments.",
    parameters: { type: "object", properties: {
      key:   { type: "string", description: "Moltbook API key" },
      query: { type: "string", description: "Search query (natural language)" },
    }, required: ["key","query"] }}},
  { type: "function", function: { name: "moltbook_profile", description: "Get the Moltbook agent profile and stats.",
    parameters: { type: "object", properties: {
      key: { type: "string", description: "Moltbook API key" },
    }, required: ["key"] }}},
  { type: "function", function: { name: "moltbook_comment", description: "Post a comment on a Moltbook post.",
    parameters: { type: "object", properties: {
      key:     { type: "string", description: "Moltbook API key" },
      post_id: { type: "string", description: "The post ID to comment on" },
      content: { type: "string", description: "Comment content" },
    }, required: ["key","post_id","content"] }}},
]
