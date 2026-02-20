"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { PostCard } from "@/components/moltbook/PostCard"

type Tab = "feed" | "post" | "search" | "profile" | "register"

const MB = "https://www.moltbook.com/api/v1"

// Call Moltbook API directly from the browser — no server proxy
async function callMB(key: string, path: string, method = "GET", body?: object) {
  try {
    const res = await fetch(`${MB}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return await res.json()
  } catch (e: any) {
    return { error: e?.message || "Request failed" }
  }
}

export default function MoltbookPage() {
  const [apiKey, setApiKey]     = useState("")
  const [savedKey, setSavedKey] = useState("")
  const [tab, setTab]           = useState<Tab>("feed")
  const [status, setStatus]     = useState("")
  const [posts, setPosts]       = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState("")
  const [sort, setSort]         = useState("hot")
  const [limit, setLimit]       = useState(10)
  const [submolt, setSubmolt]   = useState("general")
  const [postTitle, setPostTitle]     = useState("")
  const [postContent, setPostContent] = useState("")
  const [searchQ, setSearchQ]         = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [profile, setProfile]   = useState<any>(null)
  const [regName, setRegName]   = useState("Cbae")
  const [regDesc, setRegDesc]   = useState("Autonomous AI assistant")
  const [regResult, setRegResult] = useState<any>(null)

  useEffect(() => {
    const k = localStorage.getItem("mb_key") || ""
    if (k) { setApiKey(k); setSavedKey(k); setStatus("saved") }
  }, [])

  useEffect(() => {
    if (tab === "profile" && savedKey && !profile) loadProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, savedKey])

  const saveKey = () => {
    const k = apiKey.trim()
    if (!k) { setMsg("Enter your API key first"); return }
    localStorage.setItem("mb_key", k)
    setSavedKey(k); setStatus("saved"); setMsg("Key saved!")
  }

  const testKey = async () => {
    if (!savedKey) { setMsg("Save your API key first"); return }
    setLoading(true); setMsg("Testing…")
    const r = await callMB(savedKey, "/agents/status")
    setLoading(false)
    if (r.error) { setMsg(`Error: ${r.error}`); setStatus("error"); return }
    const s = r.status || "unknown"
    setStatus(s)
    setMsg(s === "claimed" ? "✅ Agent is live!" : s === "pending_claim" ? "⏳ Pending claim" : `Status: ${JSON.stringify(r)}`)
  }

  const loadFeed = async () => {
    if (!savedKey) { setMsg("Save your API key first"); return }
    setLoading(true); setMsg(""); setPosts([])
    const data = await callMB(savedKey, `/feed?sort=${sort}&limit=${limit}`)
    setLoading(false)
    if (data.error) { setMsg(`Error: ${data.error}`); return }
    const p = data.posts || data.data?.posts || []
    setPosts(p)
    if (!p.length) setMsg("No posts found. Try sort: new")
  }

  const handleUpvote = async (postId: string) => {
    const r = await callMB(savedKey, `/posts/${postId}/upvote`, "POST")
    setMsg(r.error ? `Error: ${r.error}` : "Upvoted! 🦞")
  }

  const handleReply = async (post: any) => {
    setLoading(true)
    const r = await callMB(savedKey, `/posts/${post.id}/comments`, "POST", { content: `Interesting thoughts on "${post.title}". Thanks for sharing!` })
    setLoading(false)
    setMsg(r.error ? `Error: ${r.error}` : "Reply posted!")
  }

  const handlePost = async () => {
    if (!postTitle || !postContent) { setMsg("Fill in title and content"); return }
    setLoading(true)
    const r = await callMB(savedKey, "/posts", "POST", { submolt, title: postTitle, content: postContent })
    setLoading(false)
    if (r.error) { setMsg(`Error: ${r.error}`); return }
    setMsg("Posted! 🦞"); setPostTitle(""); setPostContent("")
  }

  const handleSearch = async () => {
    if (!searchQ) return
    setLoading(true)
    const r = await callMB(savedKey, `/search?q=${encodeURIComponent(searchQ)}&type=all&limit=10`)
    setLoading(false)
    setSearchResults(r.results || [])
    if (!r.results?.length) setMsg("No results found")
  }

  const loadProfile = async () => {
    const key = savedKey || apiKey.trim()
    if (!key) { setMsg("Save your API key first"); return }
    setLoading(true); setMsg("")
    const r = await callMB(key, "/agents/me")
    setLoading(false)
    if (r.error) { setMsg(`Error: ${r.error}`); return }
    const agent = r.agent ?? r.data?.agent ?? (r.success === false ? null : r)
    if (!agent || typeof agent !== "object" || !agent.name) {
      setMsg(`Unexpected response: ${JSON.stringify(r).slice(0, 200)}`); return
    }
    setProfile(agent); setStatus("claimed")
  }

  const handleRegister = async () => {
    setLoading(true); setMsg("Registering…")
    // Register doesn't need an API key
    try {
      const res = await fetch(`${MB}/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, description: regDesc }),
      })
      const r = await res.json()
      setLoading(false)
      if (r.error) { setMsg(`Error: ${r.error}`); return }
      setRegResult(r)
    } catch (e: any) {
      setLoading(false); setMsg(`Error: ${e?.message}`)
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "feed", label: "📰 Feed" },
    { id: "post", label: "✍️ Post" },
    { id: "search", label: "🔍 Search" },
    { id: "profile", label: "👤 Profile" },
    { id: "register", label: "🚀 Register" },
  ]

  const statusColor = status === "claimed" ? "text-teal border-teal/30 bg-teal/5"
    : status === "pending_claim" ? "text-gold border-gold/30 bg-gold/5"
    : status === "error" ? "text-red-400 border-red-400/30"
    : "text-mist border-rim"

  const statusLabel = status === "claimed" ? "Live"
    : status === "pending_claim" ? "Pending"
    : status === "saved" ? "Key saved"
    : status === "error" ? "Error"
    : status

  return (
    <div className="flex flex-col h-screen bg-ink">
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(200,169,110,0.05) 0%, transparent 55%)" }} />
      <div className="relative z-10 flex flex-col h-full max-w-3xl mx-auto w-full">

        <div className="flex items-center justify-between px-6 py-4 border-b border-rim">
          <div>
            <h1 className="font-serif text-2xl text-text1 tracking-tight">Moltbook</h1>
            <p className="text-fog text-xs mt-0.5">Social network for AI agents</p>
          </div>
          <div className="flex items-center gap-3">
            {status && <span className={`text-xs px-3 py-1 rounded-full border ${statusColor}`}>{statusLabel}</span>}
            <Link href="/" className="text-xs text-fog hover:text-mist border border-rim rounded-lg px-3 py-1.5 transition-colors">← Chat</Link>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-3 border-b border-rim bg-ink2">
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your Moltbook API key…"
            onKeyDown={e => e.key === "Enter" && saveKey()}
            className="flex-1 bg-ink3 border border-rim text-text1 text-xs rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
          <button onClick={saveKey} className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-3 py-2 hover:bg-gold/20 transition-colors">Save</button>
          <button onClick={testKey} disabled={loading || !savedKey} className="text-xs bg-teal/10 border border-teal/30 text-teal rounded-lg px-3 py-2 hover:bg-teal/20 disabled:opacity-40 transition-colors">Test</button>
        </div>

        {msg && (
          <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-sm border ${
            msg.includes("Error") ? "bg-red-500/5 border-red-500/20 text-red-400"
            : msg.includes("✅") || msg.includes("Posted") || msg.includes("saved") || msg.includes("live") || msg.includes("Upvoted")
              ? "bg-teal/5 border-teal/20 text-teal"
            : "bg-ink2 border-rim text-text2"}`}>
            {msg}
          </div>
        )}

        <div className="flex border-b border-rim px-6 mt-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setMsg("") }}
              className={`text-xs py-3 px-4 border-b-2 transition-colors ${tab === t.id ? "border-gold text-gold" : "border-transparent text-fog hover:text-text2"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">

          {tab === "feed" && (
            <div>
              <div className="flex gap-2 mb-4">
                <select value={sort} onChange={e => setSort(e.target.value)} className="text-xs bg-ink3 border border-rim text-text1 rounded-lg px-2 py-1.5 outline-none">
                  {["hot","new","top","rising"].map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="text-xs bg-ink3 border border-rim text-text1 rounded-lg px-2 py-1.5 outline-none">
                  {[5,10,15,25].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={loadFeed} disabled={loading || !savedKey} className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-1.5 hover:bg-gold/20 disabled:opacity-40 transition-colors">
                  {loading ? "Loading…" : "Load Feed"}
                </button>
              </div>
              {posts.map(post => <PostCard key={post.id} post={post} onUpvote={() => handleUpvote(post.id)} onReply={() => handleReply(post)} />)}
              {!posts.length && !loading && !msg && (
                <div className="text-center py-12">
                  <p className="text-fog text-sm">Click <span className="text-gold">Load Feed</span> to read posts</p>
                  <p className="text-fog/50 text-xs mt-1">Make sure your API key is saved above</p>
                </div>
              )}
            </div>
          )}

          {tab === "post" && (
            <div className="flex flex-col gap-3 max-w-lg">
              <input value={submolt} onChange={e => setSubmolt(e.target.value)} placeholder="Submolt (e.g. general)" className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
              <input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Title" className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
              <textarea value={postContent} onChange={e => setPostContent(e.target.value)} placeholder="Content…" rows={5} className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50 resize-none" />
              <button onClick={handlePost} disabled={loading || !savedKey} className="bg-gradient-to-r from-gold to-amber-700 text-ink text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-40">
                {loading ? "Posting…" : "🚀 Post to Moltbook"}
              </button>
            </div>
          )}

          {tab === "search" && (
            <div>
              <div className="flex gap-2 mb-4">
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search Moltbook…" onKeyDown={e => e.key === "Enter" && handleSearch()} className="flex-1 bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
                <button onClick={handleSearch} disabled={loading || !savedKey} className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-2 hover:bg-gold/20 disabled:opacity-40">{loading ? "…" : "Search"}</button>
              </div>
              {searchResults.map((item, i) => <PostCard key={i} post={item} />)}
            </div>
          )}

          {tab === "profile" && (
            <div>
              <button onClick={loadProfile} disabled={loading || (!savedKey && !apiKey.trim())} className="text-xs bg-gold/10 border border-gold/30 text-gold rounded-lg px-4 py-2 hover:bg-gold/20 disabled:opacity-40 mb-4">
                {loading ? "Loading…" : profile ? "↻ Refresh" : "Load My Profile"}
              </button>
              {profile && (
                <div className="bg-ink2 border border-rim rounded-xl p-5">
                  <div className="text-gold font-semibold text-lg mb-1">@{profile.name}</div>
                  <p className="text-text2 text-sm mb-3">{profile.description || profile.bio || <span className="text-fog italic">No description</span>}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-fog mb-3">
                    <span>⭐ {profile.karma ?? 0} karma</span>
                    <span>👥 {profile.follower_count ?? 0} followers</span>
                    <span>👣 {profile.following_count ?? 0} following</span>
                    <span>{profile.is_claimed ? "✅ Claimed" : "⏳ Pending"}</span>
                    <span>{profile.is_active ? "🟢 Active" : "⚪ Inactive"}</span>
                  </div>
                  {profile.owner?.x_handle && (
                    <div className="flex items-center gap-2 mt-2 pt-3 border-t border-rim">
                      {profile.owner.x_avatar && <img src={profile.owner.x_avatar} alt="" className="w-7 h-7 rounded-full" />}
                      <span className="text-xs text-fog">Owned by <span className="text-text2">@{profile.owner.x_handle}</span></span>
                    </div>
                  )}
                  <a href={`https://www.moltbook.com/u/${profile.name}`} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-3 text-xs text-teal hover:underline">View on Moltbook ↗</a>
                </div>
              )}
            </div>
          )}

          {tab === "register" && (
            <div className="flex flex-col gap-3 max-w-lg">
              <p className="text-text2 text-sm">Create a new agent on Moltbook to get an API key.</p>
              <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Agent name" className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
              <textarea value={regDesc} onChange={e => setRegDesc(e.target.value)} placeholder="Description" rows={3} className="bg-ink3 border border-rim text-text1 text-sm rounded-lg px-3 py-2 outline-none focus:border-gold/50 resize-none" />
              <button onClick={handleRegister} disabled={loading} className="bg-gradient-to-r from-gold to-amber-700 text-ink text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-40">
                {loading ? "Registering…" : "🚀 Register Agent"}
              </button>
              {regResult?.agent && (
                <div className="bg-ink2 border border-teal/30 rounded-xl p-4 mt-2">
                  <p className="text-teal text-sm font-medium mb-2">✅ Registered!</p>
                  <p className="text-text2 text-xs mb-1">Your API Key:</p>
                  <code className="text-teal text-xs break-all block bg-ink3 p-2 rounded">{regResult.agent.api_key}</code>
                  <p className="text-fog text-xs mt-2">Copy this key into the API key bar above and click Save.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
