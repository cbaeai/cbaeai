"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

const MB = "https://www.moltbook.com/api/v1"

function mbHeaders(key: string) {
  return { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Accept": "application/json" }
}

async function mbFetch(key: string, path: string, method = "GET", body?: object, timeout = 14000) {
  try {
    const res = await fetch(`${MB}${path}`, {
      method, headers: mbHeaders(key),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    })
    return res.json()
  } catch (e: any) {
    return { error: e?.name === "TimeoutError" ? "Request timed out" : (e?.message || "Request failed") }
  }
}

async function streamChat(prompt: string, mb_key: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, history: [], agent_mode: false, mb_key }),
  })
  if (!res.body) throw new Error("No response body")
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = "", text = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n"); buffer = lines.pop() || ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      try { const d = JSON.parse(line.slice(6)); if (d.type === "token") text += d.content } catch {}
    }
  }
  return text.trim()
}

type Agent = {
  name: string
  description?: string
  karma?: number
  follower_count?: number
  following_count?: number
  posts?: number
  upvotes?: number
  latestTitle?: string
  latestId?: string
  is_active?: boolean
  allPostIds?: string[]
}

type Post = {
  id: string
  title: string
  content?: string
  author?: { name: string }
  upvotes?: number
  submolt?: { name: string }
  created_at?: string
  comment_count?: number
  comments?: Comment[]
}

type Comment = {
  id: string
  content: string
  author?: { name: string }
  created_at?: string
}

type LogEntry = {
  id: string
  ts: Date
  type: "discover" | "follow" | "comment" | "read" | "profile" | "error" | "post"
  agent?: string
  detail: string
}

type AutoConfig = {
  action: "comment" | "follow" | "both"
  topic: string
  interval: number
  maxPerCycle: number
  avoidDuplicates: boolean
  sortMode: "hot" | "new" | "top" | "rising"
}

type SessionStats = {
  comments: number
  follows: number
  reads: number
  posts: number
  cycles: number
}

const LOG_ICONS: Record<LogEntry["type"], string> = {
  discover: "🔍", follow: "➕", comment: "💬", read: "📖",
  profile: "👤", error: "⚠️", post: "✍️"
}

export default function AgentsPage() {
  const [apiKey, setApiKey]         = useState("")
  const [agents, setAgents]         = useState<Agent[]>([])
  const [selected, setSelected]     = useState<Agent | null>(null)
  const [selectedPosts, setSelectedPosts] = useState<Post[]>([])
  const [openPost, setOpenPost]     = useState<Post | null>(null)
  const [log, setLog]               = useState<LogEntry[]>([])
  const [loading, setLoading]       = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [searchQ, setSearchQ]       = useState("")
  const [autoConfig, setAutoConfig] = useState<AutoConfig>({
    action: "comment", topic: "", interval: 5, maxPerCycle: 2,
    avoidDuplicates: true, sortMode: "new"
  })
  const [autoRunning, setAutoRunning] = useState(false)
  const [aiComment, setAiComment]   = useState<Record<string, string>>({})
  const [commentLoading, setCommentLoading] = useState<string | null>(null)
  const [postLoading, setPostLoading] = useState<string | null>(null)
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [msg, setMsg]               = useState("")
  const [stats, setStats]           = useState<SessionStats>({ comments: 0, follows: 0, reads: 0, posts: 0, cycles: 0 })
  const [commentedPostIds, setCommentedPostIds] = useState<Set<string>>(new Set())
  const [manualComment, setManualComment] = useState<Record<string, string>>({})
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [newPostTitle, setNewPostTitle] = useState("")
  const [newPostContent, setNewPostContent] = useState("")
  const [newPostSubmolt, setNewPostSubmolt] = useState("general")
  const [postingNew, setPostingNew] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const autoRef = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const k = localStorage.getItem("mb_key") || ""
    if (k) setApiKey(k)
    try {
      const saved = sessionStorage.getItem("cbae_commented")
      if (saved) setCommentedPostIds(new Set(JSON.parse(saved)))
    } catch {}
  }, [])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [log])

  const addLog = useCallback((type: LogEntry["type"], detail: string, agent?: string) => {
    setLog(prev => [...prev, { id: Math.random().toString(36).slice(2), ts: new Date(), type, agent, detail }])
  }, [])

  const trackCommented = (postId: string) => {
    setCommentedPostIds(prev => {
      const next = new Set(prev).add(postId)
      try { sessionStorage.setItem("cbae_commented", JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const incStat = (key: keyof SessionStats) => setStats(s => ({ ...s, [key]: s[key] + 1 }))

  // ── Scan ───────────────────────────────────────────────────
  const scanAgents = async () => {
    if (!apiKey) { setMsg("Save your API key on the Moltbook page first"); return }
    setScanLoading(true); setMsg("")
    addLog("discover", `Scanning feed (${autoConfig.sortMode}, 50 posts)…`)

    const data = await mbFetch(apiKey, `/feed?sort=${autoConfig.sortMode}&limit=50`)
    setScanLoading(false)
    if (data.error) { addLog("error", `Scan failed: ${data.error}`); return }

    const posts: any[] = data.posts || []
    const map = new Map<string, Agent>()

    for (const p of posts) {
      const name = p.author?.name
      if (!name) continue
      if (searchQ) {
        const q = searchQ.toLowerCase()
        if (!name.toLowerCase().includes(q) && !p.title?.toLowerCase().includes(q) && !p.content?.toLowerCase().includes(q)) continue
      }
      if (map.has(name)) {
        const a = map.get(name)!
        a.posts = (a.posts || 0) + 1
        a.upvotes = (a.upvotes || 0) + (p.upvotes ?? 0)
        if (p.id && !a.allPostIds?.includes(p.id)) a.allPostIds = [...(a.allPostIds || []), p.id]
      } else {
        map.set(name, { name, posts: 1, upvotes: p.upvotes ?? 0, latestTitle: p.title, latestId: p.id, allPostIds: [p.id] })
      }
    }

    const discovered = Array.from(map.values()).sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
    setAgents(discovered)
    addLog("discover", `Found ${discovered.length} agents${searchQ ? ` matching "${searchQ}"` : ""} in ${posts.length} posts`)
  }

  // ── Load agent ─────────────────────────────────────────────
  const loadAgentProfile = async (agent: Agent) => {
    setSelected(agent); setSelectedPosts([]); setOpenPost(null)
    setLoading(true)
    addLog("profile", `Loading @${agent.name}'s profile…`, agent.name)
    incStat("reads")

    const [profileData, postsData] = await Promise.all([
      mbFetch(apiKey, `/agents/${encodeURIComponent(agent.name)}`),
      mbFetch(apiKey, `/agents/${encodeURIComponent(agent.name)}/posts?limit=10`),
    ])

    if (!profileData.error) {
      const a = profileData.agent || profileData
      setSelected(prev => prev ? { ...prev, description: a.description, karma: a.karma, follower_count: a.follower_count, following_count: a.following_count, is_active: a.is_active } : prev)
    }

    if (!postsData.error && (postsData.posts || []).length > 0) {
      setSelectedPosts(postsData.posts); setLoading(false); return
    }

    // Fallback: search + fetch full post content
    const knownIds: string[] = [...(agent.allPostIds || [])]
    const searchData = await mbFetch(apiKey, `/search?q=${encodeURIComponent(agent.name)}&type=posts&limit=10`)
    if (!searchData.error) {
      for (const r of (searchData.results || [])) {
        if (r.author?.name?.toLowerCase() === agent.name.toLowerCase() && r.id && !knownIds.includes(r.id))
          knownIds.push(r.id)
      }
    }

    if (knownIds.length > 0) {
      addLog("read", `Fetching full content for ${Math.min(knownIds.length, 8)} post(s)…`, agent.name)
      const fullPosts = await Promise.all(knownIds.slice(0, 8).map(id => mbFetch(apiKey, `/posts/${id}`)))
      const resolved = fullPosts.filter(d => !d.error).map(d => d.post || d).filter((p: any) => p.id)
      setSelectedPosts(resolved)
    }
    setLoading(false)
  }

  // ── Load full post + comments ──────────────────────────────
  const loadFullPost = async (post: Post) => {
    setOpenPost(post)
    if (post.comments) return
    setLoadingComments(true)
    const commentsData = await mbFetch(apiKey, `/posts/${post.id}/comments?limit=20`)
    setLoadingComments(false)
    if (!commentsData.error) {
      const comments = commentsData.comments || []
      const updated = { ...post, comments }
      setOpenPost(updated)
      setSelectedPosts(prev => prev.map(p => p.id === post.id ? updated : p))
    }
  }

  // ── Follow ─────────────────────────────────────────────────
  const followAgent = async (name: string) => {
    addLog("follow", `Following @${name}…`, name)
    const data = await mbFetch(apiKey, `/agents/${encodeURIComponent(name)}/follow`, "POST")
    if (data.error) { addLog("error", `Follow failed: ${data.error}`, name); return }
    addLog("follow", data.success ? `✅ Now following @${name}` : JSON.stringify(data).slice(0, 80), name)
    incStat("follows")
  }

  // ── Generate AI comment ────────────────────────────────────
  const generateComment = async (post: Post) => {
    setCommentLoading(post.id)
    try {
      const prompt = `Read this Moltbook post by an AI agent and write a thoughtful, genuine comment as another AI. Be specific — reference actual ideas from the post. Under 3 sentences. No generic phrases like "great post". Reply with ONLY the comment text.

Post title: "${post.title}"
Author: @${post.author?.name}
Content: ${(post.content || "").slice(0, 600)}`
      const text = await streamChat(prompt, apiKey)
      setAiComment(prev => ({ ...prev, [post.id]: text }))
    } catch (e: any) {
      setMsg(`AI error: ${e.message}`)
    } finally {
      setCommentLoading(null)
    }
  }

  // ── Post comment ───────────────────────────────────────────
  const postComment = async (postId: string, content?: string) => {
    const text = content || aiComment[postId]
    if (!text?.trim()) return
    setPostLoading(postId)
    const data = await mbFetch(apiKey, `/posts/${postId}/comments`, "POST", { content: text })
    setPostLoading(null)
    if (data.error) { addLog("error", `Comment failed: ${data.error}`); return }
    addLog("comment", `✅ Commented: "${text.slice(0, 70)}…"`)
    setAiComment(prev => { const n = {...prev}; delete n[postId]; return n })
    setManualComment(prev => { const n = {...prev}; delete n[postId]; return n })
    trackCommented(postId)
    incStat("comments")
  }

  // ── Create post ────────────────────────────────────────────
  const createPost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) { setMsg("Title and content required"); return }
    setPostingNew(true)
    const data = await mbFetch(apiKey, "/posts", "POST", { title: newPostTitle, content: newPostContent, submolt: newPostSubmolt })
    setPostingNew(false)
    if (data.error) { setMsg(`Failed: ${data.error}`); return }
    addLog("post", `✅ Posted: "${newPostTitle}"`)
    incStat("posts")
    setNewPostTitle(""); setNewPostContent(""); setPostModalOpen(false)
    setMsg(`✅ Posted "${newPostTitle}"`)
  }

  // ── Auto loop ──────────────────────────────────────────────
  const runAutoLoop = useCallback(async () => {
    if (!apiKey) { addLog("error", "No API key"); return }
    addLog("discover", `🤖 Auto cycle #${stats.cycles + 1}${autoConfig.topic ? ` — "${autoConfig.topic}"` : ""}…`)
    incStat("cycles")

    const data = await mbFetch(apiKey, `/feed?sort=${autoConfig.sortMode}&limit=50`)
    if (data.error) { addLog("error", `Scan failed: ${data.error}`); return }

    let posts: any[] = data.posts || []
    if (autoConfig.topic) {
      const t = autoConfig.topic.toLowerCase()
      posts = posts.filter((p: any) => p.title?.toLowerCase().includes(t) || p.content?.toLowerCase().includes(t))
    }
    if (autoConfig.avoidDuplicates) posts = posts.filter((p: any) => !commentedPostIds.has(p.id))
    if (!posts.length) { addLog("discover", "No new matching posts this cycle."); return }

    const targets = posts.slice(0, autoConfig.maxPerCycle)
    for (const post of targets) {
      const authorName = post.author?.name
      if (!authorName) continue

      if (autoConfig.action === "follow" || autoConfig.action === "both") {
        const fd = await mbFetch(apiKey, `/agents/${encodeURIComponent(authorName)}/follow`, "POST")
        addLog("follow", fd.success ? `✅ Followed @${authorName}` : JSON.stringify(fd).slice(0, 60), authorName)
        incStat("follows")
      }

      if (autoConfig.action === "comment" || autoConfig.action === "both") {
        try {
          const prompt = `Write a thoughtful, specific comment on this AI agent's Moltbook post. Reference actual ideas. 1-2 sentences max. ONLY the comment text, nothing else.

Title: "${post.title}"
Content: ${(post.content || "").slice(0, 400)}`
          const commentText = await streamChat(prompt, apiKey)
          addLog("comment", `Commenting on "${post.title.slice(0, 40)}"…`, authorName)
          const cd = await mbFetch(apiKey, `/posts/${post.id}/comments`, "POST", { content: commentText })
          if (cd.success) {
            addLog("comment", `✅ "${commentText.slice(0, 60)}…"`, authorName)
            trackCommented(post.id); incStat("comments")
          } else if (cd.statusCode === 429 || (cd.message || "").includes("cooldown")) {
            // Moltbook returned a cooldown error — respect the retry_after_seconds
            const retryAfter = cd.retry_after_seconds ?? 20
            addLog("error", `⏳ Cooldown active — waiting ${retryAfter}s…`)
            await new Promise(r => setTimeout(r, retryAfter * 1000))
          } else {
            addLog("error", `Comment failed: ${JSON.stringify(cd).slice(0, 80)}`)
          }
        } catch (e: any) { addLog("error", `Comment error: ${e.message}`) }
      }

      // ── 20-second delay between each post ────────────────────
      // Moltbook enforces a per-agent comment cooldown; spacing prevents 429s
      const isLastTarget = targets.indexOf(post) === targets.length - 1
      if (!isLastTarget) {
        addLog("discover", `⏱ Waiting 20s before next action…`)
        await new Promise(r => setTimeout(r, 20_000))
      }
    }
  }, [apiKey, autoConfig, commentedPostIds, stats.cycles, addLog])

  const toggleAuto = () => {
    if (autoRunning) {
      if (autoRef.current) clearInterval(autoRef.current)
      setAutoRunning(false)
      addLog("discover", "🛑 Autonomous mode stopped.")
    } else {
      setAutoRunning(true)
      addLog("discover", `🚀 Autonomous mode started (every ${autoConfig.interval}m, max ${autoConfig.maxPerCycle}/cycle)`)
      runAutoLoop()
      autoRef.current = setInterval(runAutoLoop, autoConfig.interval * 60 * 1000)
    }
  }

  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current) }, [])

  return (
    <div className="min-h-screen bg-[#09090e] text-[#eaeaf2] font-sans">
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 60% 40% at 80% 0%, rgba(78,205,196,0.04) 0%, transparent 60%), radial-gradient(ellipse 50% 35% at 10% 100%, rgba(200,169,110,0.04) 0%, transparent 55%)"
      }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl text-[#eaeaf2] tracking-tight">Multi-Agent</h1>
            <p className="text-[#6b6b8a] text-sm mt-1">Discover, follow, and interact with other AI agents on Moltbook</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Session stats */}
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="text-[#4ecdc4]" title="Comments this session">💬 {stats.comments}</span>
              <span className="text-[#c8a96e]" title="Follows this session">➕ {stats.follows}</span>
              <span className="text-[#9a9ab8]" title="Profiles viewed">👤 {stats.reads}</span>
            </div>
            <button onClick={() => setPostModalOpen(true)}
              className="text-xs text-[#c8a96e] border border-[#c8a96e]/30 hover:bg-[#c8a96e]/10 rounded-lg px-3 py-1.5 transition-colors">
              ✍️ New Post
            </button>
            <Link href="/" className="text-xs text-[#6b6b8a] hover:text-[#eaeaf2] border border-[#2e2e40] rounded-lg px-3 py-1.5 transition-colors">← Chat</Link>
            <Link href="/moltbook" className="text-xs text-[#6b6b8a] hover:text-[#c8a96e] border border-[#2e2e40] rounded-lg px-3 py-1.5 transition-colors">⬡ Moltbook</Link>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 text-xs border rounded-lg px-4 py-2 flex items-center justify-between ${msg.startsWith("✅") ? "text-[#4ecdc4] bg-[#4ecdc4]/10 border-[#4ecdc4]/20" : "text-[#c8a96e] bg-[#c8a96e]/10 border-[#c8a96e]/20"}`}>
            <span>{msg}</span>
            <button onClick={() => setMsg("")} className="ml-3 opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">

          {/* ── LEFT: Discovery ── */}
          <div className="col-span-3 space-y-4">
            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#eaeaf2] mb-3">Discover Agents</h2>
              <div className="flex gap-2 mb-2">
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === "Enter" && scanAgents()}
                  placeholder="Filter by topic or name…"
                  className="flex-1 text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] placeholder-[#4a4a60] outline-none focus:border-[#4ecdc4]/40" />
                <button onClick={scanAgents} disabled={scanLoading}
                  className="text-xs bg-[#4ecdc4]/10 hover:bg-[#4ecdc4]/20 text-[#4ecdc4] border border-[#4ecdc4]/30 rounded-lg px-3 py-2 transition-colors disabled:opacity-50 min-w-[50px]">
                  {scanLoading ? "…" : "Scan"}
                </button>
              </div>
              <div className="flex gap-1 mb-2">
                {(["hot","new","top","rising"] as const).map(s => (
                  <button key={s} onClick={() => setAutoConfig(p => ({ ...p, sortMode: s }))}
                    className={`flex-1 text-[10px] rounded px-1 py-1 transition-colors capitalize ${autoConfig.sortMode === s ? "bg-[#4ecdc4]/20 text-[#4ecdc4] border border-[#4ecdc4]/30" : "text-[#4a4a60] border border-[#2e2e40] hover:text-[#6b6b8a]"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[#4a4a60] text-[10px]">Scans 50 posts, extracts unique agents</p>
            </div>

            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2e2e40] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#eaeaf2]">Agents Found</h2>
                <span className="text-xs text-[#4ecdc4] bg-[#4ecdc4]/10 px-2 py-0.5 rounded-full">{agents.length}</span>
              </div>
              <div className="overflow-y-auto max-h-[520px]">
                {agents.length === 0 && <p className="text-[#4a4a60] text-xs text-center py-8">Hit Scan to discover agents</p>}
                {agents.map(a => (
                  <div key={a.name} onClick={() => loadAgentProfile(a)}
                    className={`px-4 py-3 border-b border-[#1a1a28] cursor-pointer hover:bg-[#161622] transition-colors ${selected?.name === a.name ? "bg-[#161622] border-l-2 border-l-[#4ecdc4]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[#c8a96e] text-xs font-semibold">@{a.name}</span>
                      <div className="flex items-center gap-2">
                        {a.posts && a.posts > 1 && <span className="text-[10px] text-[#4ecdc4]/50">{a.posts}p</span>}
                        <span className="text-[#4a4a60] text-[10px]">{a.upvotes ?? 0}⬆</span>
                      </div>
                    </div>
                    <p className="text-[#6b6b8a] text-[11px] mt-0.5 truncate">{a.latestTitle || "No posts"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CENTER: Agent / Post view ── */}
          <div className="col-span-6 space-y-4">
            {!selected ? (
              <div className="bg-[#111118] border border-[#2e2e40] rounded-xl flex flex-col items-center justify-center h-72 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#c8a96e]/20 to-[#4ecdc4]/10 border border-[#2e2e40] flex items-center justify-center text-2xl">⬡</div>
                <p className="text-[#4a4a60] text-sm">Select an agent to view their profile</p>
                <p className="text-[#3a3a55] text-xs">Scan the feed first if no agents appear</p>
              </div>
            ) : openPost ? (
              /* ── Full post view ── */
              <div className="bg-[#111118] border border-[#2e2e40] rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 160px)" }}>
                <div className="px-4 py-3 border-b border-[#2e2e40] flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => setOpenPost(null)} className="text-[#6b6b8a] hover:text-[#eaeaf2] transition-colors text-sm">← Back</button>
                  <span className="text-[#2e2e40]">|</span>
                  <span className="text-[#6b6b8a] text-xs">by <span className="text-[#c8a96e]">@{openPost.author?.name}</span></span>
                  {openPost.submolt?.name && <span className="text-[10px] text-[#4ecdc4]/60 bg-[#4ecdc4]/10 px-2 py-0.5 rounded-full">m/{openPost.submolt.name}</span>}
                </div>
                <div className="overflow-y-auto flex-1 p-5">
                  <h2 className="text-[#eaeaf2] font-semibold text-base mb-2">{openPost.title}</h2>
                  <div className="flex items-center gap-3 mb-4 text-xs text-[#4a4a60]">
                    <span>{openPost.upvotes ?? 0} upvotes</span>
                    {openPost.created_at && <span>{new Date(openPost.created_at).toLocaleDateString()}</span>}
                  </div>
                  {openPost.content && (
                    <p className="text-[#9a9ab8] text-sm leading-relaxed whitespace-pre-wrap mb-6">{openPost.content}</p>
                  )}

                  {/* Comment composer */}
                  <div className="bg-[#0e0e18] border border-[#2e2e40] rounded-xl p-3 mb-6">
                    <p className="text-[10px] text-[#4a4a60] uppercase tracking-wide mb-2">Leave a comment</p>
                    {aiComment[openPost.id] ? (
                      <div>
                        <p className="text-[#4ecdc4] text-xs italic mb-2 leading-relaxed">{aiComment[openPost.id]}</p>
                        <div className="flex gap-2">
                          <button onClick={() => postComment(openPost.id)} disabled={postLoading === openPost.id}
                            className="text-xs text-[#4ecdc4] border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/10 rounded px-3 py-1 transition-colors disabled:opacity-50">
                            {postLoading === openPost.id ? "Posting…" : "Post this"}
                          </button>
                          <button onClick={() => generateComment(openPost)} disabled={commentLoading === openPost.id}
                            className="text-xs text-[#6b6b8a] border border-[#2e2e40] hover:border-[#3e3e55] rounded px-3 py-1 transition-colors">Regen</button>
                          <button onClick={() => setAiComment(prev => { const n={...prev}; delete n[openPost.id]; return n })}
                            className="text-xs text-[#6b6b8a] border border-[#2e2e40] rounded px-3 py-1 transition-colors">Discard</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea value={manualComment[openPost.id] || ""} onChange={e => setManualComment(prev => ({ ...prev, [openPost.id]: e.target.value }))}
                          placeholder="Write a comment…" rows={2}
                          className="w-full text-xs bg-transparent text-[#eaeaf2] placeholder-[#4a4a60] outline-none resize-none" />
                        <div className="flex gap-2 pt-1 border-t border-[#1e1e2e]">
                          <button onClick={() => generateComment(openPost)} disabled={commentLoading === openPost.id}
                            className="text-xs text-[#6b6b8a] hover:text-[#4ecdc4] border border-[#2e2e40] hover:border-[#4ecdc4]/30 rounded px-3 py-1 transition-colors disabled:opacity-40">
                            {commentLoading === openPost.id ? "Generating…" : "✦ AI Comment"}
                          </button>
                          {manualComment[openPost.id]?.trim() && (
                            <button onClick={() => postComment(openPost.id, manualComment[openPost.id])} disabled={postLoading === openPost.id}
                              className="text-xs text-[#4ecdc4] border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/10 rounded px-3 py-1 transition-colors disabled:opacity-50">
                              {postLoading === openPost.id ? "Posting…" : "Post"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comments thread */}
                  <div>
                    <h3 className="text-[10px] font-semibold text-[#6b6b8a] uppercase tracking-wide mb-3">
                      Comments {openPost.comments ? `(${openPost.comments.length})` : ""}
                    </h3>
                    {loadingComments && <p className="text-[#4a4a60] text-xs">Loading comments…</p>}
                    {!loadingComments && openPost.comments?.length === 0 && (
                      <p className="text-[#4a4a60] text-xs">No comments yet — be the first!</p>
                    )}
                    {openPost.comments?.map((c, i) => (
                      <div key={c.id || i} className="mb-4 pl-3 border-l-2 border-[#1e1e2e] hover:border-[#2e2e40] transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[#c8a96e] text-[11px] font-semibold">@{c.author?.name}</span>
                          {c.created_at && <span className="text-[#3a3a55] text-[10px]">{new Date(c.created_at).toLocaleDateString()}</span>}
                        </div>
                        <p className="text-[#7a7a98] text-xs leading-relaxed">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ── Agent profile + posts ── */
              <>
                <div className="bg-[#111118] border border-[#2e2e40] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c8a96e]/30 to-[#4ecdc4]/20 border border-[#2e2e40] flex items-center justify-center text-sm font-bold text-[#c8a96e] flex-shrink-0">
                        {selected.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[#c8a96e] font-semibold">@{selected.name}</h3>
                          {selected.is_active && <span className="text-[10px] text-[#4ecdc4] bg-[#4ecdc4]/10 px-2 py-0.5 rounded-full border border-[#4ecdc4]/20">Active</span>}
                        </div>
                        {selected.description && <p className="text-[#9a9ab8] text-xs mt-0.5 max-w-xs">{selected.description}</p>}
                      </div>
                    </div>
                    <button onClick={() => followAgent(selected.name)}
                      className="text-xs text-[#4ecdc4] border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/10 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0">
                      + Follow
                    </button>
                  </div>
                  {(selected.karma !== undefined || selected.follower_count !== undefined) && (
                    <div className="flex gap-5 mt-3 pt-3 border-t border-[#1e1e2e]">
                      {[
                        { label: "Karma", val: selected.karma },
                        { label: "Followers", val: selected.follower_count },
                        { label: "Following", val: selected.following_count },
                        { label: "Posts seen", val: selected.posts },
                      ].filter(x => x.val !== undefined).map(({ label, val }) => (
                        <div key={label} className="text-center">
                          <div className="text-[#eaeaf2] text-sm font-semibold">{val}</div>
                          <div className="text-[#4a4a60] text-[10px]">{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#111118] border border-[#2e2e40] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2e2e40] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#eaeaf2]">Recent Posts</h3>
                    {selectedPosts.length > 0 && <span className="text-[10px] text-[#4a4a60]">{selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""}</span>}
                  </div>
                  <div className="overflow-y-auto max-h-[460px]">
                    {loading && (
                      <div className="flex items-center justify-center py-8 gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#4ecdc4]/40 animate-pulse" />
                        <p className="text-[#4a4a60] text-xs">Fetching posts…</p>
                      </div>
                    )}
                    {!loading && selectedPosts.length === 0 && (
                      <p className="text-[#4a4a60] text-xs text-center py-8">No posts found for @{selected.name}</p>
                    )}
                    {selectedPosts.map((p: Post) => (
                      <div key={p.id} className="px-4 py-3 border-b border-[#1a1a28]">
                        <div className="flex items-start justify-between gap-2 cursor-pointer group" onClick={() => loadFullPost(p)}>
                          <p className="text-[#eaeaf2] text-xs font-medium flex-1 group-hover:text-[#c8a96e] transition-colors">{p.title}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {commentedPostIds.has(p.id) && <span className="text-[10px] text-[#4ecdc4]/50 border border-[#4ecdc4]/20 px-1.5 py-0.5 rounded">✓ commented</span>}
                            <span className="text-[#4a4a60] text-[10px]">{p.upvotes ?? 0}⬆</span>
                          </div>
                        </div>
                        {p.content && (
                          <div className="mt-1">
                            <p className={`text-[#6b6b8a] text-[11px] leading-relaxed ${expandedPosts.has(p.id) ? "" : "line-clamp-2"}`}>{p.content}</p>
                            {p.content.length > 120 && (
                              <button onClick={() => setExpandedPosts(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                                className="text-[10px] text-[#4ecdc4]/40 hover:text-[#4ecdc4] mt-0.5 transition-colors">
                                {expandedPosts.has(p.id) ? "▲ Less" : "▼ More"}
                              </button>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <button onClick={() => loadFullPost(p)} className="text-[10px] text-[#6b6b8a] hover:text-[#9a9ab8] transition-colors">💬 Open & comment</button>
                          <span className="text-[#2e2e40]">·</span>
                          <button onClick={() => generateComment(p)} disabled={commentLoading === p.id}
                            className="text-[10px] text-[#6b6b8a] hover:text-[#4ecdc4] transition-colors disabled:opacity-40">
                            {commentLoading === p.id ? "Generating…" : "✦ Quick AI"}
                          </button>
                        </div>
                        {aiComment[p.id] && (
                          <div className="bg-[#1a1a28] border border-[#4ecdc4]/20 rounded-lg p-2 mt-2">
                            <p className="text-[#4ecdc4] text-[11px] italic leading-relaxed">{aiComment[p.id]}</p>
                            <div className="flex gap-2 mt-1.5">
                              <button onClick={() => postComment(p.id)} disabled={postLoading === p.id}
                                className="text-[10px] text-[#4ecdc4] border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/10 rounded px-2 py-0.5 transition-colors disabled:opacity-50">
                                {postLoading === p.id ? "Posting…" : "Post"}
                              </button>
                              <button onClick={() => generateComment(p)} className="text-[10px] text-[#6b6b8a] border border-[#2e2e40] rounded px-2 py-0.5">Regen</button>
                              <button onClick={() => setAiComment(prev => { const n={...prev}; delete n[p.id]; return n })}
                                className="text-[10px] text-[#6b6b8a] border border-[#2e2e40] rounded px-2 py-0.5">✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT: Auto mode + log ── */}
          <div className="col-span-3 space-y-4">
            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#eaeaf2]">Autonomous Mode</h2>
                <button onClick={toggleAuto}
                  className={`relative w-10 h-5 rounded-full transition-all ${autoRunning ? "bg-[#4ecdc4]/30 border border-[#4ecdc4]/50" : "bg-[#2e2e40] border border-[#3e3e55]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${autoRunning ? "left-5 bg-[#4ecdc4]" : "left-0.5 bg-[#6b6b8a]"}`} />
                </button>
              </div>

              {autoRunning && (
                <div className="flex items-center gap-2 mb-3 bg-[#4ecdc4]/10 border border-[#4ecdc4]/20 rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ecdc4] animate-pulse" />
                  <span className="text-[#4ecdc4] text-xs">Running · {stats.cycles} cycle{stats.cycles !== 1 ? "s" : ""}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#6b6b8a] mb-1 block uppercase tracking-wide">Topic filter</label>
                  <input value={autoConfig.topic} onChange={e => setAutoConfig(p => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g. AI, memory, agents…" disabled={autoRunning}
                    className="w-full text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] placeholder-[#4a4a60] outline-none focus:border-[#4ecdc4]/40 disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b6b8a] mb-1 block uppercase tracking-wide">Action</label>
                  <select value={autoConfig.action} onChange={e => setAutoConfig(p => ({ ...p, action: e.target.value as any }))} disabled={autoRunning}
                    className="w-full text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] outline-none focus:border-[#4ecdc4]/40 disabled:opacity-50">
                    <option value="comment">Comment only</option>
                    <option value="follow">Follow only</option>
                    <option value="both">Comment + Follow</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b6b8a] mb-1 block uppercase tracking-wide">Interval (min)</label>
                    <input type="number" min={1} max={60} value={autoConfig.interval}
                      onChange={e => setAutoConfig(p => ({ ...p, interval: parseInt(e.target.value) || 5 }))} disabled={autoRunning}
                      className="w-full text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] outline-none focus:border-[#4ecdc4]/40 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b6b8a] mb-1 block uppercase tracking-wide">Max / cycle</label>
                    <input type="number" min={1} max={10} value={autoConfig.maxPerCycle}
                      onChange={e => setAutoConfig(p => ({ ...p, maxPerCycle: parseInt(e.target.value) || 2 }))} disabled={autoRunning}
                      className="w-full text-xs bg-[#1a1a28] border border-[#2e2e40] rounded-lg px-3 py-2 text-[#eaeaf2] outline-none focus:border-[#4ecdc4]/40 disabled:opacity-50" />
                  </div>
                </div>
                <div onClick={() => !autoRunning && setAutoConfig(p => ({ ...p, avoidDuplicates: !p.avoidDuplicates }))}
                  className="flex items-center gap-2 cursor-pointer select-none">
                  <div className={`relative w-7 h-4 rounded-full transition-colors ${autoConfig.avoidDuplicates ? "bg-[#4ecdc4]/30 border border-[#4ecdc4]/40" : "bg-[#2e2e40] border border-[#3e3e55]"}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${autoConfig.avoidDuplicates ? "left-3.5 bg-[#4ecdc4]" : "left-0.5 bg-[#6b6b8a]"}`} />
                  </div>
                  <span className="text-[11px] text-[#6b6b8a]">Skip already commented</span>
                </div>
              </div>

              {/* Cycle stats */}
              {(stats.comments > 0 || stats.follows > 0) && (
                <div className="mt-3 pt-3 border-t border-[#1e1e2e] grid grid-cols-3 gap-2 text-center">
                  {[{ label: "commented", val: stats.comments, color: "text-[#4ecdc4]" }, { label: "followed", val: stats.follows, color: "text-[#c8a96e]" }, { label: "cycles", val: stats.cycles, color: "text-[#9a9ab8]" }].map(({ label, val, color }) => (
                    <div key={label}>
                      <div className={`text-sm font-semibold ${color}`}>{val}</div>
                      <div className="text-[10px] text-[#4a4a60]">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div className="bg-[#111118] border border-[#2e2e40] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2e2e40] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#eaeaf2]">Activity Log</h2>
                {log.length > 0 && <button onClick={() => setLog([])} className="text-[10px] text-[#4a4a60] hover:text-[#6b6b8a]">Clear</button>}
              </div>
              <div className="overflow-y-auto max-h-[380px] p-3 space-y-1.5">
                {log.length === 0 && <p className="text-[#4a4a60] text-xs text-center py-4">No activity yet</p>}
                {log.map(entry => (
                  <div key={entry.id} className="flex gap-2 text-xs items-start">
                    <span className="shrink-0 text-[11px] mt-0.5 w-4">{LOG_ICONS[entry.type]}</span>
                    <div className="min-w-0 flex-1">
                      {entry.agent && <span className="text-[#c8a96e] mr-1 font-medium text-[11px]">@{entry.agent}</span>}
                      <span className={`${entry.type === "error" ? "text-red-400/80" : "text-[#6b6b8a]"} text-[11px] break-words`}>{entry.detail}</span>
                      <div className="text-[#3a3a55] text-[10px] mt-0.5">{entry.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Post Modal */}
      {postModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => e.target === e.currentTarget && setPostModalOpen(false)}>
          <div className="bg-[#111118] border border-[#2e2e40] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#eaeaf2] font-semibold">Create Moltbook Post</h2>
              <button onClick={() => setPostModalOpen(false)} className="text-[#4a4a60] hover:text-[#6b6b8a] text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3">
              <input value={newPostTitle} onChange={e => setNewPostTitle(e.target.value)} placeholder="Post title…"
                className="w-full text-sm bg-[#1a1a28] border border-[#2e2e40] focus:border-[#4ecdc4]/40 rounded-xl px-4 py-3 text-[#eaeaf2] placeholder-[#4a4a60] outline-none" />
              <textarea value={newPostContent} onChange={e => setNewPostContent(e.target.value)} placeholder="Post content…" rows={5}
                className="w-full text-sm bg-[#1a1a28] border border-[#2e2e40] focus:border-[#4ecdc4]/40 rounded-xl px-4 py-3 text-[#eaeaf2] placeholder-[#4a4a60] outline-none resize-none" />
              <input value={newPostSubmolt} onChange={e => setNewPostSubmolt(e.target.value)} placeholder="Submolt (default: general)"
                className="w-full text-sm bg-[#1a1a28] border border-[#2e2e40] focus:border-[#4ecdc4]/40 rounded-xl px-4 py-3 text-[#eaeaf2] placeholder-[#4a4a60] outline-none" />
              <div className="flex gap-3 pt-1">
                <button onClick={createPost} disabled={postingNew || !newPostTitle.trim() || !newPostContent.trim()}
                  className="flex-1 text-sm text-[#111118] font-semibold bg-[#c8a96e] hover:bg-[#d4b87a] rounded-xl px-4 py-2.5 transition-colors disabled:opacity-40">
                  {postingNew ? "Posting…" : "Post to Moltbook"}
                </button>
                <button onClick={() => setPostModalOpen(false)}
                  className="text-sm text-[#6b6b8a] border border-[#2e2e40] hover:border-[#3e3e55] rounded-xl px-4 py-2.5 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
