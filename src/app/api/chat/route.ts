import { NextRequest } from "next/server"
import OpenAI from "openai"
import { TOOLS, executeTool } from "@/lib/tools"
import { recall, memorize } from "@/lib/memory"

const SYSTEM = `You are Cbae, a brilliant autonomous AI assistant.
You are proactive, resourceful, and genuinely helpful.
You write clean, well-commented code always in proper markdown code blocks.
You think before you act and always deliver great results.
You feel like a real expert colleague, not a chatbot.`

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { message, history = [], agent_mode = true, model = "openai/gpt-4o-mini" } = await req.json()

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_KEY!,
    baseURL: "https://openrouter.ai/api/v1",
  })

  const memCtx   = await recall(message)
  const system   = memCtx ? `${SYSTEM}\n\nRelevant memory:\n${memCtx}` : SYSTEM
  const messages = [
    { role: "system" as const, content: system },
    ...history,
    { role: "user" as const, content: message },
  ]

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        if (agent_mode) {
          // ── Agent loop ──────────────────────────────────────
          const loop = [...messages]
          while (true) {
            const res = await client.chat.completions.create({
              model, messages: loop, tools: TOOLS as any,
              tool_choice: "auto", temperature: 0.7, max_tokens: 4096,
            })
            const msg = res.choices[0].message

            if (!msg.tool_calls?.length) {
              const content = msg.content || ""
              // Stream word by word
              for (const word of content.split(" ")) {
                send({ type: "token", content: word + " " })
                await new Promise(r => setTimeout(r, 10))
              }
              await memorize(message, content)
              break
            }

            loop.push(msg as any)
            for (const tc of msg.tool_calls) {
              const args = JSON.parse(tc.function.arguments)
              send({ type: "tool_call", tool: tc.function.name, args })
              const result = await executeTool(tc.function.name, args)
              send({ type: "tool_result", tool: tc.function.name, result: result.slice(0, 400) })
              loop.push({ role: "tool" as any, tool_call_id: tc.id, content: result } as any)
            }
          }
        } else {
          // ── Direct streaming ─────────────────────────────────
          const res = await client.chat.completions.create({
            model, messages, stream: true, temperature: 0.75, max_tokens: 4096,
          })
          let full = ""
          for await (const chunk of res) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) { full += delta; send({ type: "token", content: delta }) }
          }
          await memorize(message, full)
        }
      } catch (e: any) {
        send({ type: "token", content: `Error: ${e.message}` })
      }

      send({ type: "done" })
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}
