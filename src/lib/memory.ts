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

export async function memorize(question: string, answer: string): Promise<void> {
  try {
    const vec   = await embed(question)
    if (!vec.length) return
    const index = getIndex()
    await index.upsert([{
      id: crypto.randomUUID(),
      values: vec,
      metadata: { q: question, answer: answer.slice(0, 600), type: "qa", ts: new Date().toISOString() }
    }])
  } catch { /* silent */ }
}
