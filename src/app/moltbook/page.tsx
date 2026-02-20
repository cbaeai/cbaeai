"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { PostCard } from "@/components/moltbook/PostCard"
import * as mb from "@/lib/moltbook"

type Tab = "feed" | "post" | "search" | "profile" | "register"

export default function MoltbookPage() {
  const [apiKey, setApiKey]       = useState("")
  const [savedKey, setSavedKey]   = useState("")
  const [tab, setTab]             = useState<Tab>("feed")
  const [status, setStatus]       = useState<string>("")
  const [posts, setPosts]         = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [sort, setSort]           = useState("hot")
  const [limit, setLimit]         = useState(10)
  const [msg, setMsg]             = useState("")

  // Post form
  const [submolt, setSubmolt]     = useState("general")
  const [postTitle, setPostTitle] = useState("")
  const [postContent, setPostContent] = useState("")

  // Search
  const [searchQ, setSearchQ]     = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Profile
  const [profile, setProfile]     = useState<any>(null)

  // Register
  const [regName, setRegName]     = useState("Cbae")
  const [regDesc, setRegDesc]     = useState("Autonomous AI assistant built with FastAPI and Next.js")
  const [regResult, setRegResult] = useState<any>(null)

  useEffect(() => {
    const k = localStorage.getItem("moltbook_key") || ""
    setSavedKey(k)
    setApiKey(k)
    if (k) checkStatus(k)
  }, [])

  const saveKey = () => {
    localStorage.setItem("moltbook_key", apiKey)
    setSavedKey(apiKey)
    checkStatus(apiKey)
  }

  const checkStatus = async (key: string) => {
    try {
      const r = await mb.mbStatus(key)
      setStatus(r.status || "unknown")
    } catch { setStatus("error") }
  }

  const loadFeed = async () => {
    setLoading(true); setMsg("")
    try {
      const data = await mb.mbGetFeed(savedKey, sort, limit)
      setPosts(data.posts || data.data?.posts || [])
    } catch (e: any) { setMsg(`Error: ${e.message}`) }
    setLoading(false)
  }

  const handleUpvote = async (postId: string) => {
    await mb.mbUpvote(savedKey, postId)
    setMsg("Upvoted! ⬆️")
  }

  const handleReply = async (post: any) => {
    setLoading(true)
    const reply = `Interesting perspective on "${post.title}". Thanks for sharing!`
    const r = await mb.mbComment(savedKey, post.id, reply)
    setMsg(r.success ? "✅ Reply posted!" : `Failed: ${r.error}`)
    setLoading(false)
  }

  const handlePost = async () => {
    if (!postTitle || !postContent) { setMsg("Fill in title and content"); return }
    setLoading(true)
    const r = await mb.mbCreatePost(savedKey, submolt, postTitle, postContent)
    setMsg(r.success ? "✅ Posted!" : `Failed: ${r.error} — ${r.hint || ""}`)
    if (r.success) { setPostTitle(""); setPostContent("") }
    setLoading(false)
  }

  const handleSearch = async () => {
    if (!searchQ) return
    setLoading(true)
    const r = await mb.mbSearch(savedKey, searchQ)
    setSearchResults(r.results || [])
    setLoading(false)
  }

  const loadProfile = async () => {
    setLoading(true)
    const r = await mb.mbGetMe(savedKey)
    setProfile(r.agent || r.data?.agent)
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true)
    const r = await mb.mbRegister(regName, regDesc)
    setRegResult(r)
    setLoading(false)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "feed",     label: "📰 Feed" },
    { id: "post",     label: "✍️ Post" },
    { id: "search",   label: "🔍 Search" },
    { id: "profile",  label: "👤 Profile" },
    { id: "register", label: "🚀 Register" },
  ]

  return (
    <div className="flex flex-col h-screen bg-ink">
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(200,169,110,0.05) 0%, transparent 55%)" }} />

      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rim">
          <div>
            <h1 className="font-serif text-2xl text-text1 tracking-tight">Moltbook</h1>
            <p className="text-fog text-xs mt-0.5">Social network for AI agents</p>
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <span className={`text-xs px-3 py-1 rounded-full border ${
                status === "claimed" ? "text-teal border-teal/30 bg-teal/5" :
                status === "pending_claim" ? "text-gold border-gold/30 bg-gold/5" :
                "text-fog border-rim"}`}>
                {status === "claimed" ? "✅ Live" : status === "pending_claim" ? "⏳ Pending" : status}
              </span>
            )}
            <Link href="/" className="text-xs text-fog hover:text-mist border border-rim hover:border-rim2 rounded-lg px-3 py-1.5 transition-colors">
              ← Chat
            </Link>
          </div>
        </div>

        {/* API Key bar */}
        <div className="flex gap-2 px-6 py-3 border-b border-rim bg-ink2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Moltbook API key…"
            className="flex-1 bg-ink3 border border-rim text-text1 text-xs rounded-lg px-3 py-2 outline-none focus:border-gold/50"
          />
          <button onClick={saveKey}
            className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-2 hover:bg-gold/20 transition-colors">
            Save
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-rim px-6">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-xs py-3 px-4 border-b-2 transition-colors ${
                tab === t.id ? "border-gold text-gold" : "border-transparent text-fog hover:text-text2"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {msg && (
            <div className="bg-ink2 border border-rim rounded-lg px-4 py-2 text-text2 text-sm mb-4">{msg}</div>
          )}

          {/* FEED */}
          {tab === "feed" && (
            <div>
              <div className="flex gap-2 mb-4">
                <select value={sort} onChange={(e) => setSort(e.target.value)}
                  className="text-xs bg-ink3 border border-rim text-text1 rounded-lg px-2 py-1.5 outline-none">
                  {["hot","new","top","rising"].map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                  className="text-xs bg-ink3 border border-rim text-text1 rounded-lg px-2 py-1.5 outline-none">
                  {[5,10,15,25].map(n => <option key={n}>{n}</option>)}
                </select>
                <button onClick={loadFeed} disabled={loading || !savedKey}
                  className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-1.5 hover:bg-gold/20 disabled:opacity-40 transition-colors">
                  {loading ? "Loading…" : "Load Feed"}
                </button>
              </div>
              {posts.map((post) => (
                <PostCard key={post.id} post={post}
                  onUpvote={() => handleUpvote(post.id)}
                  onReply={() => handleReply(post)} />
              ))}
              {posts.length === 0 && !loading && (
                <p className="text-fog text-sm text-center py-8">Click "Load Feed" to read posts</p>
              )}
            </div>
          )}

          {/* POST */}
          {tab === "post" && (
            <div className="flex flex-col gap-3 max-w-lg">
              <input value={submolt} onChange={(e) => setSubmolt(e.target.value)}
                placeholder="Submolt (e.g. general)"
                className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
              <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Title"
                className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
              <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)}
                placeholder="Content…" rows={5}
                className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50 resize-none" />
              <button onClick={handlePost} disabled={loading || !savedKey}
                className="bg-gradient-to-r from-gold to-amber-700 text-ink text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-40">
                {loading ? "Posting…" : "🚀 Post to Moltbook"}
              </button>
            </div>
          )}

          {/* SEARCH */}
          {tab === "search" && (
            <div>
              <div className="flex gap-2 mb-4">
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search Moltbook…"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
                <button onClick={handleSearch} disabled={loading || !savedKey}
                  className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-2 hover:bg-gold/20 disabled:opacity-40">
                  Search
                </button>
              </div>
              {searchResults.map((item, i) => (
                <PostCard key={i} post={item} />
              ))}
            </div>
          )}

          {/* PROFILE */}
          {tab === "profile" && (
            <div>
              <button onClick={loadProfile} disabled={loading || !savedKey}
                className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-2 hover:bg-gold/20 disabled:opacity-40 mb-4">
                Load Profile
              </button>
              {profile && (
                <div className="bg-ink2 border border-rim rounded-xl p-5">
                  <div className="text-gold font-semibold text-lg mb-1">@{profile.name}</div>
                  <p className="text-text2 text-sm mb-3">{profile.description}</p>
                  <div className="flex gap-4 text-xs text-fog">
                    <span>⭐ {profile.karma || 0} karma</span>
                    <span>👥 {profile.follower_count || 0} followers</span>
                    <span>👣 {profile.following_count || 0} following</span>
                    <span>{profile.is_claimed ? "✅ Claimed" : "⏳ Pending"}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REGISTER */}
          {tab === "register" && (
            <div className="flex flex-col gap-3 max-w-lg">
              <p className="text-text2 text-sm">Register a new agent on Moltbook to get an API key.</p>
              <input value={regName} onChange={(e) => setRegName(e.target.value)}
                placeholder="Agent name"
                className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
              <textarea value={regDesc} onChange={(e) => setRegDesc(e.target.value)}
                placeholder="Description" rows={3}
                className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50 resize-none" />
              <button onClick={handleRegister} disabled={loading}
                className="bg-gradient-to-r from-gold to-amber-700 text-ink text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-40">
                {loading ? "Registering…" : "🚀 Register Agent"}
              </button>
              {regResult?.agent && (
                <div className="bg-ink2 border border-teal/30 rounded-xl p-4 mt-2">
                  <p className="text-teal text-sm font-medium mb-2">✅ Registered!</p>
                  <p className="text-text2 text-xs mb-1">API Key:</p>
                  <code className="text-teal text-xs break-all">{regResult.agent.api_key}</code>
                  <p className="text-fog text-xs mt-2">Copy this key into the API key bar above and save it.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
