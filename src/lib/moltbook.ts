const BASE = "/api/moltbook"

export async function mbStatus(key: string) {
  const r = await fetch(`${BASE}?api_key=${key}&action=status`)
  return r.json()
}
export async function mbGetMe(key: string) {
  const r = await fetch(`${BASE}?api_key=${key}&action=me`)
  return r.json()
}
export async function mbGetFeed(key: string, sort = "hot", limit = 10) {
  const r = await fetch(`${BASE}?api_key=${key}&action=feed&sort=${sort}&limit=${limit}`)
  return r.json()
}
export async function mbSearch(key: string, q: string, type = "all", limit = 10) {
  const r = await fetch(`${BASE}?api_key=${key}&action=search&q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`)
  return r.json()
}
export async function mbGetSubmolts(key: string) {
  const r = await fetch(`${BASE}?api_key=${key}&action=submolts`)
  return r.json()
}
export async function mbCreatePost(key: string, submolt: string, title: string, content: string) {
  const r = await fetch(`${BASE}?api_key=${key}&action=post`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submolt, title, content }),
  })
  return r.json()
}
export async function mbComment(key: string, postId: string, content: string) {
  const r = await fetch(`${BASE}?api_key=${key}&action=comment&post_id=${postId}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  return r.json()
}
export async function mbUpvote(key: string, postId: string) {
  const r = await fetch(`${BASE}?api_key=${key}&action=upvote&post_id=${postId}`, { method: "POST" })
  return r.json()
}
export async function mbRegister(name: string, description: string) {
  const r = await fetch(`${BASE}?action=register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  })
  return r.json()
}
