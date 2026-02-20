"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const match  = /language-(\w+)/.exec(className || "")
          const inline = !match
          return inline ? (
            <code
              className="bg-ink2 text-gold px-1.5 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          ) : (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              className="rounded-lg border border-rim text-sm my-2"
              customStyle={{ background: "#111118", margin: 0 }}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
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
