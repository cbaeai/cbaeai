"use client"
import { useChatStore } from "@/lib/store"
import { Message } from "@/types"
import { v4 as uuidv4 } from "uuid"

const MB = "https://www.moltbook.com/api/v1"

// Execute moltbook tools directly from the browser — bypasses Vercel server entirely
async function executeMoltbookTool(tool: string, args: Record<string, any>): Promise<string> {
  const key = args.key || ""
  if (!key) return "No Moltbook API key provided."

  const headers = {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  }

  try {
    switch (tool) {
      case "moltbook_feed": {
        const sort = args.sort || "hot"
        const limit = args.limit || 10
        const res = await fetch(`${MB}/feed?sort=${sort}&limit=${limit}`, { headers })
        const data = await res.json()
        if (data.error) return `Moltbook error: ${data.error}`
        const posts = data.posts || []
        if (!posts.length) return "No posts found in feed."
        return posts.slice(0, limit).map((p: any, i: number) =>
          `${i+1}. [${p.id}] "${p.title}" by @${p.author?.name} in m/${p.submolt?.name} — ${p.upvotes ?? 0} upvotes\n   ${(p.content || "").slice(0, 120)}...`
        ).join("\n\n")
      }

      case "moltbook_profile": {
        const res = await fetch(`${MB}/agents/me`, { headers })
        const data = await res.json()
        if (data.error) return `Profile error: ${data.error}`
        const a = data.agent || data
        return `@${a.name} — ${a.description || "no description"}
Karma: ${a.karma ?? 0} | Followers: ${a.follower_count ?? 0} | Following: ${a.following_count ?? 0}
Status: ${a.is_claimed ? "✅ Claimed" : "⏳ Pending"} | Active: ${a.is_active ? "Yes" : "No"}
Profile: https://www.moltbook.com/u/${a.name}`
      }

      case "moltbook_search": {
        const query = args.query || ""
        const res = await fetch(`${MB}/search?q=${encodeURIComponent(query)}&type=all&limit=10`, { headers })
        const data = await res.json()
        if (data.error) return `Search error: ${data.error}`
        const results = data.results || []
        if (!results.length) return `No results found for: "${query}"`
        return results.map((r: any, i: number) =>
          `${i+1}. [${r.type}] "${r.title || r.content?.slice(0,60)}" by @${r.author?.name}`
        ).join("\n")
      }

      case "moltbook_post": {
        const { title, content, submolt = "general" } = args
        const res = await fetch(`${MB}/posts`, {
          method: "POST", headers,
          body: JSON.stringify({ submolt, title, content }),
        })
        const data = await res.json()
        if (data.error) return `Failed to post: ${data.error}`
        if (data.post?.verification?.challenge_text) {
          return `Post created but needs verification. Challenge: ${data.post.verification.challenge_text}`
        }
        return data.success ? `✅ Posted: "${title}" in m/${submolt}` : JSON.stringify(data).slice(0, 200)
      }

      case "moltbook_comment": {
        const { post_id, content } = args
        const res = await fetch(`${MB}/posts/${post_id}/comments`, {
          method: "POST", headers,
          body: JSON.stringify({ content }),
        })
        const data = await res.json()
        if (data.error) return `Comment error: ${data.error}`
        return data.success ? `✅ Comment posted on post ${post_id}` : JSON.stringify(data).slice(0, 200)
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
    // Internal use: resume after client-side tool execution
    _resumePayload?: {
      tool_results: Array<{ tool_call_id: string; tool: string; result: string }>
      loop_messages: any[]
    }
  ) => {
    if (!_resumePayload && (!text.trim() || isLoading)) return

    if (!_resumePayload) {
      addMessage({ id: uuidv4(), role: "user", content: text, timestamp: new Date() })
      addMessage({ id: uuidv4(), role: "assistant", content: "", isStreaming: true, toolCalls: [], timestamp: new Date() })
      setLoading(true)
    }

    const mb_key = typeof window !== "undefined" ? localStorage.getItem("mb_key") || "" : ""

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const body: any = { message: text, history, agent_mode: agentMode, model, mb_key }
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

      // Collect client_execute data
      let clientExecuteData: { tool_calls: any[]; loop_state: any[] } | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === "token") {
              fullText += data.content
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullText }
                return { messages: msgs }
              })
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
                return { messages: msgs }
              })
            }

            if (data.type === "client_execute") {
              clientExecuteData = { tool_calls: data.tool_calls, loop_state: data.loop_state }
            }

            if (data.type === "done") {
              useChatStore.setState(s => {
                const msgs = [...s.messages]
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStreaming: false }
                return { messages: msgs }
              })
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // If server asked browser to execute moltbook tools, do it now
      if (clientExecuteData) {
        const { tool_calls, loop_state } = clientExecuteData
        const tool_results: Array<{ tool_call_id: string; tool: string; result: string }> = []

        // Mark assistant as still streaming while we execute
        useChatStore.setState(s => {
          const msgs = [...s.messages]
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStreaming: true }
          return { messages: msgs }
        })

        for (const tc of tool_calls) {
          const result = await executeMoltbookTool(tc.tool, tc.args)
          tool_results.push({ tool_call_id: tc.tool_call_id, tool: tc.tool, result })

          // Update tool result in UI
          useChatStore.setState(s => {
            const msgs = [...s.messages]
            const last = msgs[msgs.length - 1]
            const tcs = [...(last.toolCalls || [])]
            const idx = tcs.findLastIndex(t => t.tool === tc.tool && !t.result)
            if (idx >= 0) tcs[idx] = { ...tcs[idx], result: result.slice(0, 400) }
            msgs[msgs.length - 1] = { ...last, toolCalls: tcs }
            return { messages: msgs }
          })
        }

        // Resume the AI loop with the tool results
        await sendMessage(text, { tool_results, loop_messages: loop_state })
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
        return { messages: msgs }
      })
    } finally {
      if (!clientExecuteData) setLoading(false)
    }
  }

  return { messages, isLoading, agentMode, sendMessage }
}
