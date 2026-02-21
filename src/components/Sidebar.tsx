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

function ConvoItem({
  convo, isActive, onSwitch, onDelete, onRename,
}: {
  convo: Conversation
  isActive: boolean
  onSwitch: () => void
  onDelete: () => void
  onRename: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(convo.title)
  const [hovering, setHovering] = useState(false)

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== convo.title) onRename(trimmed)
    setEditing(false)
  }

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
        isActive
          ? "bg-rim2 border border-rim2"
          : "hover:bg-ink3 border border-transparent"
      }`}
      onClick={() => !editing && onSwitch()}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gold rounded-full" />
      )}

      <div className="flex-1 min-w-0 pl-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") { setDraft(convo.title); setEditing(false) }
              e.stopPropagation()
            }}
            onClick={e => e.stopPropagation()}
            className="w-full bg-rim2 text-text1 text-xs rounded px-1.5 py-0.5 outline-none border border-gold/40"
          />
        ) : (
          <p className={`text-xs truncate leading-5 ${isActive ? "text-text1" : "text-text2"}`}>
            {convo.title}
          </p>
        )}
        <p className="text-[10px] text-fog mt-0.5">{timeAgo(convo.updatedAt)}</p>
      </div>

      {/* Action buttons — show on hover */}
      {(hovering || isActive) && !editing && (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setDraft(convo.title); setEditing(true) }}
            className="text-fog hover:text-mist text-[11px] px-1 py-0.5 rounded transition-colors"
            title="Rename"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="text-fog hover:text-red-400 text-[11px] px-1 py-0.5 rounded transition-colors"
            title="Delete"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    conversations, activeId,
    newConversation, switchConversation, deleteConversation, renameConversation,
  } = useChatStore()

  const handleNew = () => {
    newConversation()
    onClose()
  }

  const handleSwitch = (id: string) => {
    switchConversation(id)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-40 w-72 bg-ink2 border-r border-rim flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-rim">
          <span className="font-serif text-lg text-text1">Conversations</span>
          <button
            onClick={onClose}
            className="text-fog hover:text-mist text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 py-3">
          <button
            onClick={handleNew}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-rim hover:border-gold/40 hover:bg-ink3 text-xs text-mist hover:text-gold transition-all"
          >
            <span className="text-base leading-none">+</span>
            New conversation
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-xs text-fog text-center mt-8 px-4">
              No conversations yet.<br />Start chatting to create one.
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
        <div className="px-4 py-3 border-t border-rim">
          <p className="text-[10px] text-fog text-center">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </>
  )
}
