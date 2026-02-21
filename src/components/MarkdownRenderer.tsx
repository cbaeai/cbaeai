"use client"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(code) } catch {
      const el = document.createElement("textarea")
      el.value = code; document.body.appendChild(el); el.select()
      document.execCommand("copy"); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-all
        ${copied ? "bg-[#4ecdc4]/15 border-[#4ecdc4]/30 text-[#4ecdc4]" : "bg-[#252525] border-[#3a3a3a] text-[#8e8e8e] hover:text-[#b4b4b4] hover:border-[#454545]"}`}
    >
      {copied ? (
        <><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied</>
      ) : (
        <><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>Copy</>
      )}
    </button>
  )
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const match  = /language-(\w+)/.exec(className || "")
          const inline = !match
          const code   = String(children).replace(/\n$/, "")

          return inline ? (
            <code className="bg-[#2a2a2a] border border-[#3a3a3a] text-[#e8c77d] px-1.5 py-0.5 rounded text-[0.875em] font-mono" {...props}>
              {children}
            </code>
          ) : (
            <div className="relative group my-3">
              {match[1] && (
                <div className="flex items-center justify-between bg-[#252525] border border-[#333] border-b-0 rounded-t-lg px-4 py-2">
                  <span className="text-[11px] font-mono text-[#666] uppercase tracking-widest">{match[1]}</span>
                  <CodeCopyButton code={code} />
                </div>
              )}
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match?.[1]}
                PreTag="div"
                customStyle={{
                  background: "#1e1e1e",
                  margin: 0,
                  padding: "1em 1.2em",
                  borderRadius: match?.[1] ? "0 0 8px 8px" : "8px",
                  border: "1px solid #333",
                  fontSize: "0.875em",
                }}
              >
                {code}
              </SyntaxHighlighter>
              {!match?.[1] && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                  <CodeCopyButton code={code} />
                </div>
              )}
            </div>
          )
        },
        p:          ({ children }) => <p className="text-[#ececec] leading-[1.72] text-sm mb-[0.85em] last:mb-0">{children}</p>,
        strong:     ({ children }) => <strong className="font-semibold text-[#ececec]">{children}</strong>,
        em:         ({ children }) => <em className="italic">{children}</em>,
        a:          ({ children, href }) => <a href={href} target="_blank" rel="noopener" className="text-[#7eb8f7] underline underline-offset-2 hover:text-[#a8d4ff] transition-colors">{children}</a>,
        ul:         ({ children }) => <ul className="list-disc pl-5 text-sm text-[#ececec] space-y-1 mb-[0.85em]">{children}</ul>,
        ol:         ({ children }) => <ol className="list-decimal pl-5 text-sm text-[#ececec] space-y-1 mb-[0.85em]">{children}</ol>,
        li:         ({ children }) => <li className="text-[#ececec] text-sm leading-relaxed">{children}</li>,
        blockquote: ({ children }) => <blockquote className="border-l-[3px] border-[#3a3a3a] pl-4 text-[#8e8e8e] italic my-3">{children}</blockquote>,
        h1:         ({ children }) => <h1 className="text-[1.2em] font-semibold text-[#ececec] mt-[1.1em] mb-[0.45em]">{children}</h1>,
        h2:         ({ children }) => <h2 className="text-[1.08em] font-semibold text-[#ececec] mt-[1.1em] mb-[0.45em]">{children}</h2>,
        h3:         ({ children }) => <h3 className="text-[1em] font-semibold text-[#ececec] mt-[1em] mb-[0.4em]">{children}</h3>,
        hr:         ()             => <hr className="border-none border-t border-[#333] my-4" />,
        table:      ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse">{children}</table></div>,
        th:         ({ children }) => <th className="bg-[#252525] border border-[#333] px-3 py-2 text-left font-medium text-[#b4b4b4]">{children}</th>,
        td:         ({ children }) => <td className="border border-[#333] px-3 py-2 text-[#ececec]">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
