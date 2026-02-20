"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

const MB = "https://www.moltbook.com/api/v1"

function mbHeaders(key: string) {
  return { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Accept": "application/json" }
}

async function mbFetch(key: string, path: string, method = "GET", body?: object) {
  try {
    const res = await fetch(`${MB}${path}`, {
      method, headers: mbHeaders(key),
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  } catch (e: any) {
    return { error: e?.message || "Request failed" }
  }
}

type Agent = {
  name: string
  description?: string
  karma?: number
  follower_count?: number
  posts?: number
  upvotes?: number
  latestTitle?: string
  latestId?: string
  is_active?: boolean
}

type InteractionLog = {
  id: string
  ts: Date
  type: "discover" | "follow" | "comment" | "read" | "profile" | "error"
  agent?: string
  detail: string
}

type AutoConfig = {
  enabled: boolean
  action: "comment" | "follow" | "both"
  topic: string
  interval: number // minutes
}

export default function AgentsPage() {
  const [apiKey, setApiKey]           = useState("")
  const [agents, setAgents]           = useState<Agent[]>([])
  const [selected, setSelected]       = useState<Agent | null>(null)
  const [selectedPosts, setSelectedPosts] = useState<any[]>([])
  const [log, setLog]                 = useState<InteractionLog[]>([])
  const [loading, setLoading]         = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [searchQ, setSearchQ]         = useState("")
  const [autoConfig, setAutoConfig]   = useState<AutoConfig>({ enabled: false, action: "comment", topic: "", interval: 5 })
  const [autoRunning, setAutoRunning] = useState(false)
  const [aiComment, setAiComment]     = useState<Record<string, string>>({})
  const [commentLoading, setCommentLoading] = useState<string | null>(null)
  const [expandedPosts, setExpandedPosts]   = useState<Set<string>>(new Set())
  const [msg, setMsg]                 = useState("")
  const autoRef = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const k = localStorage.getItem("mb_key") || ""
    if (k) setApiKey(k)
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [log])

  const addLog = useCallback((type: InteractionLog["type"], detail: string, agent?: string) => {
    setLog(prev => [...prev, { id: Math.random().toString(36).slice(2), ts: new Date(), type, agent, detail }])
  }, [])

  const scanAgents = async () => {
    if (!apiKey) { setMsg("Save your API key on the Moltbook page first"); return }
    setScanLoading(true); setMsg("")
    addLog("discover", "Scanning feed for active agents…")

    const data = await mbFetch(apiKey, `/feed?sort=new&limit=25`)
    setScanLoading(false)

    if (data.error) { addLog("error", `Scan failed: ${data.error}`); return }

    const posts = data.posts || []
    const map = new Map<string, Agent>()

    for (const p of posts) {
      const name = p.author?.name
      if (!name) continue
      if (searchQ && !name.toLowerCase().includes(searchQ.toLowerCase()) &&
          !p.title?.toLowerCase().includes(searchQ.toLowerCase()) &&
          !p.content?.toLowerCase().includes(searchQ.toLowerCase())) continue

      if (map.has(name)) {
        const a = map.get(name)!
        a.posts = (a.posts || 0) + 1
        a.upvotes = (a.upvotes || 0) + (p.upvotes ?? 0)
      } else {
        map.set(name, {
          name, posts: 1, upvotes: p.upvotes ?? 0,
          latestTitle: p.title, latestId: p.id,
        })
      }
    }

    const discovered = Array.from(map.values()).sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
    setAgents(discovered)
    addLog("discover", `Found ${discovered.length} agents in recent feed${searchQ ? ` matching "${searchQ}"` : ""}`)
  }

  const loadAgentProfile = async (agent: Agent) => {
    setSelected(agent); setSelectedPosts([])
    setLoading(true)
    addLog("profile", `Loading profile for @${agent.name}`, agent.name)

    const [profileData, postsData] = await Promise.all([
      mbFetch(apiKey, `/agents/${encodeURIComponent(agent.name)}`),
      mbFetch(apiKey, `/agents/${encodeURIComponent(agent.name)}/posts?limit=5`),
    ])

    if (!profileData.error) {
      const a = profileData.agent || profileData
      setSelected(prev => prev ? { ...prev, description: a.description, karma: a.karma, follower_count: a.follower_count, is_active: a.is_active } : prev)
    }

    // If the agent posts endpoint works, use it
    if (!postsData.error && (postsData.posts || []).length > 0) {
      setSelectedPosts(postsData.posts || [])
      setLoading(false)
      return
    }

    // Fallback: fetch full content for each known post from the feed scan
    const knownIds: string[] = []
    if (agent.latestId) knownIds.push(agent.latestId)

    // Also search for their posts by username
    const searchData = await mbFetch(apiKey, `/search?q=${encodeURIComponent(agent.name)}&type=posts&limit=5`)
    if (!searchData.error) {
      const searchResults = searchData.results || []
      for (const r of searchResults) {
        if (r.author?.name?.toLowerCase() === agent.name.toLowerCase() && r.id && !knownIds.includes(r.id)) {
          knownIds.push(r.id)
        }
      }
    }

    // Fetch full content for each post ID we have
    if (knownIds.length > 0) {
      addLog("read", `Fetching full content for ${knownIds.length} post(s)…`, agent.name)
      const fullPosts = await Promise.all(
        knownIds.slice(0, 5).map(id => mbFetch(apiKey, `/posts/${id}`))
      )
      const resolved = fullPosts
        .filter(d => !d.error)
        .map(d => d.post || d)
        .filter(p => p.id)
      if (resolved.length > 0) {
        setSelectedPosts(resolved)
      }
    }

    setLoading(false)
  }

  const followAgent = async (name: string) => {
    addLog("follow", `Following @${name}…`, name)
    const data = await mbFetch(apiKey, `/agents/${encodeURIComponent(name)}/follow`, "POST")
    if (data.error) { addLog("error", `Follow failed: ${data.error}`, name); return }
    addLog("follow", data.success ? `✅ Now following @${name}` : `Response: ${JSON.stringify(data).slice(0,100)}`, name)
  }

  const generateComment = async (post: any) => {
    const postId = post.id
    setCommentLoading(postId)

    // Use the chat API to generate a smart comment
    try {
      const mb_key = apiKey
      const prompt = `Read this Moltbook post and write a thoughtful, genuine comment as an AI agent. Be specific to the content, not generic. Keep it under 3 sentences.

Post title: "${post.title}"
Author: @${post.author?.name}
Content: ${(post.content || "").slice(0, 500)}

Reply with ONLY the comment text, nothing else.`

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, history: [], agent_mode: false, mb_key }),
      })

      if (!res.body) throw new Error("No body")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = "", comment = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const d = JSON.parse(line.slice(6))
            if (d.type === "token") comment += d.content
          } catch {}
        }
      }

      setAiComment(prev => ({ ...prev, [postId]: comment.trim() }))
    } catch (e: any) {
      setMsg(`AI error: ${e.message}`)
    } finally {
      setCommentLoading(null)
    }
  }

  const postComment = async (postId: string) => {
    const content = aiComment[postId]
    if (!content) return
    addLog("comment", `Posting comment on post ${postId.slice(0,8)}…`)
    const data = await mbFetch(apiKey, `/posts/${postId}/comments`, "POST", { content })
    if (data.error) { addLog("error", `Comment failed: ${data.error}`); return }
    addLog("comment", `✅ Comment posted: "${content.slice(0,60)}…"`)
    setAiComment(prev => { const n = {...prev}; delete n[postId]; return n })
  }

  // Autonomous mode loop
  const runAutoLoop = useCallback(async () => {
    if (!apiKey) { addLog("error", "No API key — set it on the Moltbook page"); return }
    addLog("discover", `🤖 Auto mode: scanning for agents${autoConfig.topic ? ` interested in "${autoConfig.topic}"` : ""}…`)

    const data = await mbFetch(apiKey, `/feed?sort=new&limit=25`)
    if (data.error) { addLog("error", `Auto scan failed: ${data.error}`); return }

    const posts = (data.posts || []).filter((p: any) => {
      if (!autoConfig.topic) return true
      const t = autoConfig.topic.toLowerCase()
      return p.title?.toLowerCase().includes(t) || p.content?.toLowerCase().includes(t)
    })

    if (!posts.length) { addLog("discover", "No matching posts found this cycle."); return }

    // Pick top 2 posts to interact with
    const targets = posts.slice(0, 2)

    for (const post of targets) {
      const authorName = post.author?.name
      if (!authorName) continue

      if (autoConfig.action === "follow" || autoConfig.action === "both") {
        addLog("follow", `Auto-following @${authorName}…`, authorName)
        const followData = await mbFetch(apiKey, `/agents/${encodeURIComponent(authorName)}/follow`, "POST")
        addLog("follow", followData.success ? `✅ Followed @${authorName}` : `Follow result: ${JSON.stringify(followData).slice(0,80)}`, authorName)
      }

      if (autoConfig.action === "comment" || autoConfig.action === "both") {
        // Generate AI comment
        try {
          const prompt = `Write a thoughtful, genuine comment for this Moltbook post. Be specific. Under 2 sentences. Reply with ONLY the comment.

Title: "${post.title}"
Content: ${(post.content || "").slice(0, 400)}`

          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: prompt, history: [], agent_mode: false, mb_key: apiKey }),
          })

          if (res.body) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = "", comment = ""
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split("\n"); buffer = lines.pop() || ""
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue
                try { const d = JSON.parse(line.slice(6)); if (d.type === "token") comment += d.content } catch {}
              }
            }
            const commentText = comment.trim()
            addLog("comment", `Auto-commenting on "${post.title.slice(0,40)}"…`)
            const commentData = await mbFetch(apiKey, `/posts/${post.id}/comments`, "POST", { content: commentText })
            addLog("comment", commentData.success ? `✅ Commented: "${commentText.slice(0,60)}…"` : `Comment result: ${JSON.stringify(commentData).slice(0,80)}`)
          }
        } catch (e: any) {
          addLog("error", `Auto-comment failed: ${e.message}`)
        }
      }
    }
  }, [apiKey, autoConfig, addLog])

  const toggleAuto = () => {
    if (autoRunning) {
      if (autoRef.current) clearInterval(autoRef.current)
      setAutoRunning(false)
      addLog("discover", "🛑 Autonomous mode stopped.")
    } else {
      setAutoRunning(true)
      addLog("discover", `🚀 Autonomous mode started (every ${autoConfig.interval} min)`)
      runAutoLoop()
      autoRef.current = setInterval(runAutoLoop, autoConfig.interval * 60 * 1000)
    }
  }

  useEffect(() => {
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [])

  const logIcon: Record<InteractionLog["type"], string> = {
    discover: "🔍", follow: "➕", comment: "💬", read: "📖", profile: "👤", error: "⚠️"
  }

  return (
    <div className="min-h-screen bg-[#09090e] text-[#eaeaf2] font-sans">
      {/* Fixed bg gradient */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 60% 40% at 80% 0%, rgba(78,205,196,0.04) 0%, transparent 60%), radial-gradient(ellipse 50% 35% at 10% 100%, rgba(200,169,110,0.04) 0%, transparent 55%)"
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl text-[#eaeaf2] tracking-tight">Multi-Agent</h1>
            <p className="text-[#6b6b8a] text-sm mt-1">Discover, follow, and interact with other AI agents on Moltbook</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-[#6b6b8a] hover:text-[#eaeaf2] border border-[#2e2e40] hover:border-[#3e3e55] rounded-lg px-3 py-1.5 transition-colors">← Chat</Link>
            <Link href="/moltbook" className="text-xs text-[#6b6b8a] hover:text-[#c8a96e] border border-[#2e2e40] hover:border-[#c8a96e]/30 rounded-lg px-3 py-1.5 transition-colors">⬡ Moltbook</Link>
          </div>
        </div>

        {msg && <div className="mb-4 text-xs text-[#c8a96e] bg-[#c8a96e]/10 border border-[#c8a96e]/20 rounded-lg px-4 py-2">{msg}</div>}

        <div className="grid grid-cols-12 gap-5">

          {/* LEFT: Discovery panel */}
          <div className="col-span-4 space-y-4">

            {/* Scan controls */}
            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#eaeaf2] mb-3">Discover Agents</h2>
              <div className="flex gap-2 mb-3">
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Filter by topic or name…"
                  className="flex-1 text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] placeholder-[#4a4a60] outline-none focus:border-[#4ecdc4]/40"
                />
                <button
                  onClick={scanAgents}
                  disabled={scanLoading}
                  className="text-xs bg-[#4ecdc4]/10 hover:bg-[#4ecdc4]/20 text-[#4ecdc4] border border-[#4ecdc4]/30 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                >
                  {scanLoading ? "…" : "Scan"}
                </button>
              </div>
              <p className="text-[#4a4a60] text-xs">Scans the latest 25 posts and extracts unique agents</p>
            </div>

            {/* Agent list */}
            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2e2e40] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#eaeaf2]">Agents Found</h2>
                <span className="text-xs text-[#4ecdc4] bg-[#4ecdc4]/10 px-2 py-0.5 rounded-full">{agents.length}</span>
              </div>
              <div className="overflow-y-auto max-h-[420px]">
                {agents.length === 0 && (
                  <p className="text-[#4a4a60] text-xs text-center py-8">Hit Scan to discover agents</p>
                )}
                {agents.map(a => (
                  <div
                    key={a.name}
                    onClick={() => loadAgentProfile(a)}
                    className={`px-4 py-3 border-b border-[#1e1e2e] cursor-pointer hover:bg-[#1a1a28] transition-colors ${selected?.name === a.name ? "bg-[#1a1a28] border-l-2 border-l-[#4ecdc4]" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[#c8a96e] text-xs font-semibold">@{a.name}</span>
                      <span className="text-[#4a4a60] text-xs">{a.upvotes ?? 0} ⬆</span>
                    </div>
                    <p className="text-[#6b6b8a] text-xs mt-0.5 truncate">{a.latestTitle || "No posts"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: Selected agent detail */}
          <div className="col-span-5 space-y-4">
            {!selected ? (
              <div className="bg-[#111118] border border-[#2e2e40] rounded-xl flex items-center justify-center h-64">
                <p className="text-[#4a4a60] text-sm">Select an agent to view their profile & posts</p>
              </div>
            ) : (
              <>
                {/* Profile card */}
                <div className="bg-[#111118] border border-[#2e2e40] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[#c8a96e] font-semibold">@{selected.name}</h3>
                        {selected.is_active && <span className="text-[10px] text-[#4ecdc4] bg-[#4ecdc4]/10 px-2 py-0.5 rounded-full">Active</span>}
                      </div>
                      {selected.description && <p className="text-[#9a9ab8] text-xs mt-1">{selected.description}</p>}
                    </div>
                    <button
                      onClick={() => followAgent(selected.name)}
                      className="text-xs text-[#4ecdc4] border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/10 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      + Follow
                    </button>
                  </div>
                  {(selected.karma !== undefined || selected.follower_count !== undefined) && (
                    <div className="flex gap-4 mt-3">
                      <div className="text-center">
                        <div className="text-[#eaeaf2] text-sm font-semibold">{selected.karma ?? "?"}</div>
                        <div className="text-[#4a4a60] text-xs">Karma</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[#eaeaf2] text-sm font-semibold">{selected.follower_count ?? "?"}</div>
                        <div className="text-[#4a4a60] text-xs">Followers</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[#eaeaf2] text-sm font-semibold">{selected.posts ?? "?"}</div>
                        <div className="text-[#4a4a60] text-xs">Posts seen</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Posts */}
                <div className="bg-[#111118] border border-[#2e2e40] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2e2e40]">
                    <h3 className="text-sm font-semibold text-[#eaeaf2]">Recent Posts</h3>
                  </div>
                  <div className="overflow-y-auto max-h-[380px]">
                    {loading && <p className="text-[#4a4a60] text-xs text-center py-6">Fetching posts…</p>}
                    {!loading && selectedPosts.length === 0 && (
                      <p className="text-[#4a4a60] text-xs text-center py-6">
                        No posts found for @{selected.name}
                      </p>
                    )}
                    {selectedPosts.map((p: any) => (
                      <div key={p.id} className="px-4 py-3 border-b border-[#1e1e2e]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[#eaeaf2] text-xs font-medium flex-1">{p.title}</p>
                          <span className="text-[#4a4a60] text-xs shrink-0">{p.upvotes ?? 0} ⬆</span>
                        </div>
                        {p.content && (
                          <div className="mt-1">
                            <p className={`text-[#6b6b8a] text-xs leading-relaxed ${expandedPosts.has(p.id) ? "" : "line-clamp-3"}`}>
                              {p.content}
                            </p>
                            {p.content.length > 180 && (
                              <button
                                onClick={() => setExpandedPosts(prev => {
                                  const n = new Set(prev)
                                  n.has(p.id) ? n.delete(p.id) : n.add(p.id)
                                  return n
                                })}
                                className="text-[10px] text-[#4ecdc4]/70 hover:text-[#4ecdc4] mt-1 transition-colors"
                              >
                                {expandedPosts.has(p.id) ? "▲ Show less" : "▼ Read more"}
                              </button>
                            )}
                          </div>
                        )}

                        {/* AI comment generator */}
                        <div className="mt-2">
                          {aiComment[p.id] ? (
                            <div className="bg-[#1a1a28] border border-[#4ecdc4]/20 rounded-lg p-2 mt-1">
                              <p className="text-[#4ecdc4] text-xs italic">{aiComment[p.id]}</p>
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => postComment(p.id)} className="text-xs text-[#4ecdc4] border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/10 rounded px-2 py-1 transition-colors">Post this</button>
                                <button onClick={() => setAiComment(prev => { const n={...prev}; delete n[p.id]; return n })} className="text-xs text-[#6b6b8a] border border-[#2e2e40] hover:border-[#3e3e55] rounded px-2 py-1 transition-colors">Discard</button>
                                <button onClick={() => generateComment(p)} className="text-xs text-[#6b6b8a] border border-[#2e2e40] hover:border-[#3e3e55] rounded px-2 py-1 transition-colors">Regen</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => generateComment(p)}
                              disabled={commentLoading === p.id}
                              className="text-xs text-[#6b6b8a] hover:text-[#4ecdc4] border border-[#2e2e40] hover:border-[#4ecdc4]/30 rounded px-2 py-1 transition-colors disabled:opacity-40"
                            >
                              {commentLoading === p.id ? "Generating…" : "✦ Generate comment"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Autonomous mode + log */}
          <div className="col-span-3 space-y-4">

            {/* Autonomous mode */}
            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#eaeaf2]">Autonomous Mode</h2>
                <button
                  onClick={toggleAuto}
                  className={`relative w-10 h-5 rounded-full transition-colors ${autoRunning ? "bg-[#4ecdc4]/30 border border-[#4ecdc4]/50" : "bg-[#2e2e40] border border-[#3e3e55]"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${autoRunning ? "left-5 bg-[#4ecdc4]" : "left-0.5 bg-[#6b6b8a]"}`} />
                </button>
              </div>

              {autoRunning && (
                <div className="flex items-center gap-2 mb-3 bg-[#4ecdc4]/10 border border-[#4ecdc4]/20 rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ecdc4] animate-pulse" />
                  <span className="text-[#4ecdc4] text-xs">Running every {autoConfig.interval}m</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#6b6b8a] mb-1 block">Topic filter</label>
                  <input
                    value={autoConfig.topic}
                    onChange={e => setAutoConfig(p => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g. AI, memory, agents…"
                    disabled={autoRunning}
                    className="w-full text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] placeholder-[#4a4a60] outline-none focus:border-[#4ecdc4]/40 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#6b6b8a] mb-1 block">Action</label>
                  <select
                    value={autoConfig.action}
                    onChange={e => setAutoConfig(p => ({ ...p, action: e.target.value as any }))}
                    disabled={autoRunning}
                    className="w-full text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] outline-none focus:border-[#4ecdc4]/40 disabled:opacity-50"
                  >
                    <option value="comment">Comment only</option>
                    <option value="follow">Follow only</option>
                    <option value="both">Comment + Follow</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#6b6b8a] mb-1 block">Interval (minutes)</label>
                  <input
                    type="number" min={1} max={60}
                    value={autoConfig.interval}
                    onChange={e => setAutoConfig(p => ({ ...p, interval: parseInt(e.target.value) || 5 }))}
                    disabled={autoRunning}
                    className="w-full text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] outline-none focus:border-[#4ecdc4]/40 disabled:opacity-50"
                  />
                </div>
              </div>

              <p className="text-[#4a4a60] text-xs mt-3">
                Cbae will scan the feed and interact with agents automatically while this page is open.
              </p>
            </div>

            {/* Interaction log */}
            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2e2e40] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#eaeaf2]">Activity Log</h2>
                {log.length > 0 && (
                  <button onClick={() => setLog([])} className="text-xs text-[#4a4a60] hover:text-[#6b6b8a] transition-colors">Clear</button>
                )}
              </div>
              <div className="overflow-y-auto max-h-[400px] p-3 space-y-1">
                {log.length === 0 && <p className="text-[#4a4a60] text-xs text-center py-4">No activity yet</p>}
                {log.map(entry => (
                  <div key={entry.id} className="flex gap-2 text-xs">
                    <span className="shrink-0 text-[10px] mt-0.5">{logIcon[entry.type]}</span>
                    <div>
                      {entry.agent && <span className="text-[#c8a96e] mr-1">@{entry.agent}</span>}
                      <span className={entry.type === "error" ? "text-red-400" : "text-[#6b6b8a]"}>{entry.detail}</span>
                      <span className="text-[#3a3a55] ml-1">{entry.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
