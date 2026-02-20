import { NextRequest, NextResponse } from "next/server"

const MB = "https://www.moltbook.com/api/v1"

function headers(key: string) {
  return { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }
}

async function safeRequest(fn: () => Promise<Response>) {
  try {
    const r = await fn()
    return NextResponse.json(await r.json())
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Request failed" })
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
    const q    = searchParams.get("q")    || ""
    const type = searchParams.get("type") || "all"
    const limit = searchParams.get("limit") || "10"
    return safeRequest(() => fetch(`${MB}/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`, { headers: headers(key), signal: AbortSignal.timeout(15000) }))
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

  return NextResponse.json({ error: "Unknown action" })
}
