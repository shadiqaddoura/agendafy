'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { createGoogleProvider, getFirebaseClientAuth } from '@/lib/firebase-client'

type Priority = 'low' | 'medium' | 'high'

type QuickNote = {
  id: string
  text: string
  completed: boolean
  createdAt: number
}

type Group = {
  id: string
  name: string
}

type Todo = {
  id: string
  text: string
  completed: boolean
  date: string // YYYY-MM-DD or ''
  priority: Priority
  tags: string[]
  groupId?: string
  createdAt: number
  sortOrder?: number
}

// Deterministic pastel color from tag string
function tagColor(tag: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return { bg: `hsl(${hue},55%,88%)`, text: `hsl(${hue},50%,32%)` }
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#6bcb77',
  medium: '#ffd166',
  high: '#ef476f',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High!',
}

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() {
  return localDateStr(new Date())
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return localDateStr(d)
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return localDateStr(d)
}

function pageLabel(dateStr: string): string {
  const today = todayStr()
  const tomorrow = tomorrowStr()
  const yesterday = shiftDate(today, -1)
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function pageSubLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Hand-drawn SVG Icons ────────────────────────────────────────────────────

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7.5 C3.5 9.2 4.8 10.5 5.5 11 C7 8.5 9.5 5.8 12 3.5" />
    </svg>
  )
}

function IconClose({ size = 11, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M2 2 L9 9" />
      <path d="M9 2 L2 9" />
    </svg>
  )
}

function IconFolder({ size = 17, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 18" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 5.5 L1.5 15 C1.5 15.8 2.2 16.5 3 16.5 L17 16.5 C17.8 16.5 18.5 15.8 18.5 15 L18.5 7.5 C18.5 6.7 17.8 6 17 6 L9.5 6 L7.5 4 L3 4 C2.2 4 1.5 4.7 1.5 5.5 Z" />
    </svg>
  )
}

function IconNotebook({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6 C9 6 8 7 8 8 L8 48 C8 49 9 50 10 50 L46 50 C47 50 48 49 48 48 L48 8 C48 7 47 6 46 6 Z" />
      <path d="M17 6 L17 50" />
      <path d="M23 18 L42 18" />
      <path d="M23 27 L42 27" />
      <path d="M23 36 L42 36" />
      <path d="M10 14 L17 14" />
      <path d="M10 22 L17 22" />
      <path d="M10 30 L17 30" />
    </svg>
  )
}

function IconTag({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5 L5 23 C5 24.5 5.5 25.5 6.5 26.5 L26 46 C27.5 47.5 30 47.5 31.5 46 L46 31.5 C47.5 30 47.5 27.5 46 26 L26.5 6.5 C25.5 5.5 24.5 5 23 5 Z" />
      <circle cx="14" cy="14" r="3" />
    </svg>
  )
}

function IconClipboard({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 L3 4 C2.5 4 2 4.5 2 5 L2 20 C2 20.5 2.5 21 3 21 L17 21 C17.5 21 18 20.5 18 20 L18 5 C18 4.5 17.5 4 17 4 L13 4" />
      <path d="M7 1.5 C7 1 7.5 1 8 1 L12 1 C12.5 1 13 1 13 1.5 L13 4 L7 4 Z" />
      <path d="M6 11 L14 11" />
      <path d="M6 15 L14 15" />
    </svg>
  )
}

function IconArrowLeft({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 4 C11 6.5 8 10 6.5 10 C8 10 11 13.5 13.5 16" />
    </svg>
  )
}

function IconArrowRight({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 4 C9 6.5 12 10 13.5 10 C12 10 9 13.5 6.5 16" />
    </svg>
  )
}

function IconGoogle({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.57-5.15 3.57-8.65Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.86-3c-1.07.72-2.44 1.15-4.09 1.15-3.15 0-5.82-2.13-6.78-5H1.22v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.22 14.25A7.2 7.2 0 0 1 4.84 12c0-.78.13-1.54.38-2.25V6.66H1.22A12 12 0 0 0 0 12c0 1.94.46 3.78 1.22 5.34l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.78l3.43-3.43C17.96 1.19 15.24 0 12 0A12 12 0 0 0 1.22 6.66l4 3.09c.96-2.87 3.63-5 6.78-5Z" />
    </svg>
  )
}

type SortableTodoItemProps = {
  todo: Todo
  editingId: string | null
  editText: string
  editDate: string
  editPriority: Priority
  editTags: string[]
  editTagText: string
  editTagDropdownOpen: boolean
  editTagInputRef: React.RefObject<HTMLInputElement | null>
  allTags: string[]
  groups: Group[]
  editGroupId: string
  activeTagFilter: string | null
  onEditGroupChange: (groupId: string) => void
  isDragOverlay?: boolean
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onStartEdit: (todo: Todo) => void
  onSaveEdit: (id: string) => void
  onEditTextChange: (text: string) => void
  onEditDateChange: (date: string) => void
  onEditPriorityChange: (p: Priority) => void
  onEditTagsChange: (tags: string[]) => void
  onEditTagTextChange: (text: string) => void
  onEditTagDropdownToggle: (open: boolean) => void
  onCancelEdit: () => void
  onTagFilterToggle: (tag: string) => void
  isMobile?: boolean
}

function SortableTodoItem({
  todo,
  editingId,
  editText,
  editDate,
  editPriority,
  editTags,
  editTagText,
  editTagDropdownOpen,
  editTagInputRef,
  allTags,
  groups,
  editGroupId,
  activeTagFilter,
  onEditGroupChange,
  isDragOverlay = false,
  onToggle,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onEditTextChange,
  onEditDateChange,
  onEditPriorityChange,
  onEditTagsChange,
  onEditTagTextChange,
  onEditTagDropdownToggle,
  onCancelEdit,
  onTagFilterToggle,
  isMobile = false,
}: SortableTodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })
  const isEditing = editingId === todo.id
  const lastTapRef = useRef<number>(0)

  function handleTap(e: React.TouchEvent) {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      e.preventDefault()
      if (!todo.completed && !isEditing) onStartEdit(todo)
    }
    lastTapRef.current = now
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        borderRadius: 0,
        background: isDragOverlay ? 'rgba(255,255,255,0.5)' : isEditing ? 'rgba(255,255,255,0.5)' : 'transparent',
        boxShadow: isDragOverlay ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
      }}
      onMouseEnter={e => { if (!isDragOverlay && !isEditing) e.currentTarget.style.background = 'oklch(97% 0.006 80)' }}
      onMouseLeave={e => { if (!isDragOverlay && !isEditing) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '6px 6px', cursor: 'default', borderBottom: '1px solid var(--border)' }}>
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          color: 'var(--border)',
          fontSize: 14,
          flexShrink: 0,
          lineHeight: 1,
          padding: '0 2px',
          userSelect: 'none',
          touchAction: 'none',
        }}
        title="Drag to reorder"
      >
        ⠿
      </div>

      {/* Priority dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: PRIORITY_COLORS[todo.priority],
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />

      {/* Checkbox */}
      <div
        onClick={() => onToggle(todo.id)}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: todo.completed ? '2px solid #4db86a' : '2px solid #4db86a',
          background: todo.completed ? '#4db86a' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.2s',
          fontSize: 14,
          color: '#fff',
        }}
      >
        {todo.completed ? <IconCheck /> : null}
      </div>

      {/* Text / Edit */}
      {isEditing ? (
        <input
          autoFocus
          value={editText}
          onChange={e => onEditTextChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSaveEdit(todo.id)
            if (e.key === 'Escape') onCancelEdit()
          }}
          style={{
            flex: 1,
            border: 'none',
            borderBottom: '2px solid var(--fg)',
            outline: 'none',
            background: 'transparent',
            fontSize: 16,
            fontFamily: 'var(--font-task)',
            color: 'var(--fg)',
          }}
        />
      ) : (
        <span
          onDoubleClick={() => !todo.completed && onStartEdit(todo)}
          onTouchEnd={handleTap}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'var(--font-task)',
            fontSize: 16,
            color: todo.completed ? 'var(--muted)' : 'var(--fg)',
            cursor: todo.completed ? 'default' : 'text',
            wordBreak: 'break-word',
            transition: 'color 0.2s',
            textDecorationLine: todo.completed ? 'line-through' : 'none',
            textDecorationColor: 'rgba(107,203,119,0.5)',
            textDecorationThickness: 2,
          }}
        >
          {todo.text}
        </span>
      )}

      {/* Tags (only when not editing, only on desktop) */}
      {!isEditing && !isMobile && todo.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
          {todo.tags.map(tag => {
            const { bg, text } = tagColor(tag)
            return (
              <span
                key={tag}
                onClick={() => onTagFilterToggle(tag)}
                title={`Filter by #${tag}`}
                style={{
                  background: bg,
                  color: text,
                  borderRadius: 2,
                  padding: '1px 7px',
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: todo.completed ? 0.5 : 1,
                  border: activeTagFilter === tag ? `1.5px solid ${text}` : '1.5px solid transparent',
                  transition: 'border 0.15s',
                }}
              >
                #{tag}
              </span>
            )
          })}
        </div>
      )}

      {!isEditing && !isMobile && todo.groupId && (() => {
        const g = groups.find(g => g.id === todo.groupId)
        return g ? (
          <span style={{ fontSize: 12, color: 'var(--muted)', background: 'oklch(97% 0.006 80)', borderRadius: 2, padding: '1px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconFolder size={13} color="var(--border)" /> {g.name}
            </span>
        ) : null
      })()}

      {/* Delete (only when not editing) */}
      {!isEditing && (
        <button
          onClick={() => onDelete(todo.id)}
          title="Delete"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--border)',
            fontSize: 14,
            flexShrink: 0,
            lineHeight: 1,
            padding: '0 4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--high)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
        >
          <IconClose size={10} />
        </button>
      )}
    </div>

    {/* Mobile: tags and group badge on their own row */}
    {isMobile && !isEditing && (todo.tags.length > 0 || todo.groupId) && (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: '0 6px 6px 64px' }}>
        {todo.tags.map(tag => {
          const { bg, text } = tagColor(tag)
          return (
            <span
              key={tag}
              onClick={() => onTagFilterToggle(tag)}
              title={`Filter by #${tag}`}
              style={{
                background: bg,
                color: text,
                borderRadius: 2,
                padding: '1px 7px',
                fontSize: 13,
                cursor: 'pointer',
                opacity: todo.completed ? 0.5 : 1,
                border: activeTagFilter === tag ? `1.5px solid ${text}` : '1.5px solid transparent',
                transition: 'border 0.15s',
              }}
            >
              #{tag}
            </span>
          )
        })}
        {todo.groupId && (() => {
          const g = groups.find(g => g.id === todo.groupId)
          return g ? (
            <span style={{ fontSize: 12, color: 'var(--muted)', background: 'oklch(97% 0.006 80)', borderRadius: 2, padding: '1px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconFolder size={13} color="var(--border)" /> {g.name}
            </span>
          ) : null
        })()}
      </div>
    )}

    {/* Edit metadata row */}
    {isEditing && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: isMobile ? '6px 12px' : '6px 50px',
          flexWrap: 'wrap',
          borderBottom: '1px solid rgba(196,218,245,0.6)',
          background: 'rgba(255,255,255,0.5)',
        }}
      >
        {/* Tag chips */}
        {editTags.map(tag => {
          const { bg, text } = tagColor(tag)
          return (
            <span key={tag} style={{ background: bg, color: text, borderRadius: 2, padding: '2px 8px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              #{tag}
              <button onMouseDown={e => { e.preventDefault(); onEditTagsChange(editTags.filter(t => t !== tag)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: text, fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.7, display: 'flex', alignItems: 'center' }}><IconClose size={9} color={text} /></button>
            </span>
          )
        })}

        {/* Tag input + dropdown */}
        <div style={{ position: 'relative' }}>
          <input
            ref={editTagInputRef}
            type="text"
            value={editTagText}
            onChange={e => { onEditTagTextChange(e.target.value); onEditTagDropdownToggle(true) }}
            onFocus={() => onEditTagDropdownToggle(true)}
            onBlur={() => setTimeout(() => {
              const t = editTagText.trim().toLowerCase().replace(/,/g, '')
              if (t) onEditTagsChange([...new Set([...editTags, t])])
              onEditTagTextChange('')
              onEditTagDropdownToggle(false)
            }, 150)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                e.preventDefault()
                const t = editTagText.trim().toLowerCase().replace(/,/g, '')
                if (t) onEditTagsChange([...new Set([...editTags, t])])
                onEditTagTextChange('')
                onEditTagDropdownToggle(false)
              } else if (e.key === 'Backspace' && !editTagText && editTags.length > 0) {
                onEditTagsChange(editTags.slice(0, -1))
              } else if (e.key === 'Escape') {
                onCancelEdit()
              }
            }}
            placeholder="# tag..."
            style={{ border: 'none', borderBottom: '1.5px dashed var(--border)', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--muted)', width: 70 }}
          />
          {editTagDropdownOpen && (() => {
            const query = editTagText.trim().toLowerCase()
            const suggestions = allTags.filter(t => !editTags.includes(t) && (query === '' || t.includes(query)))
            if (suggestions.length === 0) return null
            return (
              <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 20, marginTop: 4, minWidth: 160, overflow: 'hidden' }}>
                <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>Existing tags</div>
                {suggestions.map(tag => {
                  const { bg, text } = tagColor(tag)
                  return (
                    <div key={tag} onMouseDown={e => { e.preventDefault(); onEditTagsChange([...new Set([...editTags, tag])]); onEditTagTextChange(''); onEditTagDropdownToggle(false); editTagInputRef.current?.focus() }} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg)' }} onMouseEnter={e => (e.currentTarget.style.background = 'oklch(97% 0.006 80)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ background: bg, color: text, borderRadius: 2, padding: '1px 8px', fontSize: 13 }}>#{tag}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Date */}
        <input type="date" value={editDate} onChange={e => onEditDateChange(e.target.value)} style={{ border: 'none', borderBottom: '1.5px dashed var(--border)', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--muted)', padding: '2px 4px', cursor: 'pointer' }} />

        {/* Priority dots */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {(['low', 'medium', 'high'] as Priority[]).map(p => (
            <button key={p} onMouseDown={e => { e.preventDefault(); onEditPriorityChange(p) }} title={PRIORITY_LABELS[p]} style={{ width: 16, height: 16, borderRadius: '50%', border: editPriority === p ? '2.5px solid var(--fg)' : '2px solid transparent', background: PRIORITY_COLORS[p], cursor: 'pointer', transition: 'transform 0.15s', transform: editPriority === p ? 'scale(1.2)' : 'scale(1)', padding: 0 }} />
          ))}
        </div>

        {/* Group */}
        <select
          value={editGroupId}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => onEditGroupChange(e.target.value)}
          style={{ border: 'none', borderBottom: '1.5px dashed var(--border)', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--muted)', padding: '2px 4px', cursor: 'pointer', maxWidth: 130 }}
        >
          <option value="">No group</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {/* Save / Cancel */}
        <button onMouseDown={e => { e.preventDefault(); onSaveEdit(todo.id) }} disabled={!editText.trim()} style={{ marginLeft: 'auto', background: 'var(--fg)', color: 'var(--surface)', border: 'none', borderRadius: 2, padding: '6px 20px', fontSize: 15, fontFamily: 'var(--font-body)', cursor: editText.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, opacity: editText.trim() ? 1 : 0.4 }}>
          Save
        </button>
        <button onMouseDown={e => { e.preventDefault(); onCancelEdit() }} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 2, padding: '5px 14px', fontSize: 15, fontFamily: 'var(--font-body)', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
          Cancel
        </button>
      </div>
    )}
    </div>
  )
}

export default function NotebookTodo() {
  const auth = getFirebaseClientAuth()
  const missingAuthConfig = !auth
  const [todos, setTodos] = useState<Todo[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [inputGroupId, setInputGroupId] = useState<string>('')
  const [editGroupId, setEditGroupId] = useState<string>('')
  const [addGroupName, setAddGroupName] = useState<string>('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState<string>('')
  const [inputText, setInputText] = useState('')
  const [inputDate, setInputDate] = useState(todayStr())
  const [inputPriority, setInputPriority] = useState<Priority>('medium')
  const [inputTags, setInputTags] = useState<string[]>([])
  const [inputTagText, setInputTagText] = useState('')
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editPriority, setEditPriority] = useState<Priority>('medium')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editTagText, setEditTagText] = useState('')
  const [editTagDropdownOpen, setEditTagDropdownOpen] = useState(false)
  const [inlineAddFocused, setInlineAddFocused] = useState(false)
  const [currentPage, setCurrentPage] = useState(todayStr())
  const [showAchievementLogs, setShowAchievementLogs] = useState(false)
  const [quickNotes, setQuickNotes] = useState<QuickNote[]>([])
  const [quickNoteInput, setQuickNoteInput] = useState('')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(missingAuthConfig)
  const [authError, setAuthError] = useState<string | null>(
    missingAuthConfig
      ? 'Missing Firebase web config. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID.'
      : null
  )
  const [signingIn, setSigningIn] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const quickNoteInputRef = useRef<HTMLInputElement>(null)
  const quickNotesRef = useRef<QuickNote[]>([])
  const todosRef = useRef<Todo[]>([])
  const tagInputRef = useRef<HTMLInputElement>(null)
  const editTagInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const authedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!auth?.currentUser) {
      throw new Error('Not authenticated')
    }

    const idToken = await auth.currentUser.getIdToken()
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${idToken}`)

    return fetch(input, {
      ...init,
      headers,
    })
  }, [auth])

  async function handleGoogleSignIn() {
    if (!auth) return
    setSigningIn(true)
    setAuthError(null)
    try {
      const credential = await signInWithPopup(auth, createGoogleProvider())
      const idToken = await credential.user.getIdToken()

      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as { error?: string }
        await signOut(auth)
        throw new Error(errorBody.error ?? 'Google sign-in verification failed')
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setSigningIn(false)
    }
  }

  async function handleSignOut() {
    if (!auth) return
    try {
      await signOut(auth)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to sign out')
    }
  }

  // ─── Quick Notes helpers ──────────────────────────────────────────────────────

  async function addQuickNote() {
    const text = quickNoteInput.trim()
    if (!text) return
    const tempId = crypto.randomUUID()
    const note: QuickNote = { id: tempId, text, completed: false, createdAt: Date.now() }
    setQuickNotes(prev => [note, ...prev])
    setQuickNoteInput('')
    quickNoteInputRef.current?.focus()
    try {
      const res = await authedFetch('/api/quick-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) })
      const data = await res.json()
      if (data.id && data.id !== tempId) {
        setQuickNotes(prev => prev.map(n => n.id === tempId ? { ...n, id: data.id } : n))
      }
    } catch (err) {
      console.error(err)
    }
  }

  function toggleQuickNote(id: string) {
    const existing = quickNotesRef.current.find(n => n.id === id)
    if (!existing) return
    const updated = { ...existing, completed: !existing.completed }
    const nextNotes = quickNotesRef.current.map(n => n.id === id ? updated : n)
    quickNotesRef.current = nextNotes
    setQuickNotes(nextNotes)
    authedFetch(`/api/quick-notes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      .catch(console.error)
  }

  function deleteQuickNote(id: string) {
    setQuickNotes(prev => prev.filter(n => n.id !== id))
    authedFetch(`/api/quick-notes/${id}`, { method: 'DELETE' }).catch(console.error)
  }

  // ─── Drag ─────────────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTodos(prev => {
      const oldIdx = prev.findIndex(t => t.id === active.id)
      const newIdx = prev.findIndex(t => t.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx)
      authedFetch('/api/todos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map(t => t.id) }),
      }).catch(console.error)
      return next
    })
  }

  useEffect(() => {
    if (!auth) return

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setTodos([])
        setGroups([])
        setQuickNotes([])
      }
      setAuthReady(true)
    })

    return () => unsubscribe()
  }, [auth])

  useEffect(() => {
    if (!authReady || !user) return

    let isCancelled = false

    async function loadInitialData() {
      try {
        const [todosRes, groupsRes, quickNotesRes] = await Promise.all([
          authedFetch('/api/todos'),
          authedFetch('/api/groups'),
          authedFetch('/api/quick-notes'),
        ])

        const [todosData, groupsData, quickNotesData] = await Promise.all([
          todosRes.json(),
          groupsRes.json(),
          quickNotesRes.json(),
        ])

        if (!isCancelled) {
          if (Array.isArray(todosData)) setTodos(todosData)
          else console.error('[todos] unexpected response:', todosData)

          if (Array.isArray(groupsData)) setGroups(groupsData)
          else console.error('[groups] unexpected response:', groupsData)

          if (Array.isArray(quickNotesData)) {
            const safeQuickNotes: QuickNote[] = quickNotesData
              .filter((n): n is { id: string; text?: string; completed?: boolean; createdAt?: number } => (
                typeof n === 'object' && n !== null && typeof (n as { id?: unknown }).id === 'string'
              ))
              .map(n => ({
                id: n.id,
                text: typeof n.text === 'string' ? n.text : '',
                completed: Boolean(n.completed),
                createdAt: typeof n.createdAt === 'number' ? n.createdAt : 0,
              }))
            setQuickNotes(safeQuickNotes)
          } else {
            console.error('[quick-notes] unexpected response:', quickNotesData)
          }
        }
      } catch (err) {
        if (!isCancelled) console.error('[initial-load]', err)
      }
    }

    loadInitialData()

    return () => {
      isCancelled = true
    }
  }, [authReady, user, authedFetch])

  useEffect(() => {
    quickNotesRef.current = quickNotes
  }, [quickNotes])

  useEffect(() => {
    todosRef.current = todos
  }, [todos])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function createGroup(name: string): Promise<string> {
    const trimmed = name.trim()
    if (!trimmed) return ''
    const tempId = crypto.randomUUID()
    setGroups(prev => [...prev, { id: tempId, name: trimmed }])
    try {
      const res = await authedFetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) })
      const data = await res.json()
      if (data.id && data.id !== tempId) {
        setGroups(prev => prev.map(g => g.id === tempId ? { ...g, id: data.id } : g))
        // Capture affected todos from the ref before calling setTodos so that
        // the network calls live entirely outside the state updater — updaters
        // must be pure and are invoked twice in React Strict Mode.
        const affected = todosRef.current.filter(t => t.groupId === tempId)
        setTodos(prev => {
          if (!affected.length) return prev
          return prev.map(t => t.groupId === tempId ? { ...t, groupId: data.id } : t)
        })
        affected.forEach(t => {
          authedFetch(`/api/todos/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...t, groupId: data.id }) })
            .catch(console.error)
        })
        // Patch dropdown state that may still hold the temp ID
        setInputGroupId(prev => prev === tempId ? data.id : prev)
        setEditGroupId(prev => prev === tempId ? data.id : prev)
        return data.id
      }
    } catch (err) {
      console.error(err)
    }
    return tempId
  }

  function deleteGroup(id: string) {
    setGroups(prev => prev.filter(g => g.id !== id))
    setTodos(prev => prev.map(t => t.groupId === id ? { ...t, groupId: undefined } : t))
    authedFetch(`/api/groups/${id}`, { method: 'DELETE' }).catch(console.error)
  }

  function renameGroup(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name: trimmed } : g))
    authedFetch(`/api/groups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) })
      .catch(console.error)
  }

  function navigatePage(delta: number) {
    setCurrentPage(prev => {
      const next = shiftDate(prev, delta)
      setInputDate(next)
      return next
    })
  }

  function goToToday() {
    const today = todayStr()
    setCurrentPage(today)
    setInputDate(today)
  }

  async function addTodo() {
    const text = inputText.trim()
    if (!text) return
    const tags = inputTagText.trim()
      ? [...new Set([...inputTags, inputTagText.trim().toLowerCase()])]
      : inputTags
    const tempId = crypto.randomUUID()
    const todo: Todo = {
      id: tempId,
      text,
      completed: false,
      date: inputDate,
      priority: inputPriority,
      tags,
      groupId: inputGroupId || undefined,
      createdAt: Date.now(),
    }
    setTodos(prev => [...prev, todo])
    setInputText('')
    setInputTags([])
    setInputTagText('')
    inputRef.current?.focus()
    try {
      const res = await authedFetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(todo) })
      const data = await res.json()
      if (data.id && data.id !== tempId) {
        setTodos(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id } : t))
      }
    } catch (err) {
      console.error(err)
    }
  }

  function commitTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/,/g, '')
    if (!tag) return
    setInputTags(prev => [...new Set([...prev, tag])])
    setInputTagText('')
  }

  function removeInputTag(tag: string) {
    setInputTags(prev => prev.filter(t => t !== tag))
  }

  function toggleTodo(id: string) {
    setTodos(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
      const updated = next.find(t => t.id === id)!
      authedFetch(`/api/todos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
        .catch(console.error)
      return next
    })
  }

  function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id))
    authedFetch(`/api/todos/${id}`, { method: 'DELETE' }).catch(console.error)
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditText(todo.text)
    setEditDate(todo.date)
    setEditPriority(todo.priority)
    setEditTags(todo.tags)
    setEditGroupId(todo.groupId || '')
    setEditTagText('')
  }

  function saveEdit(id: string) {
    const text = editText.trim()
    if (!text) return
    const tags = editTagText.trim()
      ? [...new Set([...editTags, editTagText.trim().toLowerCase()])]
      : editTags
    setTodos(prev => {
      const next = prev.map(t => t.id === id ? { ...t, text, date: editDate, priority: editPriority, tags, groupId: editGroupId || undefined } : t)
      const updated = next.find(t => t.id === id)!
      authedFetch(`/api/todos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
        .catch(console.error)
      return next
    })
    setEditingId(null)
    setEditTagText('')
  }

  function rollOverTasks() {
    const today = todayStr()
    const idsToRoll = pageTodos.filter(t => !t.completed).map(t => t.id)
    if (!idsToRoll.length) return
    setTodos(prev => {
      const next = prev.map(t => idsToRoll.includes(t.id) ? { ...t, date: today } : t)
      idsToRoll.forEach(id => {
        const updated = next.find(t => t.id === id)!
        authedFetch(`/api/todos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
          .catch(console.error)
      })
      return next
    })
    setCurrentPage(today)
    setInputDate(today)
  }

  const allTags = [...new Set(todos.flatMap(t => t.tags))].sort()
  const pageTodos = todos.filter(t => (t.date || todayStr()) === currentPage)
  const pageFilteredTodos = (activeTagFilter
    ? pageTodos.filter(t => t.tags.includes(activeTagFilter))
    : pageTodos
  ).slice().sort((a, b) => {
    if (a.completed === b.completed) return 0
    return a.completed ? 1 : -1
  })
  const completedTodos = todos.filter(t => t.completed)
  const completedCount = completedTodos.length
  const isToday = currentPage === todayStr()
  const isPast = currentPage < todayStr()
  const pendingOnPage = pageTodos.filter(t => !t.completed)
  const groupNameById = new Map(groups.map(g => [g.id, g.name]))
  const achievementTasks = completedTodos.slice().sort((a, b) => {
    const aDate = a.date || ''
    const bDate = b.date || ''
    if (aDate !== bDate) {
      if (!aDate) return 1
      if (!bDate) return -1
      return aDate < bDate ? 1 : -1
    }
    return b.createdAt - a.createdAt
  })
  const achievementSections = Array.from(
    achievementTasks.reduce((map, todo) => {
      const key = todo.date || ''
      const existing = map.get(key)
      if (existing) existing.push(todo)
      else map.set(key, [todo])
      return map
    }, new Map<string, Todo[]>())
  )
  const groupSections = groups
    .filter(g => pageFilteredTodos.some(t => t.groupId === g.id))
    .map(g => ({ group: g, todos: pageFilteredTodos.filter(t => t.groupId === g.id) }))
  const ungroupedTodos = pageFilteredTodos.filter(t => !t.groupId)

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, var(--bg), oklch(95% 0.015 80))',
          fontFamily: 'var(--font-display)',
          color: 'var(--fg)',
          fontSize: 34,
        }}
      >
        Preparing your notebook...
      </div>
    )
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
          fontFamily: 'var(--font-body)',
          padding: '80px 20px',
        }}
      >
        <div style={{ width: 'min(92vw, 520px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              padding: '0 4px',
              color: 'var(--fg)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, lineHeight: 1.05, color: 'var(--fg)' }}>Welcome to Agendafy</div>
            <div style={{ fontSize: 20, color: 'var(--muted)', marginTop: 4 }}>
              A notebook-style daily planner for tasks, quick notes, and goals that keeps your days beautifully organized.
            </div>
          </div>

          <div
            style={{
              width: 'min(92vw, 460px)',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 2,
              padding: '28px 26px',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              color: 'var(--fg)',
              margin: '0 auto',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)' }}>Agendafy</div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, lineHeight: 1.05 }}>Sign in to your notebook</h1>
            <div style={{ fontSize: 20, color: 'var(--muted)' }}>Use Google to continue.</div>

            {authError && (
              <div style={{ fontSize: 19, color: '#c25555', lineHeight: 1.3, background: 'rgba(239,71,111,0.08)', borderRadius: 2, padding: '8px 10px' }}>
                {authError}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={!auth || signingIn}
              style={{
                marginTop: 8,
                background: 'var(--fg)',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: 2,
                padding: '10px 20px',
                fontSize: 22,
                fontFamily: 'var(--font-display)',
                cursor: signingIn ? 'not-allowed' : 'pointer',
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                opacity: signingIn ? 0.4 : 1,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <IconGoogle size={18} />
              </span>
              <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
      }}
    >

      {/* Cover / Header */}
      <div
        style={{
          background: 'var(--fg)',
          color: 'var(--surface)',
          height: 64,
          padding: '0 24px',
          position: isMobile ? 'relative' : 'sticky',
          top: 0,
          flexShrink: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 2 }}>
            Agenda
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, margin: 0, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            Agendafy
          </h1>
        </div>
        {!isMobile && (
          <div style={{ opacity: 0.5, fontSize: 15, fontFamily: 'var(--font-body)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: isMobile ? 8 : 16, alignItems: 'center' }}>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  lineHeight: 1,
                }}
                title={user.displayName ?? user.email ?? 'Signed in user'}
              >
                {(user.displayName ?? user.email ?? 'U').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 15, opacity: 0.82 }}>{user.displayName ?? user.email ?? 'Signed in'}</span>
            </div>
          )}
          {isMobile ? (
            <button
              onClick={() => setSidebarOpen(true)}
              title="Show sidebar"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 2,
                padding: '6px 12px',
                fontSize: 20,
                color: 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              ☰
            </button>
          ) : (
            <div style={{ fontSize: 15, opacity: 0.55 }}>
              {todos.length - completedCount} pending · {completedCount} done
            </div>
          )}
          <button
            onClick={handleSignOut}
            style={{
              background: 'transparent',
              border: '1.5px solid rgba(224,224,224,0.4)',
              borderRadius: 2,
              padding: '6px 18px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              color: 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
          <button
            onClick={() => setShowAchievementLogs(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              color: 'var(--border)',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {isMobile ? 'Achievements' : 'Achievement logs'}
          </button>

        </div>
      </div>

      {/* Page body — fills remaining height */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--bg)',
        }}
      >
        {/* Binding column */}
        {!isMobile && (
          <div
            style={{
              width: 48,
              flexShrink: 0,
              background: 'linear-gradient(90deg, oklch(92% 0.015 75), oklch(96% 0.01 80))',
              borderRight: '2px solid var(--spine)',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--muted)', opacity: 0.4 }}>
              Agendafy — Editorial
            </div>
          </div>
        )}

        {/* Left panel backdrop (mobile) */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 49 }}
          />
        )}

        {/* Left panel — stats + legend + tag filter */}
        <div
          style={{
            position: isMobile ? 'fixed' : undefined,
            left: isMobile ? 0 : undefined,
            top: isMobile ? 0 : undefined,
            bottom: isMobile ? 0 : undefined,
            zIndex: isMobile ? 50 : undefined,
            boxShadow: isMobile ? '4px 0 20px rgba(0,0,0,0.15)' : undefined,
            background: 'var(--surface)',
            width: isMobile ? '80vw' : 260,
            maxWidth: isMobile ? 320 : undefined,
            flexShrink: 0,
            overflowY: 'auto',
            padding: '20px 24px 32px 20px',
            borderRight: '1.5px dashed var(--border)',
            display: isMobile ? (sidebarOpen ? 'flex' : 'none') : 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -8 }}>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, padding: '4px 8px', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <IconClose size={11} /> Close
              </button>
            </div>
          )}
          {/* Stats */}
          <div
            style={{
              background: 'oklch(97% 0.01 80)',
              borderRadius: 2,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>PROGRESS</div>
            <div
              style={{
                height: 6,
                borderRadius: 0,
                background: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: todos.length > 0 ? `${Math.round((completedCount / todos.length) * 100)}%` : '0%',
                  background: 'var(--accent)',
                  borderRadius: 0,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{todos.length - completedCount} remaining</span>
              <span style={{ color: 'var(--success)' }}>
                {todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>PRIORITY</div>
            {(['high', 'medium', 'low'] as Priority[]).map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: 'var(--muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_COLORS[p], flexShrink: 0 }} />
                {PRIORITY_LABELS[p]}
              </div>
            ))}
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>FILTER BY TAG</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allTags.map(tag => {
                  const { bg, text } = tagColor(tag)
                  const active = activeTagFilter === tag
                  return (
                    <button
                      key={tag}
                      onClick={() => setActiveTagFilter(active ? null : tag)}
                      style={{
                        background: active ? text : bg,
                        color: active ? '#fff' : text,
                        border: `1.5px solid ${text}`,
                        borderRadius: 2,
                        padding: '3px 10px',
                        fontSize: 14,
                        fontFamily: 'var(--font-body)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
              {activeTagFilter && (
                <button
                  onClick={() => setActiveTagFilter(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    textDecoration: 'underline',
                    textAlign: 'left',
                    padding: 0,
                  }}
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          {/* Groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>GROUPS</div>
            {groups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, color: 'var(--muted)', padding: '4px 0' }}>
                <IconFolder size={15} color="oklch(58% 0.08 240)" />
                {editingGroupId === g.id ? (
                  <input
                    autoFocus
                    value={editingGroupName}
                    onChange={e => setEditingGroupName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { renameGroup(g.id, editingGroupName); setEditingGroupId(null) }
                      if (e.key === 'Escape') setEditingGroupId(null)
                    }}
                    onBlur={() => { renameGroup(g.id, editingGroupName); setEditingGroupId(null) }}
                    style={{ flex: 1, border: 'none', borderBottom: '1.5px solid var(--fg)', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'var(--font-body)', color: 'var(--fg)', padding: '1px 2px' }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, cursor: 'text', fontFamily: 'var(--font-task)', fontSize: 14 }}
                    onDoubleClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name) }}
                    title="Double-click to rename"
                  >{g.name}</span>
                )}
                <span style={{ fontSize: 13, color: 'var(--border)' }}>{todos.filter(t => t.groupId === g.id).length}</span>
                <button
                  onClick={() => deleteGroup(g.id)}
                  title="Delete group"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--high)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
                ><IconClose size={10} /></button>
              </div>
            ))}
            {/* Inline add group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="text"
                value={addGroupName}
                onChange={e => setAddGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (addGroupName.trim()) { createGroup(addGroupName.trim()); setAddGroupName('') }
                  }
                  if (e.key === 'Escape') setAddGroupName('')
                }}
                placeholder="+ New group..."
                style={{ flex: 1, border: 'none', borderBottom: '1.5px dashed var(--border)', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: 'var(--font-body)', color: 'var(--muted)', padding: '3px 2px' }}
              />
              {addGroupName.trim() && (
                <button
                  onClick={() => { createGroup(addGroupName.trim()); setAddGroupName('') }}
                  style={{ background: 'var(--fg)', color: 'var(--surface)', border: 'none', borderRadius: 2, padding: '2px 10px', fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                >Add</button>
              )}
            </div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--border)', marginTop: 'auto', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            Double-click a task to edit
            <br />Double-click a group to rename
          </div>
        </div>

        {/* Right panel — scrollable todo list */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {showAchievementLogs && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 25,
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? '10px 12px 8px 12px' : '14px 32px 10px 28px',
                  borderBottom: '1.5px solid var(--border)',
                  flexShrink: 0,
                  background: 'var(--surface)',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: 'var(--fg)', lineHeight: 1.1 }}>
                    Achievement logs
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>
                    All completed tasks across all days
                  </div>
                </div>
                <button
                  onClick={() => setShowAchievementLogs(false)}
                  style={{
                    background: 'transparent',
                    border: '1.5px solid var(--border)',
                    borderRadius: 2,
                    padding: '4px 14px',
                    fontSize: 22,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--fg)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconArrowLeft /> Back
                </button>
              </div>

              <div style={{ padding: isMobile ? '16px 12px 32px 12px' : '20px 32px 32px 28px', flex: 1, overflowY: 'auto' }}>
                {achievementSections.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, lineHeight: 2 }}>
                    No completed tasks yet.
                  </div>
                ) : (
                  achievementSections.map(([date, sectionTodos]) => (
                    <div key={date || 'no-date'} style={{ marginBottom: 22 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--fg)', marginBottom: 8, borderBottom: '1.5px solid var(--border)', paddingBottom: 4 }}>
                        {date ? `${pageLabel(date)} · ${pageSubLabel(date)}` : 'No date'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {sectionTodos.map(todo => (
                          <div key={todo.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '3px 6px' }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_COLORS[todo.priority], flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--muted)', textDecorationLine: 'line-through', textDecorationColor: 'rgba(107,203,119,0.5)', textDecorationThickness: 2, wordBreak: 'break-word' }}>
                                {todo.text}
                              </span>
                              {!isMobile && todo.tags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
                                  {todo.tags.map(tag => {
                                    const { bg, text } = tagColor(tag)
                                    return (
                                      <span key={tag} style={{ background: bg, color: text, borderRadius: 2, padding: '1px 7px', fontSize: 13, opacity: 0.7 }}>
                                        #{tag}
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                              {!isMobile && todo.groupId && groupNameById.get(todo.groupId) && (
                                <span style={{ fontSize: 12, color: 'var(--muted)', background: 'oklch(97% 0.006 80)', borderRadius: 2, padding: '1px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <IconFolder size={13} color="var(--border)" /> {groupNameById.get(todo.groupId)}
                                </span>
                              )}
                            </div>
                            {isMobile && (todo.tags.length > 0 || (todo.groupId && groupNameById.get(todo.groupId))) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: '0 6px 6px 24px' }}>
                                {todo.tags.map(tag => {
                                  const { bg, text } = tagColor(tag)
                                  return (
                                    <span key={tag} style={{ background: bg, color: text, borderRadius: 2, padding: '1px 7px', fontSize: 13, opacity: 0.7 }}>
                                      #{tag}
                                    </span>
                                  )
                                })}
                                {todo.groupId && groupNameById.get(todo.groupId) && (
                                  <span style={{ fontSize: 12, color: 'var(--muted)', background: 'oklch(97% 0.006 80)', borderRadius: 2, padding: '1px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <IconFolder size={13} color="var(--border)" /> {groupNameById.get(todo.groupId)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Page flip navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 24px',
              borderBottom: '1.5px solid var(--border)',
              flexShrink: 0,
              background: 'oklch(97% 0.012 80 / 0.95)',
            }}
          >
            <button
              onClick={() => navigatePage(-1)}
              style={{
                background: 'transparent',
                border: '1.5px solid var(--border)',
                borderRadius: 2,
                padding: '4px 14px',
                fontSize: 20,
                fontFamily: 'var(--font-display)',
                color: 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconArrowLeft /> Prev
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--fg)', lineHeight: 1.1 }}>
                {pageLabel(currentPage)}
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>
                {pageSubLabel(currentPage)}
              </div>
              {!isToday && (
                <button
                  onClick={goToToday}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    marginTop: 2,
                    padding: 0,
                  }}
                >
                  Back to Today
                </button>
              )}
              {isPast && pendingOnPage.length > 0 && (
                <button
                  onClick={rollOverTasks}
                  title={`Move ${pendingOnPage.length} uncompleted task${pendingOnPage.length > 1 ? 's' : ''} to today`}
                  style={{
                    marginTop: 4,
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 2,
                    padding: '6px 16px',
                    fontSize: 14,
                    fontFamily: 'var(--font-body)',
                    color: 'var(--surface)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: 'none',
                  }}
                >
                  ↩ Roll {pendingOnPage.length} task{pendingOnPage.length > 1 ? 's' : ''} → Today
                </button>
              )}
            </div>

            <button
              onClick={() => navigatePage(1)}
              style={{
                background: 'transparent',
                border: '1.5px solid var(--border)',
                borderRadius: 2,
                padding: '4px 14px',
                fontSize: 20,
                fontFamily: 'var(--font-display)',
                color: 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Next <IconArrowRight />
            </button>
          </div>

          {/* Scrollable content — only this area scrolls */}
          <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>

          {isMobile && (
            <div
              style={{
                margin: '10px 12px 0',
                padding: '12px 12px 10px',
                border: '1.5px dashed var(--border)',
                borderRadius: 2,
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase', lineHeight: 1.1 }}>QUICK NOTES</div>
                <div style={{ fontSize: 13, color: 'var(--border)' }}>
                  {quickNotes.filter(n => !n.completed).length} active · {quickNotes.filter(n => n.completed).length} done
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  ref={quickNoteInputRef}
                  type="text"
                  value={quickNoteInput}
                  onChange={e => setQuickNoteInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addQuickNote()
                    if (e.key === 'Escape') setQuickNoteInput('')
                  }}
                  placeholder="＋  Write a note..."
                  style={{
                    flex: 1,
                    border: 'none',
                    borderBottom: '1.5px dashed var(--border)',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 17,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--fg)',
                    padding: '2px 0',
                  }}
                />
                <button
                  onMouseDown={e => { e.preventDefault(); addQuickNote() }}
                  disabled={!quickNoteInput.trim()}
                  style={{
                    background: 'var(--fg)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: 2,
                    padding: '3px 12px',
                    fontSize: 15,
                    fontFamily: 'var(--font-body)',
                    cursor: quickNoteInput.trim() ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                    opacity: quickNoteInput.trim() ? 1 : 0.4,
                  }}
                >
                  + Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 210, overflowY: 'auto' }}>
                {quickNotes.length === 0 ? (
                  <div style={{ color: 'var(--border)', fontSize: 15, lineHeight: 1.7, padding: '4px 2px 2px' }}>
                    No notes yet.
                  </div>
                ) : (
                  quickNotes.map(note => (
                    <div
                      key={note.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '5px 2px',
                        borderBottom: '1px solid var(--border)',
                        opacity: note.completed ? 0.55 : 1,
                      }}
                    >
                      <button
                        onClick={() => toggleQuickNote(note.id)}
                        title={note.completed ? 'Mark incomplete' : 'Mark complete'}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: note.completed ? 'none' : '2px solid var(--border)',
                          background: note.completed ? 'var(--success)' : 'transparent',
                          cursor: 'pointer',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          marginTop: 3,
                        }}
                      >
                        {note.completed && <IconCheck size={10} />}
                      </button>
                      <span
                        style={{
                          flex: 1,
                          fontFamily: 'var(--font-display)',
                          fontSize: 17,
                          color: note.completed ? 'var(--muted)' : 'var(--fg)',
                          textDecorationLine: note.completed ? 'line-through' : 'none',
                          textDecorationColor: 'rgba(107,203,119,0.5)',
                          textDecorationThickness: 2,
                          wordBreak: 'break-word',
                          lineHeight: 1.3,
                        }}
                      >
                        {note.text}
                      </span>
                      <button
                        onClick={() => deleteQuickNote(note.id)}
                        title="Delete note"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--border)',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconClose size={10} color="currentColor" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Todo list for this page */}
          <div style={{ padding: isMobile ? '16px 12px 32px 12px' : '20px 32px 32px 28px', flex: 1 }}>
            {pageFilteredTodos.length === 0 && !inlineAddFocused ? (
              activeTagFilter ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, lineHeight: 2 }}>
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--border)' }}><IconTag size={48} /></div>
                  <div>No tasks tagged <strong>#{activeTagFilter}</strong> on this page</div>
                </div>
              ) : (
                <div
                  style={{ textAlign: 'center', padding: '60px 0 20px', color: 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, lineHeight: 2, cursor: 'pointer' }}
                  onClick={() => inputRef.current?.focus()}
                >
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--border)' }}><IconNotebook size={56} /></div>
                  <div>{isToday ? 'Nothing planned for today.' : `Nothing planned for ${pageLabel(currentPage)}.`}</div>
                  <div style={{ fontSize: 17, color: 'var(--border)', fontFamily: 'var(--font-body)' }}>Click the line below to add a task.</div>
                </div>
              )
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                {groupSections.map(group => (
                  <div key={group.group.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 6px 4px', borderBottom: '1.5px solid rgba(196,218,245,0.8)', marginBottom: 2 }}>
                      <IconFolder size={18} color="var(--fg)" />
                      <span style={{ fontFamily: 'var(--font-task)', fontSize: 16, fontWeight: 400, color: 'var(--fg)' }}>{group.group.name}</span>
                      <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 2 }}>({group.todos.length})</span>
                    </div>
                    <SortableContext items={group.todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {group.todos.map(todo => (
                        <SortableTodoItem
                          key={todo.id}
                          todo={todo}
                          editingId={editingId}
                          editText={editText}
                          editDate={editDate}
                          editPriority={editPriority}
                          editTags={editTags}
                          editTagText={editTagText}
                          editTagDropdownOpen={editTagDropdownOpen}
                          editTagInputRef={editTagInputRef}
                          allTags={allTags}
                          groups={groups}
                          editGroupId={editGroupId}
                          activeTagFilter={activeTagFilter}
                          onToggle={toggleTodo}
                          onDelete={deleteTodo}
                          onStartEdit={startEdit}
                          onSaveEdit={saveEdit}
                          onEditTextChange={setEditText}
                          onEditDateChange={setEditDate}
                          onEditPriorityChange={setEditPriority}
                          onEditTagsChange={setEditTags}
                          onEditTagTextChange={setEditTagText}
                          onEditTagDropdownToggle={setEditTagDropdownOpen}
                          onEditGroupChange={setEditGroupId}
                          onCancelEdit={() => setEditingId(null)}
                          onTagFilterToggle={tag => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                          isMobile={isMobile}
                        />
                      ))}
                    </SortableContext>
                  </div>
                ))}

                {ungroupedTodos.length > 0 && (
                  <>
                    {groupSections.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 6px 4px', borderBottom: '1.5px solid rgba(196,218,245,0.8)', marginBottom: 2 }}>
                        <IconClipboard size={18} />
                        <span style={{ fontFamily: 'var(--font-task)', fontSize: 16, color: 'var(--fg)' }}>Other</span>
                      </div>
                    )}
                    <SortableContext items={ungroupedTodos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {ungroupedTodos.map(todo => (
                        <SortableTodoItem
                          key={todo.id}
                          todo={todo}
                          editingId={editingId}
                          editText={editText}
                          editDate={editDate}
                          editPriority={editPriority}
                          editTags={editTags}
                          editTagText={editTagText}
                          editTagDropdownOpen={editTagDropdownOpen}
                          editTagInputRef={editTagInputRef}
                          allTags={allTags}
                          groups={groups}
                          editGroupId={editGroupId}
                          activeTagFilter={activeTagFilter}
                          onToggle={toggleTodo}
                          onDelete={deleteTodo}
                          onStartEdit={startEdit}
                          onSaveEdit={saveEdit}
                          onEditTextChange={setEditText}
                          onEditDateChange={setEditDate}
                          onEditPriorityChange={setEditPriority}
                          onEditTagsChange={setEditTags}
                          onEditTagTextChange={setEditTagText}
                          onEditTagDropdownToggle={setEditTagDropdownOpen}
                          onEditGroupChange={setEditGroupId}
                          onCancelEdit={() => setEditingId(null)}
                          onTagFilterToggle={tag => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                          isMobile={isMobile}
                        />
                      ))}
                    </SortableContext>
                  </>
                )}

                <DragOverlay>
                  {activeDragId ? (() => {
                    const dragged = todos.find(t => t.id === activeDragId)
                    if (!dragged) return null
                    return (
                      <SortableTodoItem
                        todo={dragged}
                        editingId={null}
                        editText=""
                        editDate=""
                        editPriority="medium"
                        editTags={[]}
                        editTagText=""
                        editTagDropdownOpen={false}
                        editTagInputRef={{ current: null }}
                        allTags={[]}
                        groups={[]}
                        editGroupId=""
                        activeTagFilter={activeTagFilter}
                        isDragOverlay
                        onToggle={() => {}}
                        onDelete={() => {}}
                        onStartEdit={() => {}}
                        onSaveEdit={() => {}}
                        onEditTextChange={() => {}}
                        onEditDateChange={() => {}}
                        onEditPriorityChange={() => {}}
                        onEditTagsChange={() => {}}
                        onEditTagTextChange={() => {}}
                        onEditTagDropdownToggle={() => {}}
                        onEditGroupChange={() => {}}
                        onCancelEdit={() => {}}
                        onTagFilterToggle={() => {}}
                        isMobile={isMobile}
                      />
                    )
                  })() : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* Inline add row — always at bottom of list, looks like a notebook line */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                marginTop: 4,
                borderRadius: 0,
                background: inlineAddFocused ? 'rgba(255,255,255,0.6)' : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              {/* Main line: drag handle space + checkbox circle + priority dot + text input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 4px',
                  borderBottom: '1px solid rgba(196,218,245,0.6)',
                  cursor: 'text',
                }}
                onClick={() => inputRef.current?.focus()}
              >
                {/* Spacer matching drag handle width */}
                <div style={{ width: 18, flexShrink: 0 }} />
                {/* Empty checkbox */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: `2px dashed ${PRIORITY_COLORS[inputPriority]}`,
                    flexShrink: 0,
                    opacity: 0.4,
                  }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onFocus={() => setInlineAddFocused(true)}
                  onBlur={() => { if (!inputText.trim()) { setInlineAddFocused(false); setInputTags([]); setInputTagText('') } }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { addTodo(); setInlineAddFocused(false) }
                    if (e.key === 'Escape') { setInputText(''); setInputTags([]); setInputTagText(''); setInlineAddFocused(false) }
                  }}
                  placeholder="＋  Write a new task..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 20,
                    fontFamily: 'var(--font-display)',
                    color: inlineAddFocused ? 'var(--fg)' : 'var(--border)',
                  }}
                />
              </div>

              {/* Metadata row — only shown when focused */}
              {inlineAddFocused && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: isMobile ? '6px 12px' : '6px 50px',
                    flexWrap: 'wrap',
                    borderBottom: '1px solid rgba(196,218,245,0.6)',
                  }}
                >
                  {/* Tag chips */}
                  {inputTags.map(tag => {
                    const { bg, text } = tagColor(tag)
                    return (
                      <span key={tag} style={{ background: bg, color: text, borderRadius: 2, padding: '2px 8px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                        #{tag}
                        <button onMouseDown={e => { e.preventDefault(); removeInputTag(tag) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: text, fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.7, display: 'flex', alignItems: 'center' }}><IconClose size={9} color={text} /></button>
                      </span>
                    )
                  })}

                  {/* Tag input + dropdown */}
                  <div style={{ position: 'relative' }}>
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={inputTagText}
                      onChange={e => { setInputTagText(e.target.value); setTagDropdownOpen(true) }}
                      onFocus={() => setTagDropdownOpen(true)}
                      onBlur={() => setTimeout(() => { commitTag(inputTagText); setTagDropdownOpen(false) }, 150)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); commitTag(inputTagText); setTagDropdownOpen(false) }
                        else if (e.key === 'Escape') setTagDropdownOpen(false)
                        else if (e.key === 'Backspace' && !inputTagText && inputTags.length > 0) setInputTags(prev => prev.slice(0, -1))
                      }}
                      placeholder="# tag..."
                      style={{ border: 'none', borderBottom: '1.5px dashed var(--border)', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--muted)', width: 70 }}
                    />
                    {tagDropdownOpen && (() => {
                      const query = inputTagText.trim().toLowerCase()
                      const suggestions = allTags.filter(t => !inputTags.includes(t) && (query === '' || t.includes(query)))
                      if (suggestions.length === 0) return null
                      return (
                        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 20, marginTop: 4, minWidth: 160, overflow: 'hidden' }}>
                          <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>Existing tags</div>
                          {suggestions.map(tag => {
                            const { bg, text } = tagColor(tag)
                            return (
                              <div key={tag} onMouseDown={e => { e.preventDefault(); setInputTags(prev => [...new Set([...prev, tag])]); setInputTagText(''); setTagDropdownOpen(false); tagInputRef.current?.focus() }} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg)' }} onMouseEnter={e => (e.currentTarget.style.background = 'oklch(97% 0.006 80)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ background: bg, color: text, borderRadius: 2, padding: '1px 8px', fontSize: 13 }}>#{tag}</span>
                                <span style={{ color: 'var(--border)', fontSize: 13 }}>{todos.filter(t => t.tags.includes(tag)).length} task{todos.filter(t => t.tags.includes(tag)).length !== 1 ? 's' : ''}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Date */}
                  <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} style={{ border: 'none', borderBottom: '1.5px dashed var(--border)', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--muted)', padding: '2px 4px', cursor: 'pointer' }} />

                  {/* Priority dots */}
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {(['low', 'medium', 'high'] as Priority[]).map(p => (
                      <button key={p} onMouseDown={e => { e.preventDefault(); setInputPriority(p) }} title={PRIORITY_LABELS[p]} style={{ width: 16, height: 16, borderRadius: '50%', border: inputPriority === p ? '2.5px solid var(--fg)' : '2px solid transparent', background: PRIORITY_COLORS[p], cursor: 'pointer', transition: 'transform 0.15s', transform: inputPriority === p ? 'scale(1.2)' : 'scale(1)', padding: 0 }} />
                    ))}
                  </div>

                  {/* Group */}
                  <select
                    value={inputGroupId}
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => setInputGroupId(e.target.value)}
                    style={{ border: 'none', borderBottom: '1.5px dashed var(--border)', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--muted)', padding: '2px 4px', cursor: 'pointer', maxWidth: 130 }}
                  >
                    <option value="">No group</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>

                  {/* Add button */}
                  <button
                    onMouseDown={e => { e.preventDefault(); addTodo(); setInlineAddFocused(false) }}
                    disabled={!inputText.trim()}
                    style={{ marginLeft: 'auto', background: 'var(--fg)', color: 'var(--surface)', border: 'none', borderRadius: 2, padding: '5px 18px', fontSize: 17, fontFamily: 'var(--font-body)', cursor: inputText.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.2s', flexShrink: 0, opacity: inputText.trim() ? 1 : 0.4 }}
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* end scrollable content */}
          </div>
        </div>

        {/* Right panel — Quick Notes */}
        {!isMobile && (
          <div
            style={{
              width: 260,
              flexShrink: 0,
              overflowY: 'auto',
              padding: '20px 20px 32px 20px',
              borderLeft: '1.5px dashed var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Section heading */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>QUICK NOTES</div>
              <div style={{ fontSize: 13, color: 'var(--border)' }}>
                {quickNotes.filter(n => !n.completed).length} active · {quickNotes.filter(n => n.completed).length} done
              </div>
            </div>

            {/* Add note input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                ref={quickNoteInputRef}
                type="text"
                value={quickNoteInput}
                onChange={e => setQuickNoteInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addQuickNote()
                  if (e.key === 'Escape') setQuickNoteInput('')
                }}
                placeholder="＋  Write a note..."
                style={{
                  border: 'none',
                  borderBottom: '1.5px dashed var(--border)',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 17,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--fg)',
                  padding: '4px 0',
                  width: '100%',
                }}
              />
              {quickNoteInput.trim() && (
                <button
                  onMouseDown={e => { e.preventDefault(); addQuickNote() }}
                  style={{
                    background: 'var(--fg)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: 2,
                    padding: '4px 14px',
                    fontSize: 15,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  + Add
                </button>
              )}
            </div>

            {/* Notes list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {quickNotes.length === 0 ? (
                <div style={{ color: 'var(--border)', fontSize: 15, lineHeight: 1.8, paddingTop: 8 }}>
                  No notes yet.
                </div>
              ) : (
                quickNotes.map(note => (
                  <div
                    key={note.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '6px 4px',
                      borderBottom: '1px solid var(--border)',
                      opacity: note.completed ? 0.55 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleQuickNote(note.id)}
                      title={note.completed ? 'Mark incomplete' : 'Mark complete'}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: note.completed ? 'none' : '2px solid var(--border)',
                        background: note.completed ? 'var(--success)' : 'transparent',
                        cursor: 'pointer',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        marginTop: 3,
                        transition: 'background 0.15s',
                      }}
                    >
                      {note.completed && <IconCheck size={10} />}
                    </button>

                    {/* Text */}
                    <span
                      style={{
                        flex: 1,
                        fontFamily: 'var(--font-display)',
                        fontSize: 17,
                        color: note.completed ? 'var(--muted)' : 'var(--fg)',
                        textDecorationLine: note.completed ? 'line-through' : 'none',
                        textDecorationColor: 'rgba(107,203,119,0.5)',
                        textDecorationThickness: 2,
                        wordBreak: 'break-word',
                        lineHeight: 1.3,
                      }}
                    >
                      {note.text}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => deleteQuickNote(note.id)}
                      title="Delete note"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--border)',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        borderRadius: 2,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--high)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
                    >
                      <IconClose size={10} color="currentColor" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
