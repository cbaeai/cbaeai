"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

type Tab = "feed" | "post" | "search" | "profile" | "register" | "agents"
type SortMode = "hot" | "new" | "top" | "rising"
type Comment = { id: string; content: string; author: { name: string }; created_at?: string }
type Post = { id: string; title: string; content: string; upvotes: number; author: { name: string }; submolt?: { name: string }; comment_count?: number; comments?: Comment[]; created_at?: string }
type Agent = { name: string; posts?: number; upvotes?: number; latestTitle?: string; allPostIds?: string[]; description?: string; karma?: number; follower_count?: number; following_count?: number; is_active?: boolean }
type LogEntry = { id: string; ts: Date; type: string; agent?: string; detail: string }
type AutoConfig = { action: "comment"|"follow"|"both"; topic: string; interval: number; maxPerCycle: number; avoidDuplicates: boolean; sortMode: SortMode }
type SessionStats = { comments: number; follows: number; reads: number; posts: number; cycles: number }

async function mbFetch(key: string, path: string, method = "GET", body?: object): Promise<any> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://www.moltbook.com/api/v1${path}`, {
        method, headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000),
      })
      return await res.json()
    } catch (e: any) {
      if (attempt === 2) return { error: e?.name === "TimeoutError" ? "Request timed out" : (e?.message || "Network error") }
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
    }
  }
}

async function streamChat(prompt: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, history: [], agent_mode: false, model: "openai/gpt-4o-mini" }),
  })
  if (!res.body) return ""
  const reader = res.body.getReader(); const decoder = new TextDecoder()
  let result = "", buf = ""
  while (true) {
    const { done, value } = await reader.read(); if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n"); buf = lines.pop() || ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      try { const d = JSON.parse(line.slice(6)); if (d.type === "token") result += d.content } catch {}
    }
  }
  return result.trim()
}

function timeAgo(d?: string) {
  if (!d) return ""; const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"; if (m < 60) return `${m}m`; const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`
}

function Av({ n, s = 32 }: { n: string; s?: number }) {
  const c = ["#e85d04","#f48c06","#dc2f02","#9d0208","#6a040f"][n.charCodeAt(0) % 5]
  return <div style={{ width:s, height:s, background:c, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:s*.38, fontWeight:700, color:"#fff", flexShrink:0 }}>{n.slice(0,2).toUpperCase()}</div>
}

function VoteCol({ count, voted, onUp }: { count:number; voted?:boolean; onUp?:()=>void }) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-8 flex-shrink-0">
      <button onClick={e=>{e.stopPropagation();onUp?.()}} className={`text-lg leading-none transition-colors ${voted?"text-[#e85d04]":"text-[#818384] hover:text-[#e85d04]"}`}>▲</button>
      <span className={`text-xs font-bold ${voted?"text-[#e85d04]":"text-[#818384]"}`}>{count}</span>
      <button className="text-lg leading-none text-[#818384] hover:text-[#6a5cff] transition-colors">▼</button>
    </div>
  )
}

function Card({ post, voted, onVote, onOpen }: { post:Post; voted?:boolean; onVote?:()=>void; onOpen?:()=>void }) {
  return (
    <div onClick={onOpen} className="flex gap-3 bg-[#1a1a1b] hover:bg-[#222] border border-[#343536] hover:border-[#818384] rounded-md p-3 transition-all cursor-pointer">
      <VoteCol count={post.upvotes??0} voted={voted} onUp={onVote} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1 text-xs text-[#818384] mb-1.5">
          {post.submolt?.name && <><span className="font-bold text-[#d7dadc]">m/{post.submolt.name}</span><span>•</span></>}
          <span>Posted by</span><span className="text-[#d7dadc]">u/{post.author?.name}</span>
          {post.created_at && <span>{timeAgo(post.created_at)}</span>}
        </div>
        <h3 className="text-[#d7dadc] text-sm font-medium mb-1.5">{post.title}</h3>
        {post.content && <p className="text-[#818384] text-xs line-clamp-2">{post.content}</p>}
        <div className="flex gap-3 mt-2">
          <span className="text-xs text-[#818384]">💬 {post.comment_count??0} comments</span>
          <span className="text-xs text-[#818384] hover:text-[#d7dadc] cursor-pointer">🔗 Share</span>
        </div>
      </div>
    </div>
  )
}

function PostDetail({ post, savedKey, onBack, onCommented }: { post:Post; savedKey:string; onBack:()=>void; onCommented:(id:string)=>void }) {
  const [comments, setComments] = useState<Comment[]>(post.comments||[])
  const [loading, setLoading] = useState(!post.comments)
  const [text, setText] = useState(""); const [posting, setPosting] = useState(false)
  const [aiGen, setAiGen] = useState(false); const [voted, setVoted] = useState(false)
  const [votes, setVotes] = useState(post.upvotes??0); const [err, setErr] = useState("")

  useEffect(() => {
    if (post.comments) return
    setLoading(true)
    mbFetch(savedKey, `/posts/${post.id}/comments?limit=50`).then(d => { setLoading(false); if (!d.error) setComments(d.comments||[]) })
  }, [post.id])

  return (
    <div>
      <button onClick={onBack} className="text-xs text-[#818384] hover:text-[#d7dadc] mb-4 flex items-center gap-1 transition-colors">← Back</button>
      <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-4 mb-3">
        <div className="flex gap-3">
          <VoteCol count={votes} voted={voted} onUp={async()=>{ if(voted)return; setVoted(true);setVotes(v=>v+1); await mbFetch(savedKey,`/posts/${post.id}/upvote`,"POST") }} />
          <div>
            <div className="flex flex-wrap gap-1 text-xs text-[#818384] mb-2">
              {post.submolt?.name&&<><span className="text-[#d7dadc] font-bold">m/{post.submolt.name}</span><span>•</span></>}
              <span>u/{post.author?.name}</span>
              {post.created_at&&<span>{timeAgo(post.created_at)}</span>}
            </div>
            <h1 className="text-[#d7dadc] text-lg font-semibold mb-3">{post.title}</h1>
            <p className="text-[#d7dadc] text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
          </div>
        </div>
      </div>

      {savedKey && (
        <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-4 mb-3">
          <p className="text-xs text-[#818384] mb-2">Comment as your agent</p>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What are your thoughts?" rows={4}
            className="w-full bg-[#272729] border border-[#343536] focus:border-[#818384] text-[#d7dadc] text-sm rounded px-3 py-2 outline-none resize-none mb-2 placeholder-[#5a5a5a] transition-colors" />
          {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={async()=>{ setAiGen(true); const t=await streamChat(`Write a thoughtful 1-2 sentence comment on: "${post.title}"\n${(post.content||"").slice(0,400)}\nONLY the comment text.`); setText(t); setAiGen(false) }} disabled={aiGen} className="text-xs border border-[#343536] hover:border-[#818384] text-[#818384] hover:text-[#d7dadc] px-3 py-1.5 rounded-full transition-all disabled:opacity-40">
              {aiGen?"Generating…":"✦ AI Comment"}
            </button>
            <button onClick={async()=>{ if(!text.trim())return; setPosting(true); const d=await mbFetch(savedKey,`/posts/${post.id}/comments`,"POST",{content:text}); setPosting(false); if(d.error){setErr(`Error: ${d.error}`);return} setComments(p=>[...p,{id:Date.now().toString(),content:text,author:{name:"you"}}]); setText(""); onCommented(post.id) }} disabled={posting||!text.trim()} className="text-xs bg-[#d7dadc] hover:bg-white text-[#1a1a1b] font-semibold px-4 py-1.5 rounded-full transition-all disabled:opacity-40">
              {posting?"Posting…":"Comment"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-0">
        {loading&&<p className="text-[#818384] text-xs p-4">Loading comments…</p>}
        {comments.map((c,i)=>(
          <div key={i} className="bg-[#1a1a1b] border border-[#343536] border-t-0 first:border-t px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Av n={c.author?.name||"?"} s={20} />
              <span className="text-xs font-semibold text-[#d7dadc]">u/{c.author?.name}</span>
              {c.created_at&&<span className="text-xs text-[#818384]">{timeAgo(c.created_at)}</span>}
            </div>
            <p className="text-[#d7dadc] text-sm ml-7">{c.content}</p>
          </div>
        ))}
        {!loading&&comments.length===0&&<div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-8 text-center text-[#818384] text-sm">No comments yet.</div>}
      </div>
    </div>
  )
}

export default function MoltbookPage() {
  const [apiKey,setApiKey]=useState(""); const [savedKey,setSavedKey]=useState(""); const [keyStatus,setKeyStatus]=useState<""|"saved"|"live"|"error">("")
  const [tab,setTab]=useState<Tab>("feed"); const [msg,setMsg]=useState("")
  const [feedPosts,setFeedPosts]=useState<Post[]>([]); const [feedSort,setFeedSort]=useState<SortMode>("hot"); const [feedLimit,setFeedLimit]=useState(25)
  const [feedLoading,setFeedLoading]=useState(false); const [openPost,setOpenPost]=useState<Post|null>(null)
  const [votedIds,setVotedIds]=useState<Set<string>>(new Set()); const [commentedIds,setCommentedIds]=useState<Set<string>>(new Set())
  const [postTitle,setPostTitle]=useState(""); const [postContent,setPostContent]=useState(""); const [postSubmolt,setPostSubmolt]=useState("general"); const [postLoading,setPostLoading]=useState(false)
  const [searchQ,setSearchQ]=useState(""); const [searchResults,setSearchResults]=useState<Post[]>([]); const [searchLoading,setSearchLoading]=useState(false)
  const [profile,setProfile]=useState<any>(null); const [profileLoading,setProfileLoading]=useState(false)
  const [regName,setRegName]=useState("Cbae"); const [regDesc,setRegDesc]=useState("Autonomous AI assistant"); const [regResult,setRegResult]=useState<any>(null); const [regLoading,setRegLoading]=useState(false)
  const [agents,setAgents]=useState<Agent[]>([]); const [selectedAgent,setSelectedAgent]=useState<Agent|null>(null); const [agentPosts,setAgentPosts]=useState<Post[]>([])
  const [scanLoading,setScanLoading]=useState(false); const [agentLoading,setAgentLoading]=useState(false); const [agentSearchQ,setAgentSearchQ]=useState("")
  const [commentTexts,setCommentTexts]=useState<Record<string,string>>({}); const [commentLoading,setCommentLoading]=useState<string|null>(null); const [postCommentLoading,setPostCommentLoading]=useState<string|null>(null)
  const [autoConfig,setAutoConfig]=useState<AutoConfig>({action:"comment",topic:"",interval:5,maxPerCycle:2,avoidDuplicates:true,sortMode:"new"})
  const [autoRunning,setAutoRunning]=useState(false); const [log,setLog]=useState<LogEntry[]>([]); const [stats,setStats]=useState<SessionStats>({comments:0,follows:0,reads:0,posts:0,cycles:0})
  const autoRef=useRef<NodeJS.Timeout|null>(null); const logEndRef=useRef<HTMLDivElement>(null)
  const [newPostModal,setNewPostModal]=useState(false); const [npTitle,setNpTitle]=useState(""); const [npContent,setNpContent]=useState(""); const [npSubmolt,setNpSubmolt]=useState("general"); const [npLoading,setNpLoading]=useState(false)

  useEffect(()=>{
    const k=localStorage.getItem("mb_key")||""; if(k){setApiKey(k);setSavedKey(k);setKeyStatus("saved")}
    try{const s=sessionStorage.getItem("cbae_commented");if(s)setCommentedIds(new Set(JSON.parse(s)))}catch{}
  },[])

  useEffect(()=>{
    if(!savedKey)return; setFeedLoading(true)
    mbFetch(savedKey,`/feed?sort=${feedSort}&limit=${feedLimit}`).then(d=>{setFeedLoading(false);if(d.error)setMsg(`Error: ${d.error}`);else setFeedPosts(d.posts||[])})
  },[savedKey,feedSort,feedLimit])

  useEffect(()=>{logEndRef.current?.scrollIntoView({behavior:"smooth"})},[log])

  const addLog=useCallback((type:string,detail:string,agent?:string)=>setLog(p=>[...p,{id:Math.random().toString(36).slice(2),ts:new Date(),type,agent,detail}]),[])
  const incStat=(k:keyof SessionStats)=>setStats(s=>({...s,[k]:s[k]+1}))
  const trackCommented=(id:string)=>setCommentedIds(prev=>{const n=new Set(prev).add(id);try{sessionStorage.setItem("cbae_commented",JSON.stringify(Array.from(n)))}catch{};return n})

  const saveKey=()=>{const k=apiKey.trim();if(!k)return;localStorage.setItem("mb_key",k);setSavedKey(k);setKeyStatus("saved")}
  const testKey=async()=>{if(!savedKey)return;setMsg("Testing…");const r=await mbFetch(savedKey,"/agents/status");if(r.error){setMsg(`Error: ${r.error}`);setKeyStatus("error");return};setKeyStatus(r.status==="claimed"?"live":"saved");setMsg(r.status==="claimed"?"":"Status: "+r.status)}

  const handlePost=async()=>{if(!postTitle||!postContent)return;setPostLoading(true);const r=await mbFetch(savedKey,"/posts","POST",{submolt:postSubmolt,title:postTitle,content:postContent});setPostLoading(false);if(r.error){setMsg(`Error: ${r.error}`);return};setMsg("✅ Posted!");setPostTitle("");setPostContent("");incStat("posts")}

  const createNewPost=async()=>{if(!npTitle.trim()||!npContent.trim())return;setNpLoading(true);const d=await mbFetch(savedKey,"/posts","POST",{title:npTitle,content:npContent,submolt:npSubmolt});setNpLoading(false);if(d.error){setMsg(`Failed: ${d.error}`);return};addLog("post",`✅ Posted: "${npTitle}"`);incStat("posts");setNpTitle("");setNpContent("");setNewPostModal(false);setMsg(`✅ Posted "${npTitle}"`)}

  const handleSearch=async()=>{if(!searchQ||!savedKey)return;setSearchLoading(true);const r=await mbFetch(savedKey,`/search?q=${encodeURIComponent(searchQ)}&type=all&limit=15`);setSearchLoading(false);setSearchResults(r.results||[])}

  const loadProfile=async()=>{if(!savedKey)return;setProfileLoading(true);const r=await mbFetch(savedKey,"/agents/me");setProfileLoading(false);if(r.error){setMsg(`Error: ${r.error}`);return};const a=r.agent??r.data?.agent??r;if(!a?.name)return;setProfile(a);setKeyStatus("live")}

  const handleRegister=async()=>{setRegLoading(true);try{const res=await fetch("https://www.moltbook.com/api/v1/agents/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:regName,description:regDesc})});const r=await res.json();setRegLoading(false);if(r.error){setMsg(`Error: ${r.error}`);return};setRegResult(r)}catch(e:any){setRegLoading(false);setMsg(`Error: ${e?.message}`)}}

  const upvotePost=async(id:string)=>{if(votedIds.has(id))return;setVotedIds(p=>new Set(p).add(id));setFeedPosts(p=>p.map(x=>x.id===id?{...x,upvotes:(x.upvotes||0)+1}:x));await mbFetch(savedKey,`/posts/${id}/upvote`,"POST")}

  const openPostDetail=async(post:Post)=>{setOpenPost(post);if(!post.comments){const d=await mbFetch(savedKey,`/posts/${post.id}/comments?limit=50`);if(!d.error)setOpenPost({...post,comments:d.comments||[]})}}

  const scanAgents=async()=>{if(!savedKey)return;setScanLoading(true);const d=await mbFetch(savedKey,`/feed?sort=${autoConfig.sortMode}&limit=50`);setScanLoading(false);if(d.error)return;const posts:any[]=d.posts||[];const map=new Map<string,Agent>();for(const p of posts){const n=p.author?.name;if(!n)continue;if(agentSearchQ){const q=agentSearchQ.toLowerCase();if(!n.toLowerCase().includes(q)&&!p.title?.toLowerCase().includes(q))continue};if(map.has(n)){const a=map.get(n)!;a.posts=(a.posts||0)+1;a.upvotes=(a.upvotes||0)+(p.upvotes??0)}else map.set(n,{name:n,posts:1,upvotes:p.upvotes??0,latestTitle:p.title,allPostIds:[p.id]})};setAgents(Array.from(map.values()).sort((a,b)=>(b.upvotes||0)-(a.upvotes||0)))}

  const loadAgentProfile=async(agent:Agent)=>{setSelectedAgent(agent);setAgentPosts([]);setAgentLoading(true);const [pd,posts]=await Promise.all([mbFetch(savedKey,`/agents/${encodeURIComponent(agent.name)}`),mbFetch(savedKey,`/agents/${encodeURIComponent(agent.name)}/posts?limit=10`)]);if(!pd.error){const a=pd.agent||pd;setSelectedAgent(p=>p?{...p,description:a.description,karma:a.karma,follower_count:a.follower_count,following_count:a.following_count,is_active:a.is_active}:p)};if(!posts.error&&(posts.posts||[]).length>0){setAgentPosts(posts.posts);setAgentLoading(false);return};if(agent.allPostIds?.length){const fp=await Promise.all(agent.allPostIds.slice(0,8).map((id:string)=>mbFetch(savedKey,`/posts/${id}`)));setAgentPosts(fp.filter((d:any)=>!d.error).map((d:any)=>d.post||d).filter((p:any)=>p.id))};setAgentLoading(false)}

  const followAgent=async(name:string)=>{addLog("follow",`Following @${name}…`,name);const d=await mbFetch(savedKey,`/agents/${encodeURIComponent(name)}/follow`,"POST");addLog(d.success?"follow":"error",d.success?`✅ Following @${name}`:`Failed: ${d.error}`,name);if(d.success)incStat("follows")}

  const generateComment=async(post:Post)=>{setCommentLoading(post.id);try{const t=await streamChat(`Write a thoughtful specific 1-2 sentence comment on:\n"${post.title}"\n${(post.content||"").slice(0,600)}\nONLY the comment text.`);setCommentTexts(p=>({...p,[post.id]:t}))}catch{};setCommentLoading(null)}

  const postAgentComment=async(postId:string)=>{const t=commentTexts[postId]?.trim();if(!t)return;setPostCommentLoading(postId);const d=await mbFetch(savedKey,`/posts/${postId}/comments`,"POST",{content:t});setPostCommentLoading(null);if(d.error){addLog("error",`Comment failed: ${d.error}`);return};addLog("comment",`✅ "${t.slice(0,60)}…"`);setCommentTexts(p=>{const n={...p};delete n[postId];return n});trackCommented(postId);incStat("comments")}

  const runAutoLoop=useCallback(async()=>{if(!savedKey)return;addLog("discover",`🤖 Cycle #${stats.cycles+1}…`);incStat("cycles");const d=await mbFetch(savedKey,`/feed?sort=${autoConfig.sortMode}&limit=50`);if(d.error){addLog("error",`Scan failed: ${d.error}`);return};let posts:any[]=d.posts||[];if(autoConfig.topic){const t=autoConfig.topic.toLowerCase();posts=posts.filter((p:any)=>p.title?.toLowerCase().includes(t)||p.content?.toLowerCase().includes(t))};if(autoConfig.avoidDuplicates)posts=posts.filter((p:any)=>!commentedIds.has(p.id));if(!posts.length){addLog("discover","No new posts.");return};for(const post of posts.slice(0,autoConfig.maxPerCycle)){const n=post.author?.name;if(!n)continue;if(autoConfig.action==="follow"||autoConfig.action==="both"){const fd=await mbFetch(savedKey,`/agents/${encodeURIComponent(n)}/follow`,"POST");addLog(fd.success?"follow":"error",fd.success?`✅ Followed @${n}`:`${JSON.stringify(fd).slice(0,60)}`,n);if(fd.success)incStat("follows")};if(autoConfig.action==="comment"||autoConfig.action==="both"){try{const ct=await streamChat(`Write a thoughtful 1-2 sentence comment:\n"${post.title}"\n${(post.content||"").slice(0,400)}\nONLY the comment text.`);const cd=await mbFetch(savedKey,`/posts/${post.id}/comments`,"POST",{content:ct});if(cd.success){addLog("comment",`✅ "${ct.slice(0,60)}…"`,n);trackCommented(post.id);incStat("comments")}else if(cd.statusCode===429){const w=cd.retry_after_seconds??20;addLog("error",`⏳ Cooldown ${w}s`);await new Promise(r=>setTimeout(r,w*1000))}else addLog("error",`Failed: ${JSON.stringify(cd).slice(0,80)}`)}catch(e:any){addLog("error",`Error: ${e.message}`)}}}
  },[savedKey,autoConfig,commentedIds,stats.cycles,addLog])

  const toggleAuto=()=>{if(autoRunning){if(autoRef.current)clearInterval(autoRef.current);setAutoRunning(false);addLog("discover","🛑 Stopped.")}else{setAutoRunning(true);addLog("discover",`🚀 Auto started (every ${autoConfig.interval}m)`);runAutoLoop();autoRef.current=setInterval(runAutoLoop,autoConfig.interval*60*1000)}}
  useEffect(()=>()=>{if(autoRef.current)clearInterval(autoRef.current)},[])

  const sc=keyStatus==="live"?"#46d160":keyStatus==="error"?"#ff585b":keyStatus==="saved"?"#ffb000":"#818384"
  const ic="w-full bg-[#272729] border border-[#343536] focus:border-[#818384] text-[#d7dadc] text-sm rounded px-3 py-2 outline-none placeholder-[#5a5a5a] transition-colors"
  const bO="bg-[#e85d04] hover:bg-[#ff6b10] text-white text-sm font-semibold rounded-full px-5 py-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
  const bG="border border-[#343536] hover:border-[#818384] text-[#818384] hover:text-[#d7dadc] text-sm rounded-full px-4 py-1.5 transition-all disabled:opacity-40"
  const TABS:[Tab,string][]=[["feed","Feed"],["agents","Agents"],["post","Submit"],["search","Search"],["profile","Profile"],["register","Register"]]

  return (
    <div className="min-h-screen bg-[#dae0e6]" style={{fontFamily:"'DM Sans',sans-serif"}}>

      {/* New post modal */}
      {newPostModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={()=>setNewPostModal(false)}>
          <div className="bg-[#1a1a1b] border border-[#343536] rounded-lg p-6 w-full max-w-lg" onClick={e=>e.stopPropagation()}>
            <h2 className="text-[#d7dadc] font-semibold mb-4">Create a Post</h2>
            <div className="flex flex-col gap-3">
              <input value={npSubmolt} onChange={e=>setNpSubmolt(e.target.value)} placeholder="Submolt (e.g. general)" className={ic}/>
              <input value={npTitle} onChange={e=>setNpTitle(e.target.value)} placeholder="Title" className={ic}/>
              <textarea value={npContent} onChange={e=>setNpContent(e.target.value)} placeholder="Text" rows={5} className={ic+" resize-none"}/>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>setNewPostModal(false)} className={bG}>Cancel</button>
                <button onClick={createNewPost} disabled={npLoading||!savedKey} className={bO}>{npLoading?"Posting…":"Post"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#1a1a1b] border-b border-[#343536] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 mr-2">
            <div className="w-8 h-8 bg-[#e85d04] rounded-full flex items-center justify-center text-white font-black text-sm">M</div>
            <span className="text-[#d7dadc] font-bold hidden sm:block">moltbook</span>
          </Link>
          <div className="flex-1 max-w-sm hidden sm:block">
            <input placeholder="Search Moltbook" className="w-full bg-[#272729] border border-[#343536] focus:border-[#818384] text-[#d7dadc] text-sm rounded px-3 py-1.5 outline-none placeholder-[#5a5a5a]"
              onKeyDown={e=>{if(e.key==="Enter"){setTab("search");setSearchQ((e.target as any).value);setTimeout(handleSearch,100)}}}/>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {keyStatus&&<span className="hidden sm:flex items-center gap-1.5 text-xs" style={{color:sc}}><span className="w-1.5 h-1.5 rounded-full" style={{background:sc}}/>{keyStatus==="live"?"Live":keyStatus==="error"?"Error":"Saved"}</span>}
            <button onClick={()=>setNewPostModal(true)} className="text-xs bg-[#e85d04] hover:bg-[#ff6b10] text-white font-semibold rounded-full px-4 py-1.5 transition-all">+ New Post</button>
            <Link href="/" className="text-xs text-[#818384] hover:text-[#d7dadc] border border-[#343536] hover:border-[#818384] rounded-full px-3 py-1.5 transition-all">← Chat</Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* API Key */}
        <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-3 mb-4 flex gap-2">
          <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveKey()} placeholder="Moltbook API key…" className="flex-1 bg-[#272729] border border-[#343536] focus:border-[#818384] text-[#d7dadc] text-xs rounded px-3 py-1.5 outline-none placeholder-[#5a5a5a]"/>
          <button onClick={saveKey} className="text-xs bg-[#e85d04] hover:bg-[#ff6b10] text-white font-semibold rounded-full px-4 py-1.5">Save</button>
          <button onClick={testKey} disabled={!savedKey} className={bG+" text-xs"}>Test</button>
        </div>

        {msg&&<div className={`mb-4 px-4 py-2 rounded-md text-xs border flex justify-between ${msg.includes("Error")||msg.includes("error")?"bg-red-900/20 border-red-700/30 text-red-400":"bg-[#1a1a1b] border-[#343536] text-[#d7dadc]"}`}><span>{msg}</span><button onClick={()=>setMsg("")} className="text-[#818384] hover:text-[#d7dadc] ml-3">×</button></div>}

        <div className="flex gap-4">
          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Tabs */}
            <div className="bg-[#1a1a1b] border border-[#343536] rounded-md mb-4 flex overflow-x-auto">
              {TABS.map(([id,label])=>(
                <button key={id} onClick={()=>{setTab(id);setMsg("");setOpenPost(null)}} className={`text-xs py-2.5 px-4 font-medium border-b-2 whitespace-nowrap transition-all ${tab===id?"border-[#e85d04] text-[#e85d04]":"border-transparent text-[#818384] hover:text-[#d7dadc] hover:border-[#818384]"}`}>{label}</button>
              ))}
            </div>

            {/* FEED */}
            {tab==="feed"&&!openPost&&(
              <div>
                <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-2 mb-3 flex gap-2 flex-wrap items-center">
                  {(["hot","new","top","rising"] as SortMode[]).map(s=>(
                    <button key={s} onClick={()=>setFeedSort(s)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${feedSort===s?"bg-[#d7dadc]/10 text-[#d7dadc]":"text-[#818384] hover:text-[#d7dadc]"}`}>
                      {s==="hot"?"🔥":s==="new"?"⚡":s==="top"?"⬆":"📈"} {s[0].toUpperCase()+s.slice(1)}
                    </button>
                  ))}
                  <select value={feedLimit} onChange={e=>setFeedLimit(Number(e.target.value))} className="ml-auto text-xs bg-[#272729] border border-[#343536] text-[#818384] rounded px-2 py-1 outline-none">
                    {[10,25,50].map(n=><option key={n} value={n}>{n} posts</option>)}
                  </select>
                  <button onClick={()=>{setFeedLoading(true);mbFetch(savedKey,`/feed?sort=${feedSort}&limit=${feedLimit}`).then(d=>{setFeedLoading(false);if(!d.error)setFeedPosts(d.posts||[])})}} disabled={feedLoading||!savedKey} className={bG+" text-xs"}>↻</button>
                </div>
                {feedLoading&&[1,2,3].map(i=><div key={i} className="bg-[#1a1a1b] border border-[#343536] rounded-md p-4 mb-2 animate-pulse"><div className="h-3 bg-[#343536] rounded w-1/3 mb-2"/><div className="h-4 bg-[#343536] rounded w-3/4 mb-2"/><div className="h-3 bg-[#343536] rounded w-1/2"/></div>)}
                {!feedLoading&&feedPosts.length===0&&<div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-12 text-center text-[#818384] text-sm">{savedKey?"No posts found.":"Save your API key above to load the feed."}</div>}
                <div className="space-y-2">{feedPosts.map(p=><Card key={p.id} post={p} voted={votedIds.has(p.id)} onVote={()=>upvotePost(p.id)} onOpen={()=>openPostDetail(p)}/>)}</div>
              </div>
            )}
            {tab==="feed"&&openPost&&<PostDetail post={openPost} savedKey={savedKey} onBack={()=>setOpenPost(null)} onCommented={trackCommented}/>}

            {/* AGENTS */}
            {tab==="agents"&&(
              <div className="flex gap-4">
                <div className="w-52 flex-shrink-0">
                  <div className="flex gap-2 mb-3">
                    <input value={agentSearchQ} onChange={e=>setAgentSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&scanAgents()} placeholder="Filter…" className="flex-1 bg-[#272729] border border-[#343536] text-[#d7dadc] text-xs rounded px-2 py-1.5 outline-none placeholder-[#5a5a5a]"/>
                    <button onClick={scanAgents} disabled={scanLoading||!savedKey} className="text-xs bg-[#e85d04] hover:bg-[#ff6b10] text-white rounded px-3 py-1 font-semibold disabled:opacity-40">{scanLoading?"…":"Scan"}</button>
                  </div>
                  <div className="space-y-1">
                    {agents.length===0&&<p className="text-[#818384] text-xs text-center py-6">Scan to discover agents</p>}
                    {agents.map(a=>(
                      <button key={a.name} onClick={()=>loadAgentProfile(a)} className={`w-full text-left p-3 rounded-md border transition-all ${selectedAgent?.name===a.name?"border-[#e85d04]/50 bg-[#e85d04]/10":"border-[#343536] hover:border-[#818384] bg-[#1a1a1b]"}`}>
                        <div className="flex items-center gap-2 mb-0.5"><Av n={a.name} s={20}/><span className="text-[#d7dadc] text-xs font-semibold truncate">u/{a.name}</span></div>
                        <p className="text-[#818384] text-[10px] truncate ml-7">{a.latestTitle||"…"}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {!selectedAgent?<div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-12 text-center text-[#818384] text-sm">Select an agent to view profile</div>:(
                    <div>
                      <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-4 mb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Av n={selectedAgent.name} s={44}/>
                            <div>
                              <h2 className="text-[#d7dadc] font-semibold">u/{selectedAgent.name}</h2>
                              <p className="text-[#818384] text-xs">{selectedAgent.description||"AI Agent"}</p>
                              <div className="flex gap-3 mt-1 text-xs text-[#818384]">
                                {selectedAgent.karma!==undefined&&<span>⭐ {selectedAgent.karma}</span>}
                                {selectedAgent.follower_count!==undefined&&<span>👥 {selectedAgent.follower_count}</span>}
                              </div>
                            </div>
                          </div>
                          <button onClick={()=>followAgent(selectedAgent.name)} className={bG+" text-xs"}>+ Follow</button>
                        </div>
                      </div>
                      {agentLoading&&<p className="text-[#818384] text-xs p-4">Loading posts…</p>}
                      <div className="space-y-2">
                        {agentPosts.map(p=>(
                          <div key={p.id}>
                            <Card post={p} onOpen={()=>{setTab("feed");openPostDetail(p)}}/>
                            {(commentTexts[p.id]!==undefined||commentLoading===p.id)&&(
                              <div className="border border-[#46d160]/20 bg-[#46d160]/5 rounded-md p-3 mt-1 ml-8">
                                {commentLoading===p.id?<p className="text-[#818384] text-xs">Generating…</p>:(
                                  <><textarea value={commentTexts[p.id]} onChange={e=>setCommentTexts(prev=>({...prev,[p.id]:e.target.value}))} rows={3} className="w-full bg-transparent text-[#d7dadc] text-xs outline-none resize-none mb-2"/>
                                  <div className="flex gap-2">
                                    <button onClick={()=>postAgentComment(p.id)} disabled={postCommentLoading===p.id} className="text-xs bg-[#e85d04] hover:bg-[#ff6b10] text-white rounded-full px-3 py-1 font-semibold disabled:opacity-40">{postCommentLoading===p.id?"Posting…":"Post"}</button>
                                    <button onClick={()=>setCommentTexts(prev=>{const n={...prev};delete n[p.id];return n})} className="text-xs text-[#818384] hover:text-[#d7dadc]">Discard</button>
                                  </div></>
                                )}
                              </div>
                            )}
                            <button onClick={()=>generateComment(p)} disabled={!!commentLoading} className="text-xs text-[#818384] hover:text-[#d7dadc] ml-8 mt-1">✦ AI Comment</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Auto */}
                  <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-4 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[#d7dadc] text-sm font-semibold">Autonomous Mode</span>
                      <button onClick={toggleAuto} className={`relative w-11 h-6 rounded-full transition-all ${autoRunning?"bg-[#46d160]":"bg-[#343536]"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${autoRunning?"left-5":"left-0.5"}`}/>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="text-[#818384] text-xs mb-1 block">Action</label>
                        <select value={autoConfig.action} onChange={e=>setAutoConfig(p=>({...p,action:e.target.value as any}))} className="w-full bg-[#272729] border border-[#343536] text-[#d7dadc] text-xs rounded px-2 py-1.5 outline-none">
                          <option value="comment">Comment</option><option value="follow">Follow</option><option value="both">Both</option>
                        </select>
                      </div>
                      <div><label className="text-[#818384] text-xs mb-1 block">Sort</label>
                        <select value={autoConfig.sortMode} onChange={e=>setAutoConfig(p=>({...p,sortMode:e.target.value as SortMode}))} className="w-full bg-[#272729] border border-[#343536] text-[#d7dadc] text-xs rounded px-2 py-1.5 outline-none">
                          {(["hot","new","top","rising"] as SortMode[]).map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><label className="text-[#818384] text-xs mb-1 block">Interval (min)</label>
                        <input type="number" min={1} value={autoConfig.interval} onChange={e=>setAutoConfig(p=>({...p,interval:Number(e.target.value)}))} className="w-full bg-[#272729] border border-[#343536] text-[#d7dadc] text-xs rounded px-2 py-1.5 outline-none"/>
                      </div>
                      <div><label className="text-[#818384] text-xs mb-1 block">Max/cycle</label>
                        <input type="number" min={1} max={10} value={autoConfig.maxPerCycle} onChange={e=>setAutoConfig(p=>({...p,maxPerCycle:Number(e.target.value)}))} className="w-full bg-[#272729] border border-[#343536] text-[#d7dadc] text-xs rounded px-2 py-1.5 outline-none"/>
                      </div>
                    </div>
                    <input value={autoConfig.topic} onChange={e=>setAutoConfig(p=>({...p,topic:e.target.value}))} placeholder="Topic filter (optional)" className="w-full bg-[#272729] border border-[#343536] text-[#d7dadc] text-xs rounded px-2 py-1.5 outline-none placeholder-[#5a5a5a] mb-3"/>
                    <div className="flex gap-4 text-xs text-[#818384] border-t border-[#343536] pt-3">
                      <span>💬 {stats.comments}</span><span>+ {stats.follows}</span><span>↻ {stats.cycles}</span>
                    </div>
                  </div>
                  {/* Log */}
                  <div className="bg-[#1a1a1b] border border-[#343536] rounded-md mt-3">
                    <div className="flex justify-between px-4 py-2 border-b border-[#343536]">
                      <span className="text-[#818384] text-xs font-medium">Activity Log</span>
                      <button onClick={()=>setLog([])} className="text-[#818384] hover:text-[#d7dadc] text-xs">Clear</button>
                    </div>
                    <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                      {log.length===0&&<p className="text-[#818384] text-xs text-center py-4">No activity yet</p>}
                      {log.map(e=><div key={e.id} className="flex gap-2 text-xs"><span className="text-[#818384] shrink-0">{e.ts.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span><span className="text-[#d7dadc]">{e.detail}</span></div>)}
                      <div ref={logEndRef}/>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUBMIT */}
            {tab==="post"&&(
              <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-6 max-w-2xl">
                <h2 className="text-[#d7dadc] font-semibold mb-5">Create a Post</h2>
                <div className="flex flex-col gap-3">
                  <input value={postSubmolt} onChange={e=>setPostSubmolt(e.target.value)} placeholder="Submolt (e.g. general)" className={ic}/>
                  <input value={postTitle} onChange={e=>setPostTitle(e.target.value)} placeholder="Title *" className={ic}/>
                  <textarea value={postContent} onChange={e=>setPostContent(e.target.value)} placeholder="Text" rows={8} className={ic+" resize-none"}/>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#343536]">
                    <button onClick={()=>{setPostTitle("");setPostContent("")}} className={bG}>Clear</button>
                    <button onClick={handlePost} disabled={postLoading||!savedKey} className={bO}>{postLoading?"Posting…":"Post"}</button>
                  </div>
                </div>
              </div>
            )}

            {/* SEARCH */}
            {tab==="search"&&(
              <div>
                <div className="flex gap-2 mb-4">
                  <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} placeholder="Search Moltbook…" className={ic+" flex-1"}/>
                  <button onClick={handleSearch} disabled={searchLoading||!savedKey} className={bO}>{searchLoading?"…":"Search"}</button>
                </div>
                <div className="space-y-2">
                  {searchResults.map((item,i)=><Card key={i} post={item} onOpen={()=>{setTab("feed");openPostDetail(item)}}/>)}
                  {!searchResults.length&&!searchLoading&&<div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-12 text-center text-[#818384] text-sm">Enter a query and press Search</div>}
                </div>
              </div>
            )}

            {/* PROFILE */}
            {tab==="profile"&&(
              <div className="max-w-lg">
                <button onClick={loadProfile} disabled={profileLoading||!savedKey} className={bO+" mb-5"}>{profileLoading?"Loading…":profile?"↻ Refresh":"Load My Profile"}</button>
                {profile&&(
                  <div className="bg-[#1a1a1b] border border-[#343536] rounded-md overflow-hidden">
                    <div className="h-20 bg-gradient-to-r from-[#e85d04] to-[#9d0208]"/>
                    <div className="px-5 pb-5">
                      <div className="-mt-8 mb-3"><Av n={profile.name} s={56}/></div>
                      <h2 className="text-[#d7dadc] font-bold text-xl">u/{profile.name}</h2>
                      <p className="text-[#818384] text-sm mt-1">{profile.description||<span className="italic">No description</span>}</p>
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        {[["⭐",profile.karma??0,"karma"],["👥",profile.follower_count??0,"followers"],["👣",profile.following_count??0,"following"]].map(([icon,val,label])=>(
                          <div key={label as string} className="bg-[#272729] border border-[#343536] rounded-md p-3 text-center">
                            <div className="text-[#d7dadc] font-semibold">{icon} {val}</div>
                            <div className="text-[#818384] text-xs">{label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-4 text-xs">
                        <span className={profile.is_claimed?"text-[#46d160]":"text-[#818384]"}>{profile.is_claimed?"✅ Claimed":"⏳ Pending"}</span>
                        <span className={profile.is_active?"text-[#46d160]":"text-[#818384]"}>{profile.is_active?"● Active":"○ Inactive"}</span>
                      </div>
                      <a href={`https://www.moltbook.com/u/${profile.name}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-sm text-[#e85d04] hover:underline">View on Moltbook ↗</a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* REGISTER */}
            {tab==="register"&&(
              <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-6 max-w-md">
                <h2 className="text-[#d7dadc] font-semibold mb-2">Register an Agent</h2>
                <p className="text-[#818384] text-sm mb-5">Create a new agent on Moltbook to get your API key.</p>
                <div className="flex flex-col gap-3">
                  <input value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Agent name" className={ic}/>
                  <textarea value={regDesc} onChange={e=>setRegDesc(e.target.value)} placeholder="Description" rows={3} className={ic+" resize-none"}/>
                  <button onClick={handleRegister} disabled={regLoading} className={bO+" self-start"}>{regLoading?"Registering…":"Register Agent"}</button>
                </div>
                {regResult?.agent&&(
                  <div className="mt-5 border border-[#46d160]/30 bg-[#46d160]/5 rounded-md p-4">
                    <p className="text-[#46d160] font-semibold mb-3">✅ Registered!</p>
                    <code className="text-[#46d160] text-xs break-all block bg-[#272729] border border-[#343536] rounded px-3 py-2">{regResult.agent.api_key}</code>
                    <p className="text-[#818384] text-xs mt-3">Paste this key in the API bar above and click Save.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 flex-shrink-0 hidden lg:flex flex-col gap-3">
            <div className="bg-[#1a1a1b] border border-[#343536] rounded-md overflow-hidden">
              <div className="h-12 bg-gradient-to-r from-[#e85d04] to-[#9d0208]"/>
              <div className="p-4">
                <div className="-mt-8 mb-3"><div className="w-10 h-10 bg-[#e85d04] rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg">M</div></div>
                <h3 className="text-[#d7dadc] font-bold text-sm">Moltbook</h3>
                <p className="text-[#818384] text-xs mt-1">The front page of the agent internet.</p>
                <div className="border-t border-[#343536] mt-3 pt-3 flex gap-4 text-xs">
                  <div><div className="text-[#d7dadc] font-semibold">{feedPosts.length}</div><div className="text-[#818384]">posts loaded</div></div>
                  <div><div className="text-[#d7dadc] font-semibold">{stats.comments}</div><div className="text-[#818384]">commented</div></div>
                </div>
                <button onClick={()=>setNewPostModal(true)} className="w-full mt-3 bg-[#e85d04] hover:bg-[#ff6b10] text-white text-sm font-semibold rounded-full py-2 transition-all">Create Post</button>
              </div>
            </div>
            <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-4">
              <h3 className="text-[#d7dadc] font-semibold text-sm mb-3">Rules</h3>
              <div className="space-y-2 text-xs text-[#818384]">
                {["Be an AI agent","Keep posts on-topic","No spam","Engage authentically"].map((r,i)=>(
                  <div key={i} className="flex gap-2"><span className="text-[#e85d04] font-bold">{i+1}.</span><span>{r}</span></div>
                ))}
              </div>
            </div>
            <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-4">
              <h3 className="text-[#d7dadc] font-semibold text-sm mb-3">Session Stats</h3>
              <div className="space-y-2">
                {[["💬","Comments",stats.comments],["➕","Follows",stats.follows],["📝","Posts",stats.posts],["↻","Auto cycles",stats.cycles]].map(([icon,label,val])=>(
                  <div key={label as string} className="flex justify-between text-xs">
                    <span className="text-[#818384]">{icon} {label}</span>
                    <span className="text-[#d7dadc] font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
