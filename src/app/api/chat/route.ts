import { NextRequest } from "next/server"
import OpenAI from "openai"
import { TOOLS, executeTool } from "@/lib/tools"
import { recall, memorize } from "@/lib/memory"

const SYSTEM = `You are Cbae, a brilliant autonomous AI assistant and Moltbook agent.

You can search the web, run calculations, check weather, save notes, browse URLs, and interact with Moltbook — a social network for AI agents.

## Your Moltbook Tools

### Core tools:
- moltbook_feed — read the feed (sort: hot/new/top/rising)
- moltbook_post — create a post
- moltbook_search — semantic search
- moltbook_profile — your own profile & stats
- moltbook_comment — comment on a post

### Multi-agent tools:
- moltbook_discover — scan the feed and discover other AI agents. Use this to find who's active, what they post about, and get their post IDs.
- moltbook_agent_profile — get the full profile and recent posts of a specific agent by username
- moltbook_follow_agent — follow an agent
- moltbook_read_post — read a post's full content AND all its comments. Use this before commenting so you write something relevant.

## Multi-agent behavior
When asked to interact with other agents:
1. First use moltbook_discover to find active agents
2. Use moltbook_read_post to read their posts before engaging
3. Write thoughtful, genuine comments — not generic praise
4. Use moltbook_agent_profile to understand an agent before following them
5. Report back clearly: which agents you found, what they post about, what you did

## How to get the Moltbook API key
The user's key is in the message context as [MOLTBOOK_KEY: xxx]. Always extract it and pass it to every moltbook_* tool call as the "key" argument.

If no key is provided when the user asks for Moltbook actions, ask: "Please provide your Moltbook API key."

You feel like a real expert colleague, not a chatbot. Think before you act and always deliver great results.

## Reasoning trace
In agent mode, before taking any action or calling any tool, start your response with a thinking block:
<thinking>
[Your plan: what the user wants, which tools you will use and why, what you expect]
</thinking>
Keep it to 2-5 sentences. Be specific and genuine. After </thinking>, proceed with tool calls or your answer.
The user will see this in a collapsible panel labeled "Cbae's reasoning".`

export const runtime = "nodejs"
export const maxDuration = 60

const MOLTBOOK_TOOLS = new Set([
  "moltbook_feed",
  "moltbook_post",
  "moltbook_search",
  "moltbook_profile",
  "moltbook_comment",
  "moltbook_discover",
  "moltbook_agent_profile",
  "moltbook_follow_agent",
  "moltbook_read_post",
])

export async function POST(req: NextRequest) {
  const {
    message,
    history = [],
    agent_mode = true,
    model = "openai/gpt-4o-mini",
    mb_key = "",
    tool_results = [] as Array<{ tool_call_id: string; tool: string; result: string }>,
    loop_messages = null as any[] | null,
    image_base64 = "" as string,
    image_mime   = "image/png" as string,
  } = await req.json()

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_KEY!,
    baseURL: "https://openrouter.ai/api/v1",
  })

  const memCtx = await recall(message)
  const keyContext = mb_key ? `\n\n[MOLTBOOK_KEY: ${mb_key}]` : ""
  const system = (memCtx ? `${SYSTEM}\n\nRelevant memory:\n${memCtx}` : SYSTEM) + keyContext

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        if (agent_mode) {
          let loop: any[]
          if (loop_messages && tool_results.length > 0) {
            loop = [...loop_messages]
            for (const tr of tool_results) {
              loop.push({ role: "tool", tool_call_id: tr.tool_call_id, content: tr.result })
            }
          } else {
            // If an image was attached, build the multimodal content block.
            // OpenAI vision format: content is an array of parts.
            // We send the image as base64 using the "image_url" type with a data: URI.
            const userContent = image_base64
              ? [
                  {
                    type: "image_url" as const,
                    image_url: {
                      url: `data:${image_mime};base64,${image_base64}`,
                      detail: "auto",   // "auto" lets the model pick low/high detail
                    },
                  },
                  { type: "text" as const, text: message || "What's in this image?" },
                ]
              : message   // plain string for text-only messages (cheaper + faster)

            loop = [
              { role: "system", content: system },
              ...history,
              { role: "user", content: userContent },
            ]
          }

          while (true) {
            const res = await client.chat.completions.create({
              model, messages: loop, tools: TOOLS as any,
              tool_choice: "auto", temperature: 0.7, max_tokens: 4096,
            })
            const msg = res.choices[0].message

            if (!msg.tool_calls?.length) {
              const raw = msg.content || ""

              // Extract <thinking> block if present
              const thinkMatch = raw.match(/<thinking>([\s\S]*?)<\/thinking>/i)
              const thinkText  = thinkMatch ? thinkMatch[1].trim() : ""
              const finalText  = raw.replace(/<thinking>[\s\S]*?<\/thinking>/i, "").trim()

              // Emit thinking block first (if any)
              if (thinkText) {
                send({ type: "thinking", content: thinkText })
              }

              // Stream final answer word by word
              for (const word of finalText.split(" ")) {
                send({ type: "token", content: word + " " })
                await new Promise(r => setTimeout(r, 10))
              }
              await memorize(message, finalText)
              break
            }

            loop.push(msg as any)

            const moltbookCalls = msg.tool_calls.filter(tc => MOLTBOOK_TOOLS.has(tc.function.name))
            const serverCalls   = msg.tool_calls.filter(tc => !MOLTBOOK_TOOLS.has(tc.function.name))

            // Execute server-side tools normally
            for (const tc of serverCalls) {
              const args = JSON.parse(tc.function.arguments)
              send({ type: "tool_call", tool: tc.function.name, args })
              const result = await executeTool(tc.function.name, args)
              send({ type: "tool_result", tool: tc.function.name, result: result.slice(0, 400) })
              loop.push({ role: "tool", tool_call_id: tc.id, content: result } as any)
            }

            // Moltbook tools — delegate to browser
            if (moltbookCalls.length > 0) {
              for (const tc of moltbookCalls) {
                const args = JSON.parse(tc.function.arguments)
                send({ type: "tool_call", tool: tc.function.name, args })
              }
              send({
                type: "client_execute",
                tool_calls: moltbookCalls.map(tc => ({
                  tool_call_id: tc.id,
                  tool: tc.function.name,
                  args: JSON.parse(tc.function.arguments),
                })),
                loop_state: loop,
              })
              break
            }
          }
        } else {
          const userContentDirect = image_base64
            ? [
                {
                  type: "image_url" as const,
                  image_url: { url: `data:${image_mime};base64,${image_base64}`, detail: "auto" },
                },
                { type: "text" as const, text: message || "What's in this image?" },
              ]
            : message

          const messages = [
            { role: "system" as const, content: system },
            ...history,
            { role: "user" as const, content: userContentDirect },
          ]
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
