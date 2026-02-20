import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

const MB = "https://www.moltbook.com/api/v1"

function headers(key: string) {
  return { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Accept": "application/json" }
}

async function safeRequest(fn: () => Promise<Response>) {
  try {
    const r    = await fn()
    const text = await r.text()
    try {
      return NextResponse.json(JSON.parse(text))
    } catch {
      return NextResponse.json({ error: `Bad response: ${text.slice(0, 200)}` })
    }
  } catch (e: any) {
    const msg = e?.message || "Request failed"
    if (msg.includes("timeout") || msg.includes("abort") || msg.includes("TimeoutError")) {
      return NextResponse.json({ error: "Moltbook timed out. Try again in a moment." })
    }
    return NextResponse.json({ error: msg })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const key    = searchParams.get("api_key") || ""
  const action = searchParams.get("action") || ""

  if (action === "status")   return safeRequest(() => fetch(`${MB}/agents/status`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  if (action === "me")       return safeRequest(() => fetch(`${MB}/agents/me`,     { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  if (action === "submolts") return safeRequest(() => fetch(`${MB}/submolts`,      { headers: headers(key), signal: AbortSignal.timeout(15000) }))

  if (action === "feed") {
    const sort  = searchParams.get("sort")  || "hot"
    const limit = searchParams.get("limit") || "10"
    return safeRequest(() => fetch(`${MB}/feed?sort=${sort}&limit=${limit}`, { headers: headers(key), signal: AbortSignal.timeout(20000) }))
  }

  if (action === "search") {
    const q     = searchParams.get("q")     || ""
    const type  = searchParams.get("type")  || "all"
    const limit = searchParams.get("limit") || "10"
    return safeRequest(() => fetch(`${MB}/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  }

  // ── Multi-agent endpoints ─────────────────────────────────────

  if (action === "agent-profile") {
    const name = searchParams.get("name") || ""
    if (!name) return NextResponse.json({ error: "name param required" })
    return safeRequest(() => fetch(`${MB}/agents/${encodeURIComponent(name)}`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  }

  if (action === "agent-posts") {
    const name  = searchParams.get("name")  || ""
    const limit = searchParams.get("limit") || "10"
    if (!name) return NextResponse.json({ error: "name param required" })
    return safeRequest(() => fetch(`${MB}/agents/${encodeURIComponent(name)}/posts?limit=${limit}`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  }

  if (action === "post-detail") {
    const postId = searchParams.get("post_id") || ""
    if (!postId) return NextResponse.json({ error: "post_id param required" })
    return safeRequest(() => fetch(`${MB}/posts/${postId}`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  }

  if (action === "post-comments") {
    const postId = searchParams.get("post_id") || ""
    const limit  = searchParams.get("limit")   || "20"
    if (!postId) return NextResponse.json({ error: "post_id param required" })
    return safeRequest(() => fetch(`${MB}/posts/${postId}/comments?limit=${limit}`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  }

  if (action === "agents-list") {
    const limit = searchParams.get("limit") || "20"
    return safeRequest(() => fetch(`${MB}/agents?limit=${limit}`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
  }

  return NextResponse.json({ error: "Unknown action" })
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const key    = searchParams.get("api_key") || ""
  const action = searchParams.get("action")  || ""
  const body   = await req.json().catch(() => ({}))

  if (action === "register") {
    return safeRequest(() => fetch(`${MB}/agents/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    }))
  }

  if (action === "post") {
    return safeRequest(() => fetch(`${MB}/posts`, {
      method: "POST", headers: headers(key),
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    }))
  }

  if (action === "comment") {
    const postId = searchParams.get("post_id") || ""
    return safeRequest(() => fetch(`${MB}/posts/${postId}/comments`, {
      method: "POST", headers: headers(key),
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    }))
  }

  if (action === "upvote") {
    const postId = searchParams.get("post_id") || ""
    return safeRequest(() => fetch(`${MB}/posts/${postId}/upvote`, {
      method: "POST", headers: headers(key),
      signal: AbortSignal.timeout(15000),
    }))
  }

  // ── Multi-agent POST endpoints ────────────────────────────────

  if (action === "follow") {
    const name = searchParams.get("name") || ""
    if (!name) return NextResponse.json({ error: "name param required" })
    return safeRequest(() => fetch(`${MB}/agents/${encodeURIComponent(name)}/follow`, {
      method: "POST", headers: headers(key),
      signal: AbortSignal.timeout(15000),
    }))
  }

  if (action === "unfollow") {
    const name = searchParams.get("name") || ""
    if (!name) return NextResponse.json({ error: "name param required" })
    return safeRequest(() => fetch(`${MB}/agents/${encodeURIComponent(name)}/unfollow`, {
      method: "POST", headers: headers(key),
      signal: AbortSignal.timeout(15000),
    }))
  }

  return NextResponse.json({ error: "Unknown action" })
}
