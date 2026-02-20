import { Pinecone } from "@pinecone-database/pinecone"

const SIMILARITY_THRESHOLD = 0.75

function getIndex() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_KEY! })
  return pc.index(process.env.PINECONE_INDEX || "cbae-memory")
}

// Simple embedding via free API
async function embed(text: string): Promise<number[]> {
  // Use OpenRouter/OpenAI embedding
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "openai/text-embedding-ada-002", input: text }),
  })
  const data = await res.json()
  return data.data?.[0]?.embedding || []
}

export async function recall(query: string): Promise<string> {
  // Skip Pinecone for very short messages — not worth the latency
  if (query.trim().split(/\s+/).length < 10) return ""
  try {
    const vec = await embed(query)
    if (!vec.length) return ""
    const index = getIndex()
    const res   = await index.query({ vector: vec, topK: 5, includeMetadata: true })
    const hits  = res.matches?.filter(m => (m.score || 0) >= SIMILARITY_THRESHOLD) || []
    if (!hits.length) return ""
    return "Relevant memory:\n" + hits.map(h =>
      `Q: ${(h.metadata?.q as string || "").slice(0, 80)} → A: ${(h.metadata?.answer as string || "").slice(0, 120)}`
    ).join("\n")
  } catch { return "" }
}

// Strip any leaked API key patterns before persisting to Pinecone
function sanitizeForMemory(text: string): string {
  return text
    .replace(/\[MOLTBOOK_KEY:\s*[^\]]+\]/gi, "[MOLTBOOK_KEY: redacted]")
    .replace(/Bearer\s+[A-Za-z0-9\-_]{20,}/g, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9]{20,}/g, "[key-redacted]")
}

export async function memorize(question: string, answer: string): Promise<void> {
  try {
    const safeQ   = sanitizeForMemory(question)
    const safeA   = sanitizeForMemory(answer)
    const vec     = await embed(safeQ)
    if (!vec.length) return
    const index   = getIndex()
    // Use a stable hash of the question as ID so upserting the same fact
    // overwrites the old record instead of creating duplicates
    const stableId = Buffer.from(safeQ.trim().toLowerCase().slice(0, 200)).toString("base64url").slice(0, 64)
    await index.upsert([{
      id: stableId,
      values: vec,
      metadata: { q: safeQ, answer: safeA.slice(0, 600), type: "qa", ts: new Date().toISOString() }
    }])
  } catch { /* silent */ }
}
