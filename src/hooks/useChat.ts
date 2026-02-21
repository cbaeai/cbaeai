"use client"
import { useChatStore } from "@/lib/store"
import { Message } from "@/types"
import { v4 as uuidv4 } from "uuid"
import type { Attachment } from "@/types"

const MB = "https://www.moltbook.com/api/v1"

function mbHeaders(key: string) {
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  }
}

async function mbFetch(key: string, path: string, method = "GET", body?: object, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${MB}${path}`, {
        method,
        headers: mbHeaders(key),
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
      })
      const data = await res.json()
      return data
    } catch (e: any) {
      if (attempt === retries) {
        const msg = e?.name === "TimeoutError" ? "Request timed out" : (e?.message || "Network error")
        return { error: msg }
      }
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
    }
  }
}

// All Moltbook tool execution happens in the browser — Vercel server can't reach moltbook.com
async function executeMoltbookTool(tool: string, args: Record<string, any>): Promise<string> {
  const key = args.key || ""
  if (!key) return "No Moltbook API key provided."

  try {
    switch (tool) {

      // ── Core tools ──────────────────────────────────────────

      case "moltbook_feed": {
        const sort = args.sort || "hot"
        const limit = args.limit || 10
        const data = await mbFetch(key, `/feed?sort=${sort}&limit=${limit}`)
        if (data.error) return `Moltbook error: ${data.error}`
        const posts = data.posts || []
        if (!posts.length) return "No posts found in feed."
        return posts.slice(0, limit).map((p: any, i: number) =>
          `${i+1}. [${p.id}] "${p.title}" by @${p.author?.name} in m/${p.submolt?.name} — ${p.upvotes ?? 0} upvotes\n   ${(p.content || "").slice(0, 120)}...`
        ).join("\n\n")
      }

      case "moltbook_profile": {
        const data = await mbFetch(key, "/agents/me")
        if (data.error) return `Profile error: ${data.error}`
        const a = data.agent || data
        return `@${a.name} — ${a.description || "no description"}
Karma: ${a.karma ?? 0} | Followers: ${a.follower_count ?? 0} | Following: ${a.following_count ?? 0}
Status: ${a.is_claimed ? "✅ Claimed" : "⏳ Pending"} | Active: ${a.is_active ? "Yes" : "No"}
Profile: https://www.moltbook.com/u/${a.name}`
      }

      case "moltbook_search": {
        const query = args.query || ""
        const data = await mbFetch(key, `/search?q=${encodeURIComponent(query)}&type=all&limit=10`)
        if (data.error) return `Search error: ${data.error}`
        const results = data.results || []
        if (!results.length) return `No results found for: "${query}"`
        return results.map((r: any, i: number) =>
          `${i+1}. [${r.type}] "${r.title || r.content?.slice(0,60)}" by @${r.author?.name}`
        ).join("\n")
      }

      case "moltbook_post": {
        const { title, content, submolt = "general" } = args
        const data = await mbFetch(key, "/posts", "POST", { submolt, title, content })
        if (data.error) return `Failed to post: ${data.error}`
        if (data.post?.verification?.challenge_text) {
          return `Post created but needs verification. Challenge: ${data.post.verification.challenge_text}`
        }
        return data.success ? `✅ Posted: "${title}" in m/${submolt}` : JSON.stringify(data).slice(0, 200)
      }

      case "moltbook_comment": {
        const { post_id, content } = args
        const data = await mbFetch(key, `/posts/${post_id}/comments`, "POST", { content })
        if (data.error) return `Comment error: ${data.error}`
        return data.success ? `✅ Comment posted on post ${post_id}` : JSON.stringify(data).slice(0, 200)
      }

      // ── Multi-agent tools ───────────────────────────────────

      case "moltbook_discover": {
        const query = args.query || ""
        const data = await mbFetch(key, `/feed?sort=new&limit=25`)
        if (data.error) return `Discover error: ${data.error}`

        const posts = data.posts || []
        const agentMap = new Map<string, { name: string; posts: number; upvotes: number; latestTitle: string; latestId: string }>()

        for (const p of posts) {
          const name = p.author?.name
          if (!name) continue
          if (query && !name.toLowerCase().includes(query.toLowerCase()) &&
              !p.title?.toLowerCase().includes(query.toLowerCase()) &&
              !p.content?.toLowerCase().includes(query.toLowerCase())) continue

          if (agentMap.has(name)) {
            const a = agentMap.get(name)!
            a.posts++
            a.upvotes += (p.upvotes ?? 0)
          } else {
            agentMap.set(name, { name, posts: 1, upvotes: p.upvotes ?? 0, latestTitle: p.title, latestId: p.id })
          }
        }

        if (!agentMap.size) return query ? `No agents found matching "${query}".` : "No agents found in recent feed."
        const agents = Array.from(agentMap.values()).sort((a, b) => b.upvotes - a.upvotes)
        return `Discovered ${agents.length} agents from recent feed:\n\n` +
          agents.map((a, i) =>
            `${i+1}. @${a.name} — ${a.posts} post(s), ${a.upvotes} total upvotes\n   Latest: "${a.latestTitle}" [post:${a.latestId}]`
          ).join("\n\n")
      }

      case "moltbook_agent_profile": {
        const agentName = args.agent_name || ""
        if (!agentName) return "agent_name is required."

        const data = await mbFetch(key, `/agents/${encodeURIComponent(agentName)}`)
        if (data.error) {
          // Fallback: search for this agent's posts
          const searchData = await mbFetch(key, `/search?q=${encodeURIComponent(agentName)}&type=all&limit=10`)
          const results = (searchData.results || []).filter((r: any) =>
            r.author?.name?.toLowerCase() === agentName.toLowerCase()
          )
          if (!results.length) return `Could not find agent @${agentName}.`
          return `@${agentName} — found ${results.length} post(s)\nRecent posts:\n` +
            results.map((p: any, i: number) => `${i+1}. [${p.id}] "${p.title}" — ${p.upvotes ?? 0} upvotes`).join("\n")
        }

        const a = data.agent || data
        const postsData = await mbFetch(key, `/agents/${encodeURIComponent(agentName)}/posts?limit=5`).catch(() => ({ posts: [] }))
        const recentPosts = postsData.posts || []

        return `@${a.name || agentName} — ${a.description || "no description"}
Karma: ${a.karma ?? "?"} | Followers: ${a.follower_count ?? "?"} | Following: ${a.following_count ?? "?"}
Active: ${a.is_active ? "Yes" : "No"} | Claimed: ${a.is_claimed ? "Yes" : "No"}
${recentPosts.length > 0 ? `\nRecent posts:\n${recentPosts.map((p: any, i: number) => `${i+1}. [${p.id}] "${p.title}" — ${p.upvotes ?? 0} upvotes`).join("\n")}` : ""}`
      }

      case "moltbook_follow_agent": {
        const agentName = args.agent_name || ""
        if (!agentName) return "agent_name is required."
        const data = await mbFetch(key, `/agents/${encodeURIComponent(agentName)}/follow`, "POST")
        if (data.error) return `Follow error: ${data.error}`
        return data.success ? `✅ Now following @${agentName}` : JSON.stringify(data).slice(0, 200)
      }

      case "moltbook_read_post": {
        const { post_id } = args
        if (!post_id) return "post_id is required."

        const postData = await mbFetch(key, `/posts/${post_id}`)
        if (postData.error) return `Post error: ${postData.error}`

        const p = postData.post || postData
        const commentsData = await mbFetch(key, `/posts/${post_id}/comments?limit=10`).catch(() => ({ comments: [] }))
        const comments = commentsData.comments || []

        return `"${p.title}" by @${p.author?.name} in m/${p.submolt?.name}
${p.upvotes ?? 0} upvotes | ${comments.length} comments

${p.content || ""}
${comments.length > 0 ? `\nComments:\n${comments.map((c: any, i: number) => `  ${i+1}. @${c.author?.name}: ${(c.content || "").slice(0, 150)}`).join("\n")}` : "\nNo comments yet."}`
      }

      default:
        return `Unknown moltbook tool: ${tool}`
    }
  } catch (e: any) {
    return `Moltbook error: ${e.message || "Request failed"}`
  }
}

export function useChat() {
  const { messages, isLoading, agentMode, model, addMessage, setLoading, appendToolCall } = useChatStore()

  const sendMessage = async (
    text: string,
    attachOrResume?: Attachment | {
      tool_results: Array<{ tool_call_id: string; tool: string; result: string }>
      loop_messages: any[]
    }
  ) => {
    // Distinguish between an attachment and a resume payload (from Moltbook tool loop)
    const isResume = attachOrResume && "tool_results" in attachOrResume
    const _resumePayload = isResume ? attachOrResume : undefined
    const attachment = (!isResume && attachOrResume) ? attachOrResume as Attachment : undefined

    if (!_resumePayload && (!text.trim() || isLoading)) return

    if (!_resumePayload) {
      // Store the attachment on the user message so it appears in chat history
      addMessage({ id: uuidv4(), role: "user", content: text, timestamp: new Date(), attachment })
      addMessage({ id: uuidv4(), role: "assistant", content: "", isStreaming: true, toolCalls: [], timestamp: new Date() })
      setLoading(true)
    }

    const mb_key = typeof window !== "undefined" ? localStorage.getItem("mb_key") || "" : ""

    // Declared outside try so finally block can access it
    let clientExecuteData: { tool_calls: any[]; loop_state: any[] } | null = null

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      // Vision: if image attached + non-vision model → silently upgrade to gpt-4o for this call only
      const VISION_MODELS = new Set(["openai/gpt-4o", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-pro-1.5"])
      const isImage = attachment?.kind === "image"
      const requestModel = isImage && !VISION_MODELS.has(model) ? "openai/gpt-4o" : model

      const body: any = { message: text, history, agent_mode: agentMode, model: requestModel, mb_key }

      if (attachment?.kind === "image") {
        // Image → send as base64 vision block to the API
        body.image_base64 = attachment.base64
        body.image_mime   = attachment.mimeType
      } else if (attachment?.kind === "file" && attachment.extractedText) {
        // File (PDF / ZIP / code) → inject extracted text directly into the message
        // We prepend it so Cbae sees the file content before the user's question
        body.message = `${attachment.extractedText}

---
User question: ${text}`
      }
      if (_resumePayload) {
        body.tool_results = _resumePayload.tool_results
        body.loop_messages = _resumePayload.loop_messages
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.body) throw new Error("No response body")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = "", fullText = ""

      // Client-side safety net: intercept <thinking>...</thinking> tags
      // that may leak through if the model ignores server-side stripping
      let rawAccum = ""   // accumulates all tokens to do a final clean pass

      const setThinking = (t: string) => useChatStore.setState(s => {
        const msgs = [...s.messages]
        msgs[msgs.length-1] = {...msgs[msgs.length-1], thinking: t}
        const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
        return {messages: msgs, conversations: convos}
      })
      const setContent = (t: string) => {
        fullText = t
        useChatStore.setState(s => {
          const msgs = [...s.messages]
          msgs[msgs.length-1] = {...msgs[msgs.length-1], content: t}
          const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
          return {messages: msgs, conversations: convos}
        })
      }

      // Strips <thinking>...</thinking> from a string, extracts thinking content
      const stripThinking = (text: string): { clean: string; thinking: string } => {
        let thinking = ""
        const clean = text.replace(/<thinking>([\s\S]*?)<\/thinking>/gi, (_, inner) => {
          thinking = inner.trim()
          return ""
        }).trimStart()
        return { clean, thinking }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Stream ended — flush anything still in rawAccum even if </thinking> never came
          if (rawAccum) {
            const { clean, thinking } = stripThinking(rawAccum)
            if (thinking) setThinking(thinking)
            // If we have an unclosed <thinking> tag, treat everything inside as thinking
            if (rawAccum.includes("<thinking>") && !rawAccum.includes("</thinking>")) {
              const thinkContent = rawAccum.replace(/<thinking>/i, "").trim()
              setThinking(thinkContent)
              setContent("")
            } else {
              setContent(clean)
            }
          }
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === "thinking_token") {
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                msgs[msgs.length - 1] = { ...last, thinking: (last.thinking || "") + data.content }
                const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
                return { messages: msgs, conversations: convos }
              })
            }
            if (data.type === "thinking_done") {
              // Thinking stream complete — nothing extra needed, state already set
            }
            if (data.type === "thinking") {
              // Legacy single-shot thinking (fallback)
              setThinking(data.content)
            }
            if (data.type === "token") {
              rawAccum += data.content
              // Only render once we have a complete thinking block or no thinking tag at all
              const hasOpenTag = rawAccum.includes("<thinking>")
              const hasCloseTag = rawAccum.includes("</thinking>")
              if (!hasOpenTag || (hasOpenTag && hasCloseTag)) {
                const { clean, thinking } = stripThinking(rawAccum)
                if (thinking) setThinking(thinking)
                setContent(clean)
              }
              // If we have <thinking> but no closing tag yet — wait, don't render
            }
            if (data.type === "tool_call") appendToolCall({ tool: data.tool, args: data.args })
            if (data.type === "tool_result") {
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                const tcs = [...(last.toolCalls || [])]
                const idx = tcs.findLastIndex(t => t.tool === data.tool && !t.result)
                if (idx >= 0) tcs[idx] = { ...tcs[idx], result: data.result }
                msgs[msgs.length - 1] = { ...last, toolCalls: tcs }
                const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
                return { messages: msgs, conversations: convos }
              })
            }
            if (data.type === "client_execute") {
              clientExecuteData = { tool_calls: data.tool_calls, loop_state: data.loop_state }
            }
            if (data.type === "done") {
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStreaming: false }
                const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
                return { messages: msgs, conversations: convos }
              })
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Server asked browser to execute moltbook tools — do it now
      if (clientExecuteData) {
        const { tool_calls, loop_state } = clientExecuteData
        const tool_results: Array<{ tool_call_id: string; tool: string; result: string }> = []

        useChatStore.setState(s => {
          const msgs = [...s.messages]
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStreaming: true }
          const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
          return { messages: msgs, conversations: convos }
        })

        for (const tc of tool_calls) {
          const result = await executeMoltbookTool(tc.tool, tc.args)
          tool_results.push({ tool_call_id: tc.tool_call_id, tool: tc.tool, result })
          useChatStore.setState(s => {
            const msgs = [...s.messages]
            const last = msgs[msgs.length - 1]
            const tcs = [...(last.toolCalls || [])]
            const idx = tcs.findLastIndex(t => t.tool === tc.tool && !t.result)
            if (idx >= 0) tcs[idx] = { ...tcs[idx], result: result.slice(0, 400) }
            msgs[msgs.length - 1] = { ...last, toolCalls: tcs }
            const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
            return { messages: msgs, conversations: convos }
          })
        }

        // Resume AI loop with browser-executed results
        await sendMessage(text, { tool_results, loop_messages: loop_state } as any)
        return
      }

    } catch (err) {
      useChatStore.setState(s => {
        const msgs = [...s.messages]
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          isStreaming: false,
        }
        const convos = s.conversations.map(c => c.id === s.activeId ? {...c, messages: msgs} : c)
        return { messages: msgs, conversations: convos }
      })
    } finally {
      if (!clientExecuteData) setLoading(false)
    }
  }

  return { messages, isLoading, agentMode, sendMessage }
}
