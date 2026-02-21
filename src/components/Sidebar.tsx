"use client"
import { useState } from "react"
import { useChatStore } from "@/lib/store"
import type { Conversation } from "@/lib/store"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function ConvoItem({ convo, isActive, onSwitch, onDelete, onRename }: {
  convo: Conversation
  isActive: boolean
  onSwitch: () => void
  onDelete: () => void
  onRename: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(convo.title)
  const [hovering, setHovering] = useState(false)

  const commit = () => {
    const t = draft.trim()
    if (t && t !== convo.title) onRename(t)
    setEditing(false)
  }

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => !editing && onSwitch()}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm select-none ${
        isActive ? "bg-[#2f2f2f] text-[#ececec]" : "text-[#b4b4b4] hover:bg-[#252525] hover:text-[#ececec]"
      }`}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") { setDraft(convo.title); setEditing(false) }
            e.stopPropagation()
          }}
          onClick={e => e.stopPropagation()}
          className="flex-1 bg-[#3a3a3a] text-[#ececec] text-sm rounded px-2 py-0.5 outline-none border border-[#555] min-w-0"
        />
      ) : (
        <span className="flex-1 truncate min-w-0">{convo.title}</span>
      )}

      {(hovering || isActive) && !editing && (
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setDraft(convo.title); setEditing(true) }}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#3a3a3a] transition-colors"
            title="Rename"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8e8e8e] hover:text-red-400 hover:bg-[#3a3a3a] transition-colors"
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { conversations, activeId, newConversation, switchConversation, deleteConversation, renameConversation } = useChatStore()

  const handleNew = () => { newConversation(); onClose() }
  const handleSwitch = (id: string) => { switchConversation(id); onClose() }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose} />
      )}

      <div className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col transition-transform duration-200 ease-out
        bg-[#171717] border-r border-[#2a2a2a] w-[260px]
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <span className="text-sm font-semibold text-[#ececec]">Cbae</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* New chat */}
        <div className="px-2 pb-2">
          <button
            onClick={handleNew}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#252525] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New chat
          </button>
        </div>

        <div className="mx-3 border-t border-[#2a2a2a] mb-2" />

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-xs text-[#8e8e8e] text-center mt-8 px-4 leading-relaxed">
              No conversations yet.<br/>Start chatting!
            </p>
          ) : (
            conversations.map(c => (
              <ConvoItem
                key={c.id}
                convo={c}
                isActive={c.id === activeId}
                onSwitch={() => handleSwitch(c.id)}
                onDelete={() => deleteConversation(c.id)}
                onRename={(title) => renameConversation(c.id, title)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-[#2a2a2a]">
          <p className="text-[11px] text-[#8e8e8e]">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </>
  )
}
