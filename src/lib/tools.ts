export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "web_search":    return await webSearch(args.query as string)
      case "get_weather":   return await getWeather(args.city as string)
      case "get_news":      return await getNews(args.topic as string)
      case "calculator":    return calculator(args.expression as string)
      case "get_datetime":  return getDatetime()
      case "save_note":     return saveNote(args.title as string, args.content as string)
      case "get_note":      return getNote(args.title as string)
      case "browse_url":    return await browseUrl(args.url as string)
      default:              return `Unknown tool: ${name}`
    }
  } catch (e) {
    return `Tool error: ${e}`
  }
}

async function webSearch(query: string): Promise<string> {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)
  const data = await res.json()
  const results = data.RelatedTopics?.slice(0, 5)
    .map((r: any) => r.Text || "")
    .filter(Boolean)
    .join("\n\n")
  return results || "No results found."
}

async function getWeather(city: string): Promise<string> {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`)
  return res.text()
}

async function getNews(topic: string): Promise<string> {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic + " news")}&format=json&no_html=1`)
  const data = await res.json()
  const results = data.RelatedTopics?.slice(0, 5)
    .map((r: any) => r.Text || "")
    .filter(Boolean)
    .join("\n\n")
  return results || "No news found."
}

function calculator(expression: string): string {
  try {
    // Safe eval — only allow math chars
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
  { type: "function", function: { name: "web_search",   description: "Search the web",             parameters: { type: "object", properties: { query:      { type: "string" } }, required: ["query"] }}},
  { type: "function", function: { name: "get_weather",  description: "Get weather for a city",     parameters: { type: "object", properties: { city:       { type: "string" } }, required: ["city"] }}},
  { type: "function", function: { name: "get_news",     description: "Get latest news on a topic", parameters: { type: "object", properties: { topic:      { type: "string" } }, required: ["topic"] }}},
  { type: "function", function: { name: "calculator",   description: "Evaluate math expression",   parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] }}},
  { type: "function", function: { name: "get_datetime", description: "Get current date and time",  parameters: { type: "object", properties: {} }}},
  { type: "function", function: { name: "save_note",    description: "Save a note",                parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title","content"] }}},
  { type: "function", function: { name: "get_note",     description: "Get a saved note",           parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] }}},
  { type: "function", function: { name: "browse_url",   description: "Fetch and read a webpage",   parameters: { type: "object", properties: { url:        { type: "string" } }, required: ["url"] }}},
]
