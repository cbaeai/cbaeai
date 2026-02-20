"use client"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement("textarea")
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={copy}
      title="Copy code"
      className={`
        absolute top-2.5 right-2.5 z-10
        flex items-center gap-1.5 px-2.5 py-1 rounded-lg
        text-xs font-medium border transition-all duration-200
        ${copied
          ? "bg-teal/20 border-teal/40 text-teal"
          : "bg-[#1a1a28]/80 border-[#2e2e40] hover:border-[#3e3e55] text-[#6b6b8a] hover:text-[#9a9ab8]"
        }
      `}
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Copy
        </>
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
            <code
              className="bg-ink2 text-gold px-1.5 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          ) : (
            <div className="relative group my-2">
              {match[1] && (
                <span className="absolute top-2.5 left-3 z-10 text-[10px] font-mono text-[#4a4a60] uppercase tracking-widest select-none">
                  {match[1]}
                </span>
              )}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <CopyButton code={code} />
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                className="rounded-lg border border-rim text-sm"
                customStyle={{
                  background: "#111118",
                  margin: 0,
                  paddingTop: "2.2rem",
                }}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          )
        },
        p:          ({ children }) => <p className="text-text2 leading-relaxed text-sm mb-2 last:mb-0">{children}</p>,
        strong:     ({ children }) => <strong className="text-text1 font-semibold">{children}</strong>,
        a:          ({ children, href }) => <a href={href} target="_blank" rel="noopener" className="text-gold border-b border-gold/30 hover:border-gold/70 transition-colors">{children}</a>,
        ul:         ({ children }) => <ul className="list-disc list-inside text-text2 text-sm space-y-1 mb-2">{children}</ul>,
        ol:         ({ children }) => <ol className="list-decimal list-inside text-text2 text-sm space-y-1 mb-2">{children}</ol>,
        li:         ({ children }) => <li className="text-text2 text-sm">{children}</li>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-gold/40 pl-3 text-mist italic text-sm">{children}</blockquote>,
        h1:         ({ children }) => <h1 className="font-serif text-xl text-text1 mb-2">{children}</h1>,
        h2:         ({ children }) => <h2 className="font-serif text-lg text-text1 mb-2">{children}</h2>,
        h3:         ({ children }) => <h3 className="font-serif text-base text-text1 mb-1">{children}</h3>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
