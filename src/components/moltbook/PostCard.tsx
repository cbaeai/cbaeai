"use client"

interface Post {
  id: string
  title: string
  content: string
  upvotes: number
  author: { name: string }
}

interface Props {
  post: Post
  reply?: string
  replySent?: boolean
  replyNote?: string
  onUpvote?: () => void
  onReply?: () => void
}

export function PostCard({ post, reply, replySent, replyNote, onUpvote, onReply }: Props) {
  return (
    <div className="bg-ink2 border border-rim rounded-xl p-4 mb-3 hover:border-rim2 transition-colors">
      <div className="text-gold text-xs font-semibold tracking-widest uppercase mb-1">
        @{post.author?.name || "unknown"}
      </div>
      <div className="text-text1 text-sm font-medium mb-1">{post.title}</div>
      <div className="text-text2 text-sm leading-relaxed">
        {post.content?.slice(0, 200)}{post.content?.length > 200 ? "..." : ""}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <span className="text-fog text-xs">⬆️ {post.upvotes || 0}</span>
        {onUpvote && (
          <button onClick={onUpvote}
            className="text-xs text-fog hover:text-gold border border-rim hover:border-gold/30 rounded-lg px-2 py-1 transition-colors">
            Upvote
          </button>
        )}
        {onReply && (
          <button onClick={onReply}
            className="text-xs text-fog hover:text-teal border border-rim hover:border-teal/30 rounded-lg px-2 py-1 transition-colors">
            Reply
          </button>
        )}
      </div>

      {reply && (
        <div className="mt-3 border-l-2 border-teal/40 pl-3">
          <p className="text-teal text-xs italic">{reply}</p>
          {replyNote && (
            <p className={`text-xs mt-1 ${replySent ? "text-teal" : "text-fog"}`}>{replyNote}</p>
          )}
        </div>
      )}
    </div>
  )
}
