"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

// ── Types ──────────────────────────────────────────────────────
type MainTab = "feed" | "agents" | "post" | "search" | "profile" | "register"

type Agent = {
  name: string
  posts?: number
  upvotes?: number
  latestTitle?: string
  latestId?: string
  allPostIds?: string[]
  description?: string
  karma?: number
  follower_count?: number
  following_count?: number
  is_active?: boolean
}

type Comment = { id: string; content: string; author: { name: string }; created_at?: string }
type Post = {
  id: string; title: string; content: string; upvotes: number
  author: { name: string }; submolt?: { name: string }
  comment_count?: number; comments?: Comment[]
}

type LogEntry = { id: string; ts: Date; type: "discover"|"follow"|"comment"|"read"|"profile"|"error"|"post"; agent?: string; detail: string }
type AutoConfig = { action: "comment"|"follow"|"both"; topic: string; interval: number; maxPerCycle: number; avoidDuplicates: boolean; sortMode: "hot"|"new"|"top"|"rising" }
type SessionStats = { comments: number; follows: number; reads: number; posts: number; cycles: number }

// ── API helpers ────────────────────────────────────────────────
const MB = "https://www.moltbook.com/api/v1"

async function mbFetch(key: string, path: string, method = "GET", body?: object, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${MB}${path}`, {
        method,
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
      })
      return await res.json()
    } catch (e: any) {
      if (attempt === retries) return { error: e?.name === "TimeoutError" ? "Request timed out" : (e?.message || "Network error") }
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
    }
  }
}

async function streamChat(prompt: string, mbKey: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, history: [], agent_mode: false, model: "openai/gpt-4o-mini", mb_key: mbKey }),
  })
  if (!res.body) return ""
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let result = "", buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n"); buf = lines.pop() || ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      try { const d = JSON.parse(line.slice(6)); if (d.type === "token") result += d.content } catch {}
    }
  }
  return result.trim()
}

// ── Avatar ─────────────────────────────────────────────────────
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ["#c8a96e","#4ecdc4","#a78bfa","#f59e0b","#34d399","#f472b6"]
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, background: `${color}22`, border: `1px solid ${color}44`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 600, color, flexShrink: 0 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Post Card ──────────────────────────────────────────────────
function PostCard({ post, onComment, onUpvote, commented, onOpen }: {
  post: Post; onComment?: () => void; onUpvote?: () => void; commented?: boolean; onOpen?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = post.content?.slice(0, 180)
  const hasMore = (post.content?.length || 0) > 180
  return (
    <div className="group border border-[#2a2a3d] hover:border-[#3e3e5a] bg-[#0e0e18] rounded-2xl p-5 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={post.author?.name || "?"} size={28} />
          <span className="text-[#c8a96e] text-xs font-semibold">@{post.author?.name}</span>
          {post.submolt?.name && <span className="text-[#2a2a3d] text-xs">m/{post.submolt.name}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {commented && <span className="text-[10px] text-[#4ecdc4]/60 border border-[#4ecdc4]/20 px-1.5 py-0.5 rounded-full">✓</span>}
          <span className="text-[#3e3e5a] text-xs">↑ {post.upvotes ?? 0}</span>
        </div>
      </div>
      <h3 className="text-[#eaeaf2] text-sm font-medium mb-2 leading-snug">{post.title}</h3>
      <p className="text-[#5a5a78] text-xs leading-relaxed">
        {expanded ? post.content : preview}{hasMore && !expanded && "…"}
      </p>
      {hasMore && (
        <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-[#3e3e5a] hover:text-[#6b6b8a] mt-1 transition-colors">
          {expanded ? "▲ less" : "▼ more"}
        </button>
      )}
      <div className="flex gap-2 mt-4">
        {onOpen && <button onClick={onOpen} className="text-[11px] text-[#5a5a78] hover:text-[#eaeaf2] border border-[#2a2a3d] hover:border-[#3e3e5a] rounded-lg px-3 py-1.5 transition-all">💬 Open</button>}
        {onComment && <button onClick={onComment} className="text-[11px] text-[#4ecdc4]/60 hover:text-[#4ecdc4] border border-[#4ecdc4]/15 hover:border-[#4ecdc4]/40 rounded-lg px-3 py-1.5 transition-all">✦ AI Comment</button>}
        {onUpvote && <button onClick={onUpvote} className="text-[11px] text-[#c8a96e]/60 hover:text-[#c8a96e] border border-[#c8a96e]/15 hover:border-[#c8a96e]/40 rounded-lg px-3 py-1.5 transition-all">↑ Upvote</button>}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function MoltbookPage() {
  const [apiKey, setApiKey]     = useState("")
  const [savedKey, setSavedKey] = useState("")
  const [keyStatus, setKeyStatus] = useState<""|"saved"|"claimed"|"error">("")
  const [tab, setTab]           = useState<MainTab>("feed")
  const [msg, setMsg]           = useState("")

  // Feed
  const [feedPosts, setFeedPosts]     = useState<Post[]>([])
  const [feedSort, setFeedSort]       = useState("hot")
  const [feedLimit, setFeedLimit]     = useState(10)
  const [feedLoading, setFeedLoading] = useState(false)
  const [upvotedIds, setUpvotedIds]   = useState<Set<string>>(new Set())

  // Post composer
  const [postTitle, setPostTitle]     = useState("")
  const [postContent, setPostContent] = useState("")
  const [postSubmolt, setPostSubmolt] = useState("general")
  const [postLoading, setPostLoading] = useState(false)

  // Search
  const [searchQ, setSearchQ]             = useState("")
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Profile
  const [profile, setProfile]           = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Register
  const [regName, setRegName]     = useState("Cbae")
  const [regDesc, setRegDesc]     = useState("Autonomous AI assistant")
  const [regResult, setRegResult] = useState<any>(null)
  const [regLoading, setRegLoading] = useState(false)

  // Agents
  const [agents, setAgents]               = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [agentPosts, setAgentPosts]       = useState<Post[]>([])
  const [openPost, setOpenPost]           = useState<Post | null>(null)
  const [scanLoading, setScanLoading]     = useState(false)
  const [agentLoading, setAgentLoading]   = useState(false)
  const [agentSearchQ, setAgentSearchQ]   = useState("")
  const [commentTexts, setCommentTexts]   = useState<Record<string, string>>({})
  const [commentLoading, setCommentLoading] = useState<string | null>(null)
  const [postCommentLoading, setPostCommentLoading] = useState<string | null>(null)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentedIds, setCommentedIds]   = useState<Set<string>>(new Set())

  // Auto
  const [autoConfig, setAutoConfig] = useState<AutoConfig>({ action: "comment", topic: "", interval: 5, maxPerCycle: 2, avoidDuplicates: true, sortMode: "new" })
  const [autoRunning, setAutoRunning] = useState(false)
  const [log, setLog]               = useState<LogEntry[]>([])
  const [stats, setStats]           = useState<SessionStats>({ comments: 0, follows: 0, reads: 0, posts: 0, cycles: 0 })
  const autoRef  = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  // New post modal
  const [newPostModal, setNewPostModal]     = useState(false)
  const [newPostTitle, setNewPostTitle]     = useState("")
  const [newPostContent, setNewPostContent] = useState("")
  const [newPostSubmolt, setNewPostSubmolt] = useState("general")
  const [newPostLoading, setNewPostLoading] = useState(false)

  useEffect(() => {
    const k = localStorage.getItem("mb_key") || ""
    if (k) { setApiKey(k); setSavedKey(k); setKeyStatus("saved") }
    try {
      const saved = sessionStorage.getItem("cbae_commented")
      if (saved) setCommentedIds(new Set(JSON.parse(saved)))
    } catch {}
  }, [])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [log])

  const addLog = useCallback((type: LogEntry["type"], detail: string, agent?: string) => {
    setLog(prev => [...prev, { id: Math.random().toString(36).slice(2), ts: new Date(), type, agent, detail }])
  }, [])
  const incStat = (key: keyof SessionStats) => setStats(s => ({ ...s, [key]: s[key] + 1 }))
  const trackCommented = (id: string) => {
    setCommentedIds(prev => {
      const next = new Set(prev).add(id)
      try { sessionStorage.setItem("cbae_commented", JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  // Auth
  const saveKey = () => {
    const k = apiKey.trim(); if (!k) { setMsg("Enter your API key first"); return }
    localStorage.setItem("mb_key", k); setSavedKey(k); setKeyStatus("saved"); setMsg("✅ Key saved!")
  }
  const testKey = async () => {
    if (!savedKey) { setMsg("Save your API key first"); return }
    setMsg("Testing…")
    const r = await mbFetch(savedKey, "/agents/status")
    if (r.error) { setMsg(`Error: ${r.error}`); setKeyStatus("error"); return }
    setKeyStatus(r.status === "claimed" ? "claimed" : "saved")
    setMsg(r.status === "claimed" ? "✅ Agent is live!" : r.status === "pending_claim" ? "⏳ Pending claim" : `Status: ${JSON.stringify(r)}`)
  }

  // Feed
  const loadFeed = async () => {
    if (!savedKey) { setMsg("Save your API key first"); return }
    setFeedLoading(true); setMsg("")
    const data = await mbFetch(savedKey, `/feed?sort=${feedSort}&limit=${feedLimit}`)
    setFeedLoading(false)
    if (data.error) { setMsg(`Error: ${data.error}`); return }
    setFeedPosts(data.posts || [])
  }
  const upvotePost = async (postId: string) => {
    const r = await mbFetch(savedKey, `/posts/${postId}/upvote`, "POST")
    if (!r.error) { setUpvotedIds(prev => new Set(prev).add(postId)); setFeedPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: (p.upvotes || 0) + 1 } : p)); setMsg("↑ Upvoted!") }
    else setMsg(`Error: ${r.error}`)
  }

  // Post
  const handlePost = async () => {
    if (!postTitle || !postContent) { setMsg("Fill in title and content"); return }
    setPostLoading(true)
    const r = await mbFetch(savedKey, "/posts", "POST", { submolt: postSubmolt, title: postTitle, content: postContent })
    setPostLoading(false)
    if (r.error) { setMsg(`Error: ${r.error}`); return }
    setMsg("✅ Posted!"); setPostTitle(""); setPostContent(""); incStat("posts")
  }

  // Search
  const handleSearch = async () => {
    if (!searchQ || !savedKey) return
    setSearchLoading(true)
    const r = await mbFetch(savedKey, `/search?q=${encodeURIComponent(searchQ)}&type=all&limit=10`)
    setSearchLoading(false); setSearchResults(r.results || [])
    if (!r.results?.length) setMsg("No results found")
  }

  // Profile
  const loadProfile = async () => {
    const key = savedKey || apiKey.trim(); if (!key) { setMsg("Save your API key first"); return }
    setProfileLoading(true)
    const r = await mbFetch(key, "/agents/me"); setProfileLoading(false)
    if (r.error) { setMsg(`Error: ${r.error}`); return }
    const agent = r.agent ?? r.data?.agent ?? (r.success === false ? null : r)
    if (!agent?.name) { setMsg(`Unexpected: ${JSON.stringify(r).slice(0, 200)}`); return }
    setProfile(agent); setKeyStatus("claimed")
  }

  // Register
  const handleRegister = async () => {
    setRegLoading(true); setMsg("Registering…")
    try {
      const res = await fetch(`${MB}/agents/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: regName, description: regDesc }) })
      const r = await res.json(); setRegLoading(false)
      if (r.error) { setMsg(`Error: ${r.error}`); return }
      setRegResult(r)
    } catch (e: any) { setRegLoading(false); setMsg(`Error: ${e?.message}`) }
  }

  // Agents scan
  const scanAgents = async () => {
    if (!savedKey) { setMsg("Save your API key first"); return }
    setScanLoading(true); addLog("discover", `Scanning feed (${autoConfig.sortMode}, 50 posts)…`)
    const data = await mbFetch(savedKey, `/feed?sort=${autoConfig.sortMode}&limit=50`); setScanLoading(false)
    if (data.error) { addLog("error", `Scan failed: ${data.error}`); return }
    const posts: any[] = data.posts || []; const map = new Map<string, Agent>()
    for (const p of posts) {
      const name = p.author?.name; if (!name) continue
      if (agentSearchQ) { const q = agentSearchQ.toLowerCase(); if (!name.toLowerCase().includes(q) && !p.title?.toLowerCase().includes(q)) continue }
      if (map.has(name)) { const a = map.get(name)!; a.posts = (a.posts||0)+1; a.upvotes = (a.upvotes||0)+(p.upvotes??0); if (p.id && !a.allPostIds?.includes(p.id)) a.allPostIds = [...(a.allPostIds||[]), p.id] }
      else map.set(name, { name, posts: 1, upvotes: p.upvotes??0, latestTitle: p.title, latestId: p.id, allPostIds: [p.id] })
    }
    const discovered = Array.from(map.values()).sort((a, b) => (b.upvotes||0)-(a.upvotes||0)); setAgents(discovered)
    addLog("discover", `Found ${discovered.length} agents in ${posts.length} posts`)
  }

  const loadAgentProfile = async (agent: Agent) => {
    setSelectedAgent(agent); setAgentPosts([]); setOpenPost(null); setAgentLoading(true)
    addLog("profile", `Loading @${agent.name}…`, agent.name); incStat("reads")
    const [profileData, postsData] = await Promise.all([mbFetch(savedKey, `/agents/${encodeURIComponent(agent.name)}`), mbFetch(savedKey, `/agents/${encodeURIComponent(agent.name)}/posts?limit=10`)])
    if (!profileData.error) { const a = profileData.agent||profileData; setSelectedAgent(prev => prev ? { ...prev, description: a.description, karma: a.karma, follower_count: a.follower_count, following_count: a.following_count, is_active: a.is_active } : prev) }
    if (!postsData.error && (postsData.posts||[]).length > 0) { setAgentPosts(postsData.posts); setAgentLoading(false); return }
    const knownIds: string[] = [...(agent.allPostIds||[])]
    const searchData = await mbFetch(savedKey, `/search?q=${encodeURIComponent(agent.name)}&type=posts&limit=10`)
    if (!searchData.error) for (const r of (searchData.results||[])) if (r.author?.name?.toLowerCase()===agent.name.toLowerCase() && r.id && !knownIds.includes(r.id)) knownIds.push(r.id)
    if (knownIds.length > 0) { const fullPosts = await Promise.all(knownIds.slice(0,8).map((id: string) => mbFetch(savedKey, `/posts/${id}`))); setAgentPosts(fullPosts.filter((d: any) => !d.error).map((d: any) => d.post||d).filter((p: any) => p.id)) }
    setAgentLoading(false)
  }

  const loadFullPost = async (post: Post) => {
    setOpenPost(post); if (post.comments) return
    setCommentsLoading(true)
    const data = await mbFetch(savedKey, `/posts/${post.id}/comments?limit=20`); setCommentsLoading(false)
    if (!data.error) { const updated = { ...post, comments: data.comments||[] }; setOpenPost(updated); setAgentPosts(prev => prev.map(p => p.id===post.id ? updated : p)) }
  }

  const followAgent = async (name: string) => {
    addLog("follow", `Following @${name}…`, name)
    const data = await mbFetch(savedKey, `/agents/${encodeURIComponent(name)}/follow`, "POST")
    addLog(data.success ? "follow" : "error", data.success ? `✅ Following @${name}` : `Failed: ${data.error}`, name)
    if (data.success) incStat("follows")
  }

  const generateComment = async (post: Post) => {
    setCommentLoading(post.id)
    try {
      const text = await streamChat(`Read this Moltbook post by an AI agent and write a thoughtful, genuine comment. Be specific — reference actual ideas. Under 3 sentences. No generic phrases. Reply with ONLY the comment text.\n\nPost: "${post.title}"\n${(post.content||"").slice(0,600)}`, savedKey)
      setCommentTexts(prev => ({ ...prev, [post.id]: text }))
    } catch (e: any) { setMsg(`AI error: ${e.message}`) }
    finally { setCommentLoading(null) }
  }

  const postComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim(); if (!text) return
    setPostCommentLoading(postId)
    const data = await mbFetch(savedKey, `/posts/${postId}/comments`, "POST", { content: text }); setPostCommentLoading(null)
    if (data.error) { addLog("error", `Comment failed: ${data.error}`); return }
    addLog("comment", `✅ "${text.slice(0,60)}…"`); setCommentTexts(prev => { const n={...prev}; delete n[postId]; return n })
    trackCommented(postId); incStat("comments")
  }

  const createNewPost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) { setMsg("Title and content required"); return }
    setNewPostLoading(true)
    const data = await mbFetch(savedKey, "/posts", "POST", { title: newPostTitle, content: newPostContent, submolt: newPostSubmolt }); setNewPostLoading(false)
    if (data.error) { setMsg(`Failed: ${data.error}`); return }
    addLog("post", `✅ Posted: "${newPostTitle}"`); incStat("posts"); setNewPostTitle(""); setNewPostContent(""); setNewPostModal(false); setMsg(`✅ Posted "${newPostTitle}"`)
  }

  // Auto loop
  const runAutoLoop = useCallback(async () => {
    if (!savedKey) { addLog("error", "No API key"); return }
    addLog("discover", `🤖 Auto cycle #${stats.cycles+1}${autoConfig.topic ? ` — "${autoConfig.topic}"` : ""}…`); incStat("cycles")
    const data = await mbFetch(savedKey, `/feed?sort=${autoConfig.sortMode}&limit=50`)
    if (data.error) { addLog("error", `Scan failed: ${data.error}`); return }
    let posts: any[] = data.posts || []
    if (autoConfig.topic) { const t=autoConfig.topic.toLowerCase(); posts=posts.filter((p: any) => p.title?.toLowerCase().includes(t)||p.content?.toLowerCase().includes(t)) }
    if (autoConfig.avoidDuplicates) posts = posts.filter((p: any) => !commentedIds.has(p.id))
    if (!posts.length) { addLog("discover", "No new posts this cycle."); return }
    const targets = posts.slice(0, autoConfig.maxPerCycle)
    for (const post of targets) {
      const authorName = post.author?.name; if (!authorName) continue
      if (autoConfig.action==="follow"||autoConfig.action==="both") {
        const fd = await mbFetch(savedKey, `/agents/${encodeURIComponent(authorName)}/follow`, "POST")
        addLog(fd.success?"follow":"error", fd.success?`✅ Followed @${authorName}`:JSON.stringify(fd).slice(0,60), authorName)
        if (fd.success) incStat("follows")
      }
      if (autoConfig.action==="comment"||autoConfig.action==="both") {
        try {
          const commentText = await streamChat(`Write a thoughtful, specific comment on this Moltbook post. Reference actual ideas. 1-2 sentences. ONLY the comment text.\n\nTitle: "${post.title}"\nContent: ${(post.content||"").slice(0,400)}`, savedKey)
          addLog("comment", `Commenting on "${post.title.slice(0,40)}"…`, authorName)
          const cd = await mbFetch(savedKey, `/posts/${post.id}/comments`, "POST", { content: commentText })
          if (cd.success) { addLog("comment", `✅ "${commentText.slice(0,60)}…"`, authorName); trackCommented(post.id); incStat("comments") }
          else if (cd.statusCode===429||(cd.message||"").includes("cooldown")) { const w=cd.retry_after_seconds??20; addLog("error", `⏳ Cooldown — waiting ${w}s…`); await new Promise(r=>setTimeout(r,w*1000)) }
          else addLog("error", `Comment failed: ${JSON.stringify(cd).slice(0,80)}`)
        } catch (e: any) { addLog("error", `Comment error: ${e.message}`) }
      }
      const isLast = targets.indexOf(post)===targets.length-1
      if (!isLast) { addLog("discover", `⏱ Waiting 20s…`); await new Promise(r=>setTimeout(r,20_000)) }
    }
  }, [savedKey, autoConfig, commentedIds, stats.cycles, addLog])

  const toggleAuto = () => {
    if (autoRunning) { if (autoRef.current) clearInterval(autoRef.current); setAutoRunning(false); addLog("discover", "🛑 Autonomous mode stopped.") }
    else { setAutoRunning(true); addLog("discover", `🚀 Auto started (every ${autoConfig.interval}m, max ${autoConfig.maxPerCycle}/cycle)`); runAutoLoop(); autoRef.current = setInterval(runAutoLoop, autoConfig.interval*60*1000) }
  }
  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current) }, [])

  // UI helpers
  const statusColor = keyStatus==="claimed" ? "#4ecdc4" : keyStatus==="error" ? "#f87171" : keyStatus==="saved" ? "#c8a96e" : "#6b6b8a"
  const statusLabel = keyStatus==="claimed" ? "Live ✦" : keyStatus==="error" ? "Error" : keyStatus==="saved" ? "Saved" : ""
  const LOG_ICONS: Record<LogEntry["type"],string> = { discover:"◎", follow:"+", comment:"◉", read:"◈", profile:"◑", error:"!", post:"✦" }
  const LOG_COLORS: Record<LogEntry["type"],string> = { discover:"#6b6b8a", follow:"#4ecdc4", comment:"#c8a96e", read:"#a78bfa", profile:"#6b6b8a", error:"#f87171", post:"#c8a96e" }
  const TABS: { id: MainTab; label: string }[] = [
    { id:"feed", label:"Feed" }, { id:"agents", label:"Agents" }, { id:"post", label:"Post" },
    { id:"search", label:"Search" }, { id:"profile", label:"Profile" }, { id:"register", label:"Register" },
  ]
  const ic = "w-full bg-[#0c0c16] border border-[#2a2a3d] focus:border-[#c8a96e]/50 text-[#eaeaf2] text-sm rounded-xl px-4 py-2.5 outline-none placeholder-[#3a3a52] transition-colors"
  const bG = "bg-[#c8a96e]/10 hover:bg-[#c8a96e]/20 border border-[#c8a96e]/30 hover:border-[#c8a96e]/50 text-[#c8a96e] text-sm rounded-xl px-4 py-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
  const bT = "bg-[#4ecdc4]/10 hover:bg-[#4ecdc4]/20 border border-[#4ecdc4]/25 text-[#4ecdc4] text-sm rounded-xl px-4 py-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"

  return (
    <div className="min-h-screen bg-[#07070f] text-[#eaeaf2]" style={{ fontFamily:"'DM Sans', sans-serif" }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background:"radial-gradient(ellipse 60% 50% at 20% -10%, rgba(200,169,110,0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 110%, rgba(78,205,196,0.04) 0%, transparent 55%)" }} />

      {/* New post modal */}
      {newPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={()=>setNewPostModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-[#0e0e18] border border-[#2a2a3d] rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e=>e.stopPropagation()}>
            <h2 className="text-[#eaeaf2] font-medium mb-5 text-base">New Post</h2>
            <div className="flex flex-col gap-3">
              <input value={newPostSubmolt} onChange={e=>setNewPostSubmolt(e.target.value)} placeholder="Submolt (e.g. general)" className={ic} />
              <input value={newPostTitle} onChange={e=>setNewPostTitle(e.target.value)} placeholder="Title" className={ic} />
              <textarea value={newPostContent} onChange={e=>setNewPostContent(e.target.value)} placeholder="Content…" rows={5} className={ic+" resize-none"} />
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={()=>setNewPostModal(false)} className="text-sm text-[#5a5a78] hover:text-[#eaeaf2] px-4 py-2 transition-colors">Cancel</button>
                <button onClick={createNewPost} disabled={newPostLoading||!savedKey} className="bg-gradient-to-r from-[#c8a96e] to-[#9a7840] text-[#07070f] text-sm font-semibold rounded-xl px-5 py-2 disabled:opacity-40">
                  {newPostLoading ? "Posting…" : "Post ✦"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-6 flex flex-col" style={{ height:"100vh" }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl tracking-tight text-[#eaeaf2]">Moltbook</h1>
              {statusLabel && <span className="text-[10px] px-2.5 py-0.5 rounded-full border font-medium" style={{ color:statusColor, borderColor:`${statusColor}40`, background:`${statusColor}12` }}>{statusLabel}</span>}
            </div>
            <p className="text-[#3a3a52] text-xs mt-0.5">Social network for AI agents</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs border border-[#1e1e2e] rounded-xl px-4 py-2 bg-[#0c0c14]">
              <span className="text-[#c8a96e]">💬 {stats.comments}</span>
              <span className="text-[#3a3a52]">|</span>
              <span className="text-[#4ecdc4]">+ {stats.follows}</span>
              <span className="text-[#3a3a52]">|</span>
              <span className="text-[#5a5a78]">↻ {stats.cycles}</span>
            </div>
            <button onClick={()=>setNewPostModal(true)} className="text-xs bg-[#c8a96e]/10 hover:bg-[#c8a96e]/20 border border-[#c8a96e]/30 text-[#c8a96e] rounded-lg px-3 py-1.5 transition-all">✦ New Post</button>
            <Link href="/" className="text-xs text-[#5a5a78] hover:text-[#eaeaf2] border border-[#2a2a3d] hover:border-[#3e3e5a] rounded-lg px-3 py-1.5 transition-all">← Chat</Link>
          </div>
        </div>

        {/* ── API Key bar ─────────────────────────────────────── */}
        <div className="flex gap-2 mb-3 flex-shrink-0">
          <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveKey()}
            placeholder="Moltbook API key…"
            className="flex-1 bg-[#0c0c16] border border-[#2a2a3d] focus:border-[#c8a96e]/40 text-[#eaeaf2] text-xs rounded-xl px-4 py-2 outline-none placeholder-[#3a3a52] transition-colors" />
          <button onClick={saveKey} className={bG+" text-xs"}>Save</button>
          <button onClick={testKey} disabled={!savedKey} className={bT+" text-xs"}>Test</button>
        </div>

        {/* ── Message ──────────────────────────────────────────── */}
        {msg && (
          <div className={`mb-3 px-4 py-2 rounded-xl text-xs border flex-shrink-0 ${msg.includes("Error")||msg.includes("error") ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-[#c8a96e]/5 border-[#c8a96e]/15 text-[#c8a96e]"}`}>
            {msg}
          </div>
        )}

        {/* ── Tab bar ──────────────────────────────────────────── */}
        <div className="flex border-b border-[#1a1a28] mb-5 flex-shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>{ setTab(t.id); setMsg("") }}
              className={`text-xs py-2.5 px-4 border-b-2 transition-all font-medium ${tab===t.id ? "border-[#c8a96e] text-[#c8a96e]" : "border-transparent text-[#3a3a52] hover:text-[#6b6b8a]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden min-h-0">

          {/* FEED */}
          {tab==="feed" && (
            <div className="flex flex-col h-full">
              <div className="flex gap-2 mb-4 flex-shrink-0 flex-wrap">
                {(["hot","new","top","rising"] as const).map(s => (
                  <button key={s} onClick={()=>setFeedSort(s)} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${feedSort===s ? "border-[#c8a96e]/50 text-[#c8a96e] bg-[#c8a96e]/10" : "border-[#2a2a3d] text-[#4a4a60] hover:text-[#6b6b8a]"}`}>{s}</button>
                ))}
                <select value={feedLimit} onChange={e=>setFeedLimit(Number(e.target.value))} className="text-xs bg-[#0c0c16] border border-[#2a2a3d] text-[#6b6b8a] rounded-lg px-2 py-1.5 outline-none">
                  {[5,10,15,25].map(n=><option key={n} value={n}>{n} posts</option>)}
                </select>
                <button onClick={loadFeed} disabled={feedLoading||!savedKey} className={bG+" text-xs ml-auto"}>{feedLoading?"Loading…":"Load Feed"}</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {feedPosts.map(post=>(
                  <PostCard key={post.id} post={post} onUpvote={upvotedIds.has(post.id)?undefined:()=>upvotePost(post.id)} commented={commentedIds.has(post.id)} />
                ))}
                {!feedPosts.length&&!feedLoading&&(
                  <div className="text-center py-24">
                    <div className="text-[#1e1e2e] text-5xl mb-4">⬡</div>
                    <p className="text-[#4a4a60] text-sm">Click <span className="text-[#c8a96e]">Load Feed</span> to read posts</p>
                    <p className="text-[#2a2a3d] text-xs mt-1">Make sure your API key is saved above</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AGENTS */}
          {tab==="agents" && (
            <div className="flex gap-4 h-full overflow-hidden">

              {/* Left: Discover sidebar */}
              <div className="w-60 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
                <div className="flex gap-2">
                  <input value={agentSearchQ} onChange={e=>setAgentSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&scanAgents()}
                    placeholder="Filter by name…"
                    className="flex-1 bg-[#0c0c16] border border-[#2a2a3d] focus:border-[#c8a96e]/40 text-[#eaeaf2] text-xs rounded-xl px-3 py-2 outline-none placeholder-[#3a3a52] transition-colors" />
                  <button onClick={scanAgents} disabled={scanLoading||!savedKey} className={bG+" text-xs px-3"}>{scanLoading?"…":"Scan"}</button>
                </div>
                <div className="flex gap-1">
                  {(["hot","new","top","rising"] as const).map(s=>(
                    <button key={s} onClick={()=>setAutoConfig(p=>({...p,sortMode:s}))} className={`flex-1 text-[10px] py-1 rounded-lg border transition-all ${autoConfig.sortMode===s ? "border-[#c8a96e]/50 text-[#c8a96e] bg-[#c8a96e]/10" : "border-[#2a2a3d] text-[#3a3a52] hover:text-[#6b6b8a]"}`}>{s}</button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                  {agents.length===0&&<div className="text-center py-10 text-[#3a3a52] text-xs">Hit Scan to discover agents</div>}
                  {agents.map(agent=>(
                    <button key={agent.name} onClick={()=>loadAgentProfile(agent)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selectedAgent?.name===agent.name ? "border-[#c8a96e]/40 bg-[#c8a96e]/5" : "border-[#2a2a3d] hover:border-[#3e3e5a] bg-[#0e0e18]"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar name={agent.name} size={22} />
                        <span className="text-[#c8a96e] text-xs font-medium truncate">@{agent.name}</span>
                      </div>
                      <p className="text-[#3a3a52] text-[10px] truncate">{agent.latestTitle||"…"}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Center: Agent detail */}
              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                {!selectedAgent&&!openPost&&(
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="text-[#1e1e2e] text-6xl mb-4">◎</div>
                    <p className="text-[#4a4a60] text-sm">Select an agent to view their profile</p>
                    <p className="text-[#2a2a3d] text-xs mt-1">Scan the feed first if no agents appear</p>
                  </div>
                )}

                {selectedAgent&&!openPost&&(
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="border border-[#2a2a3d] bg-[#0e0e18] rounded-2xl p-5 mb-4 flex-shrink-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={selectedAgent.name} size={44} />
                          <div>
                            <h2 className="text-[#eaeaf2] font-medium">@{selectedAgent.name}</h2>
                            <p className="text-[#4a4a60] text-xs mt-0.5">{selectedAgent.description||"AI Agent"}</p>
                          </div>
                        </div>
                        <button onClick={()=>followAgent(selectedAgent.name)} className={bT+" text-xs"}>+ Follow</button>
                      </div>
                      {(selectedAgent.karma!==undefined||selectedAgent.follower_count!==undefined)&&(
                        <div className="flex gap-4 mt-4 text-xs text-[#4a4a60]">
                          {selectedAgent.karma!==undefined&&<span>⭐ {selectedAgent.karma} karma</span>}
                          {selectedAgent.follower_count!==undefined&&<span>👥 {selectedAgent.follower_count}</span>}
                          {selectedAgent.is_active!==undefined&&<span className={selectedAgent.is_active?"text-[#4ecdc4]":"text-[#4a4a60]"}>{selectedAgent.is_active?"● Active":"○ Inactive"}</span>}
                        </div>
                      )}
                    </div>
                    {agentLoading&&<div className="text-[#4a4a60] text-xs text-center py-6">Loading posts…</div>}
                    <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                      {agentPosts.map(post=>(
                        <div key={post.id}>
                          <PostCard post={post} commented={commentedIds.has(post.id)} onOpen={()=>loadFullPost(post)} onComment={()=>generateComment(post)} />
                          {(commentTexts[post.id]!==undefined||commentLoading===post.id)&&(
                            <div className="border border-[#4ecdc4]/20 bg-[#4ecdc4]/5 rounded-xl p-4 mt-1 ml-2">
                              {commentLoading===post.id ? <p className="text-[#4ecdc4]/60 text-xs">Generating comment…</p> : (
                                <>
                                  <textarea value={commentTexts[post.id]} onChange={e=>setCommentTexts(prev=>({...prev,[post.id]:e.target.value}))} rows={3} className="w-full bg-transparent text-[#eaeaf2] text-xs outline-none resize-none mb-2" />
                                  <div className="flex gap-2">
                                    <button onClick={()=>postComment(post.id)} disabled={postCommentLoading===post.id} className={bT+" text-xs"}>{postCommentLoading===post.id?"Posting…":"Post"}</button>
                                    <button onClick={()=>setCommentTexts(prev=>{const n={...prev};delete n[post.id];return n})} className="text-xs text-[#4a4a60] hover:text-[#6b6b8a] transition-colors">Discard</button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {openPost&&(
                  <div className="flex flex-col h-full overflow-hidden">
                    <button onClick={()=>setOpenPost(null)} className="text-xs text-[#4a4a60] hover:text-[#eaeaf2] mb-4 flex items-center gap-1.5 transition-colors flex-shrink-0">← Back</button>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <div className="border border-[#2a2a3d] bg-[#0e0e18] rounded-2xl p-5 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Avatar name={openPost.author?.name||"?"} size={28} />
                          <span className="text-[#c8a96e] text-xs">@{openPost.author?.name}</span>
                          <span className="text-[#2a2a3d] text-xs ml-auto">↑ {openPost.upvotes??0}</span>
                        </div>
                        <h2 className="text-[#eaeaf2] font-medium mb-3">{openPost.title}</h2>
                        <p className="text-[#9a9ab8] text-sm leading-relaxed">{openPost.content}</p>
                      </div>
                      <div className="border border-[#2a2a3d] bg-[#0e0e18] rounded-2xl p-4 mb-4">
                        <p className="text-[#3a3a52] text-[10px] uppercase tracking-widest mb-3">Leave a comment</p>
                        <textarea value={commentTexts[openPost.id]||""} onChange={e=>setCommentTexts(prev=>({...prev,[openPost.id]:e.target.value}))} placeholder="Write a comment…" rows={3} className={ic+" resize-none mb-3"} />
                        <div className="flex gap-2">
                          <button onClick={()=>postComment(openPost.id)} disabled={!commentTexts[openPost.id]?.trim()||postCommentLoading===openPost.id} className={bG+" text-xs"}>{postCommentLoading===openPost.id?"Posting…":"Post"}</button>
                          <button onClick={()=>generateComment(openPost)} disabled={commentLoading===openPost.id} className={bT+" text-xs"}>{commentLoading===openPost.id?"Generating…":"✦ AI Comment"}</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[#3a3a52] text-[10px] uppercase tracking-widest mb-3">Comments{openPost.comments?` (${openPost.comments.length})`:""}</p>
                        {commentsLoading&&<p className="text-[#4a4a60] text-xs">Loading…</p>}
                        {openPost.comments?.map((c,i)=>(
                          <div key={i} className="border-l-2 border-[#2a2a3d] pl-4 mb-3">
                            <span className="text-[#c8a96e] text-xs font-medium">@{c.author?.name}</span>
                            <p className="text-[#9a9ab8] text-xs mt-1">{c.content}</p>
                          </div>
                        ))}
                        {!commentsLoading&&openPost.comments?.length===0&&<p className="text-[#4a4a60] text-xs">No comments yet.</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Autonomous mode */}
              <div className="w-60 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
                <div className="border border-[#2a2a3d] bg-[#0e0e18] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[#eaeaf2] text-xs font-medium">Auto Mode</span>
                    <button onClick={toggleAuto} className={`relative w-10 h-5 rounded-full transition-all ${autoRunning?"bg-[#4ecdc4]/30 border border-[#4ecdc4]/50":"bg-[#141420] border border-[#2a2a3d]"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${autoRunning?"left-5 bg-[#4ecdc4]":"left-0.5 bg-[#3a3a52]"}`} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[#3a3a52] text-[9px] uppercase tracking-widest mb-1.5">Topic Filter</p>
                      <input value={autoConfig.topic} onChange={e=>setAutoConfig(p=>({...p,topic:e.target.value}))} placeholder="e.g. AI, memory…"
                        className="w-full bg-[#0c0c16] border border-[#2a2a3d] text-[#eaeaf2] text-xs rounded-lg px-3 py-2 outline-none placeholder-[#3a3a52] focus:border-[#c8a96e]/30 transition-colors" />
                    </div>
                    <div>
                      <p className="text-[#3a3a52] text-[9px] uppercase tracking-widest mb-1.5">Action</p>
                      <select value={autoConfig.action} onChange={e=>setAutoConfig(p=>({...p,action:e.target.value as any}))} className="w-full bg-[#0c0c16] border border-[#2a2a3d] text-[#eaeaf2] text-xs rounded-lg px-3 py-2 outline-none">
                        <option value="comment">Comment only</option>
                        <option value="follow">Follow only</option>
                        <option value="both">Comment + Follow</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[#3a3a52] text-[9px] uppercase tracking-widest mb-1.5">Interval (min)</p>
                        <input type="number" min={1} value={autoConfig.interval} onChange={e=>setAutoConfig(p=>({...p,interval:Number(e.target.value)}))} className="w-full bg-[#0c0c16] border border-[#2a2a3d] text-[#eaeaf2] text-xs rounded-lg px-3 py-2 outline-none" />
                      </div>
                      <div>
                        <p className="text-[#3a3a52] text-[9px] uppercase tracking-widest mb-1.5">Max / Cycle</p>
                        <input type="number" min={1} max={10} value={autoConfig.maxPerCycle} onChange={e=>setAutoConfig(p=>({...p,maxPerCycle:Number(e.target.value)}))} className="w-full bg-[#0c0c16] border border-[#2a2a3d] text-[#eaeaf2] text-xs rounded-lg px-3 py-2 outline-none" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer" onClick={()=>setAutoConfig(p=>({...p,avoidDuplicates:!p.avoidDuplicates}))}>
                      <div className={`relative w-8 h-4 rounded-full transition-all ${autoConfig.avoidDuplicates?"bg-[#4ecdc4]/30 border border-[#4ecdc4]/50":"bg-[#141420] border border-[#2a2a3d]"}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${autoConfig.avoidDuplicates?"left-4 bg-[#4ecdc4]":"left-0.5 bg-[#3a3a52]"}`} />
                      </div>
                      <span className="text-[#5a5a78] text-[10px]">Skip already commented</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1a1a28] text-center">
                    {([["💬",stats.comments,"commented"],["+",stats.follows,"followed"],["↻",stats.cycles,"cycles"]] as const).map(([icon,val,label])=>(
                      <div key={label}>
                        <div className="text-sm font-semibold text-[#eaeaf2]">{icon} {val}</div>
                        <div className="text-[#3a3a52] text-[9px]">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Log */}
                <div className="border border-[#2a2a3d] bg-[#0e0e18] rounded-2xl flex flex-col flex-1 min-h-0" style={{ maxHeight: "320px" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a28]">
                    <span className="text-[#5a5a78] text-xs font-medium">Activity Log</span>
                    <button onClick={()=>setLog([])} className="text-[10px] text-[#2a2a3d] hover:text-[#5a5a78] transition-colors">Clear</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {log.length===0&&<p className="text-[#2a2a3d] text-[10px] text-center py-4">No activity yet</p>}
                    {log.map(entry=>(
                      <div key={entry.id} className="flex gap-2">
                        <span className="text-[10px] font-mono flex-shrink-0 mt-0.5" style={{ color:LOG_COLORS[entry.type] }}>{LOG_ICONS[entry.type]}</span>
                        <div className="min-w-0">
                          {entry.agent&&<span className="text-[#c8a96e] text-[10px]">@{entry.agent} </span>}
                          <span className="text-[#5a5a78] text-[10px] leading-relaxed break-words">{entry.detail}</span>
                          <div className="text-[#2a2a3d] text-[9px]">{entry.ts.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* POST */}
          {tab==="post"&&(
            <div className="max-w-xl">
              <div className="flex flex-col gap-3">
                <input value={postSubmolt} onChange={e=>setPostSubmolt(e.target.value)} placeholder="Submolt (e.g. general)" className={ic} />
                <input value={postTitle} onChange={e=>setPostTitle(e.target.value)} placeholder="Title" className={ic} />
                <textarea value={postContent} onChange={e=>setPostContent(e.target.value)} placeholder="Content…" rows={7} className={ic+" resize-none"} />
                <button onClick={handlePost} disabled={postLoading||!savedKey} className="bg-gradient-to-r from-[#c8a96e] to-[#9a7840] text-[#07070f] text-sm font-semibold rounded-xl px-5 py-2.5 disabled:opacity-40 self-start">
                  {postLoading?"Posting…":"🚀 Post to Moltbook"}
                </button>
              </div>
            </div>
          )}

          {/* SEARCH */}
          {tab==="search"&&(
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} placeholder="Search Moltbook…" className={ic} />
                <button onClick={handleSearch} disabled={searchLoading||!savedKey} className={bG+" shrink-0"}>{searchLoading?"…":"Search"}</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {searchResults.map((item,i)=><PostCard key={i} post={item} />)}
                {!searchResults.length&&!searchLoading&&<div className="text-center py-20 text-[#4a4a60] text-sm">Enter a query and press Search</div>}
              </div>
            </div>
          )}

          {/* PROFILE */}
          {tab==="profile"&&(
            <div className="max-w-md">
              <button onClick={loadProfile} disabled={profileLoading||!savedKey} className={bG+" mb-5"}>{profileLoading?"Loading…":profile?"↻ Refresh":"Load My Profile"}</button>
              {profile&&(
                <div className="border border-[#2a2a3d] bg-[#0e0e18] rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <Avatar name={profile.name} size={52} />
                    <div>
                      <h2 className="text-[#eaeaf2] font-medium text-lg">@{profile.name}</h2>
                      <p className="text-[#5a5a78] text-xs mt-0.5">{profile.description||<span className="italic text-[#3a3a52]">No description</span>}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                    {([["⭐",profile.karma??0,"karma"],["👥",profile.follower_count??0,"followers"],["👣",profile.following_count??0,"following"]] as const).map(([icon,val,label])=>(
                      <div key={label} className="bg-[#0c0c16] border border-[#2a2a3d] rounded-xl py-3">
                        <div className="text-[#eaeaf2] font-semibold">{icon} {val}</div>
                        <div className="text-[#3a3a52] text-[10px]">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs mb-4">
                    <span className={profile.is_claimed?"text-[#4ecdc4]":"text-[#4a4a60]"}>{profile.is_claimed?"✅ Claimed":"⏳ Pending"}</span>
                    <span className={profile.is_active?"text-[#4ecdc4]":"text-[#4a4a60]"}>{profile.is_active?"● Active":"○ Inactive"}</span>
                  </div>
                  {profile.owner?.x_handle&&(
                    <div className="flex items-center gap-2 pt-4 border-t border-[#1a1a28]">
                      {profile.owner.x_avatar&&<img src={profile.owner.x_avatar} alt="" className="w-7 h-7 rounded-full" />}
                      <span className="text-[#5a5a78] text-xs">Owned by <span className="text-[#eaeaf2]">@{profile.owner.x_handle}</span></span>
                    </div>
                  )}
                  <a href={`https://www.moltbook.com/u/${profile.name}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-xs text-[#4ecdc4] hover:underline">View on Moltbook ↗</a>
                </div>
              )}
            </div>
          )}

          {/* REGISTER */}
          {tab==="register"&&(
            <div className="max-w-md">
              <p className="text-[#5a5a78] text-sm mb-5">Create a new agent on Moltbook to get your API key.</p>
              <div className="flex flex-col gap-3">
                <input value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Agent name" className={ic} />
                <textarea value={regDesc} onChange={e=>setRegDesc(e.target.value)} placeholder="Description" rows={3} className={ic+" resize-none"} />
                <button onClick={handleRegister} disabled={regLoading} className="bg-gradient-to-r from-[#c8a96e] to-[#9a7840] text-[#07070f] text-sm font-semibold rounded-xl px-5 py-2.5 disabled:opacity-40 self-start">
                  {regLoading?"Registering…":"🚀 Register Agent"}
                </button>
              </div>
              {regResult?.agent&&(
                <div className="mt-5 border border-[#4ecdc4]/30 bg-[#4ecdc4]/5 rounded-2xl p-5">
                  <p className="text-[#4ecdc4] text-sm font-medium mb-3">✅ Registered!</p>
                  <p className="text-[#5a5a78] text-xs mb-2">Your API Key:</p>
                  <code className="text-[#4ecdc4] text-xs break-all block bg-[#0c0c16] border border-[#2a2a3d] rounded-xl px-4 py-3">{regResult.agent.api_key}</code>
                  <p className="text-[#3a3a52] text-xs mt-3">Paste this into the API key bar above and click Save.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
