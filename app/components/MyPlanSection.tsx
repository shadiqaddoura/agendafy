'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

type PlanKind = 'mission' | 'vision' | 'goals'

type PlanItem = {
  id: string
  kind: PlanKind
  title: string
  description: string
  dueDate: string       // 'YYYY-MM-DD' or ''
  completed: boolean
  completedAt: number | null
  createdAt: number
  updatedAt: number
}

type PlanItemResponse = Partial<PlanItem> & { error?: string }

type MyPlanSectionProps = {
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  isMobile?: boolean
}

const TITLE_MAX = 120
const DESCRIPTION_MAX = 500
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const SECTION_META: Record<PlanKind, { label: string; accent: string; placeholder: string }> = {
  mission: {
    label: 'Mission',
    accent: 'oklch(56% 0.13 25)',
    placeholder: '＋  Write a mission statement...',
  },
  vision: {
    label: 'Vision',
    accent: 'oklch(56% 0.11 255)',
    placeholder: '＋  Write a vision statement...',
  },
  goals: {
    label: 'Goals',
    accent: 'oklch(56% 0.12 85)',
    placeholder: '＋  Write a goal...',
  },
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCompletedAt(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isPast(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr + 'T00:00:00') < today
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7.5 C3.5 9.2 4.8 10.5 5.5 11 C7 8.5 9.5 5.8 12 3.5" />
    </svg>
  )
}

function IconClose({ size = 10, color = 'currentColor' }: { size?: number; color?: string }) {
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

// ─── Inline Add Row ───────────────────────────────────────────────────────────

function InlineAddRow({
  kind,
  onAdd,
  isMobile,
}: {
  kind: PlanKind
  onAdd: (item: Omit<PlanItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  isMobile: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasDateField = kind === 'vision' || kind === 'goals'
  const meta = SECTION_META[kind]

  const reset = () => {
    setTitle('')
    setDescription('')
    setDueDate('')
    setTitleError('')
    setFocused(false)
  }

  const handleAdd = async () => {
    const trimmed = title.trim()
    if (!trimmed) { setTitleError('Title is required'); return }
    if (trimmed.length > TITLE_MAX) { setTitleError(`Max ${TITLE_MAX} characters`); return }
    if (dueDate && !DATE_RE.test(dueDate)) { setTitleError('Invalid date format'); return }
    setSaving(true)
    try {
      await onAdd({ kind, title: trimmed, description: description.trim(), dueDate, completed: false, completedAt: null })
      reset()
      inputRef.current?.focus()
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : 'Failed to add. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        background: focused ? 'rgba(255,255,255,0.6)' : 'transparent',
        transition: 'background 0.2s',
      }}
    >
      {/* Main input line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 6px',
          borderBottom: '1px solid var(--border)',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Spacer matching drag-handle width */}
        <div style={{ width: 18, flexShrink: 0 }} />
        {/* Dashed empty circle */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `2px dashed #4db86a`,
            flexShrink: 0,
            opacity: 0.4,
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); setTitleError('') }}
          onFocus={() => setFocused(true)}
          onBlur={() => { if (!title.trim()) { reset() } else { setFocused(false) } }}
          onKeyDown={e => {
            if (e.key === 'Enter') void handleAdd()
            if (e.key === 'Escape') { reset() }
          }}
          placeholder={meta.placeholder}
          maxLength={TITLE_MAX}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: isMobile ? 17 : 20,
            fontFamily: 'var(--font-display)',
            color: focused ? 'var(--fg)' : 'var(--border)',
          }}
        />
      </div>

      {/* Metadata row — shown when focused */}
      {focused && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: isMobile ? '8px 10px' : '8px 50px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            maxLength={DESCRIPTION_MAX}
            style={{
              flex: '1 1 180px',
              border: 'none',
              borderBottom: '1.5px dashed var(--border)',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              color: 'var(--muted)',
              padding: '2px 4px',
            }}
          />

          {hasDateField && (
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={{
                border: 'none',
                borderBottom: '1.5px dashed var(--border)',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                color: 'var(--muted)',
                padding: '2px 4px',
                cursor: 'pointer',
              }}
            />
          )}

          {titleError && (
            <span style={{ fontSize: 12, color: '#a23d52', alignSelf: 'center' }}>{titleError}</span>
          )}

          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => void handleAdd()}
            disabled={saving || !title.trim()}
            style={{
              marginLeft: 'auto',
              background: 'var(--fg)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 2,
              padding: '6px 20px',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              cursor: title.trim() && !saving ? 'pointer' : 'not-allowed',
              opacity: title.trim() && !saving ? 1 : 0.4,
              flexShrink: 0,
            }}
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={reset}
            style={{
              background: 'none',
              border: '1.5px solid var(--border)',
              borderRadius: 2,
              padding: '5px 14px',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              color: 'var(--muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Plan Item Row ────────────────────────────────────────────────────────────

function PlanItemRow({
  item,
  onEdit,
  onDelete,
  onToggleComplete,
  isMobile,
}: {
  item: PlanItem
  onEdit: (id: string, patch: Partial<Pick<PlanItem, 'title' | 'description' | 'dueDate'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggleComplete: (id: string, completed: boolean) => Promise<void>
  isMobile: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const [editDescription, setEditDescription] = useState(item.description || '')
  const [editDueDate, setEditDueDate] = useState(item.dueDate || '')
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const lastTapRef = useRef<number>(0)

  const hasComplete = item.kind === 'vision' || item.kind === 'goals'
  const hasDateField = item.kind === 'vision' || item.kind === 'goals'
  const overdue = !item.completed && item.dueDate && isPast(item.dueDate)

  const startEdit = () => {
    setEditTitle(item.title)
    setEditDescription(item.description || '')
    setEditDueDate(item.dueDate || '')
    setTitleError('')
    setEditing(true)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const handleTap = (e: React.TouchEvent) => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      e.preventDefault()
      if (!item.completed && !editing) startEdit()
    }
    lastTapRef.current = now
  }

  const cancelEdit = () => {
    setEditing(false)
    setTitleError('')
    setActionError(null)
  }

  const handleSave = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed) { setTitleError('Title is required'); return }
    if (trimmed.length > TITLE_MAX) { setTitleError(`Max ${TITLE_MAX} characters`); return }
    if (editDueDate && !DATE_RE.test(editDueDate)) { setTitleError('Invalid date format'); return }
    setSaving(true)
    try {
      await onEdit(item.id, { title: trimmed, description: editDescription.trim(), dueDate: editDueDate })
      setEditing(false)
      setActionError(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    void onDelete(item.id).catch(err => setActionError(err instanceof Error ? err.message : 'Delete failed'))
  }

  const handleToggle = () => {
    void onToggleComplete(item.id, !item.completed).catch(err => setActionError(err instanceof Error ? err.message : 'Update failed'))
  }

  return (
    <div
      style={{ background: editing ? 'rgba(255,255,255,0.5)' : 'transparent' }}
      onMouseEnter={e => { if (!editing) e.currentTarget.style.background = 'var(--bg)' }}
      onMouseLeave={e => { if (!editing) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 34,
          padding: '6px 6px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Spacer for drag handle alignment */}
        <div style={{ width: 18, flexShrink: 0 }} />

        {/* Completion circle */}
        {hasComplete ? (
          <button
            type="button"
            onClick={handleToggle}
            aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '2px solid #4db86a',
              background: item.completed ? '#4db86a' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
              padding: 0,
            }}
          >
            {item.completed && <IconCheck size={14} />}
          </button>
        ) : (
          /* Mission: just a spacer so text aligns with vision/goals */
          <div style={{ width: 22, flexShrink: 0 }} />
        )}

        {/* Title — editing or display */}
        {editing ? (
          <input
            ref={editInputRef}
            autoFocus
            value={editTitle}
            onChange={e => { setEditTitle(e.target.value); setTitleError('') }}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleSave()
              if (e.key === 'Escape') cancelEdit()
            }}
            maxLength={TITLE_MAX}
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
            onDoubleClick={() => !item.completed && startEdit()}
            onTouchEnd={handleTap}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'var(--font-task)',
              fontSize: 16,
              color: item.completed ? 'var(--muted)' : 'var(--fg)',
              cursor: item.completed ? 'default' : 'text',
              wordBreak: 'break-word',
              transition: 'color 0.2s',
              textDecorationLine: item.completed ? 'line-through' : 'none',
              textDecorationColor: 'rgba(107,203,119,0.5)',
              textDecorationThickness: 2,
            }}
          >
            {item.title}
          </span>
        )}

        {/* Due date badge (desktop, not editing, not completed) */}
        {!editing && !isMobile && item.dueDate && !item.completed && (
          <span
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: overdue ? '#a23d52' : 'var(--muted)',
              background: overdue ? 'rgba(239,71,111,0.07)' : 'transparent',
              border: `1px solid ${overdue ? 'rgba(239,71,111,0.2)' : 'var(--border)'}`,
              borderRadius: 999,
              padding: '1px 8px',
              flexShrink: 0,
              letterSpacing: '0.03em',
            }}
          >
            {overdue ? '⚠ ' : ''}{formatDate(item.dueDate)}
          </span>
        )}

        {/* Completed-at badge (desktop, not editing) */}
        {!editing && !isMobile && item.completed && item.completedAt && (
          <span
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: '#3a9163',
              background: 'rgba(107,203,119,0.08)',
              border: '1px solid rgba(107,203,119,0.25)',
              borderRadius: 999,
              padding: '1px 8px',
              flexShrink: 0,
              letterSpacing: '0.03em',
            }}
          >
            ✓ {formatCompletedAt(item.completedAt)}
          </span>
        )}

        {/* Delete button */}
        {!editing && (
          <button
            onClick={handleDelete}
            aria-label="Delete"
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
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef476f')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
          >
            <IconClose size={10} />
          </button>
        )}
      </div>

      {/* Edit metadata row */}
      {editing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: isMobile ? '6px 10px' : '6px 50px',
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.5)',
          }}
        >
          <input
            type="text"
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            placeholder="Description (optional)..."
            maxLength={DESCRIPTION_MAX}
            style={{
              flex: '1 1 160px',
              border: 'none',
              borderBottom: '1.5px dashed var(--border)',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              color: 'var(--muted)',
              padding: '2px 4px',
            }}
          />

          {hasDateField && (
            <input
              type="date"
              value={editDueDate}
              onChange={e => setEditDueDate(e.target.value)}
              style={{
                border: 'none',
                borderBottom: '1.5px dashed var(--border)',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                color: 'var(--muted)',
                padding: '2px 4px',
                cursor: 'pointer',
              }}
            />
          )}

          {(titleError || actionError) && (
            <span style={{ fontSize: 12, color: '#a23d52' }}>{titleError || actionError}</span>
          )}

          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => void handleSave()}
            disabled={saving || !editTitle.trim()}
            style={{
              marginLeft: 'auto',
              background: 'var(--fg)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 2,
              padding: '6px 20px',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              cursor: editTitle.trim() && !saving ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              opacity: editTitle.trim() && !saving ? 1 : 0.4,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={cancelEdit}
            style={{
              background: 'none',
              border: '1.5px solid var(--border)',
              borderRadius: 2,
              padding: '5px 14px',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              color: 'var(--muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Description sub-row (when not editing) */}
      {!editing && item.description && (
        <div
          style={{
            padding: isMobile ? '2px 6px 7px 56px' : '2px 44px 7px 56px',
            borderBottom: '1px solid var(--border)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          {item.description}
        </div>
      )}

      {/* Mobile badges row */}
      {!editing && isMobile && (item.dueDate || item.completedAt) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '3px 6px 7px 56px', borderBottom: '1px solid var(--border)' }}>
          {item.dueDate && !item.completed && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: overdue ? '#a23d52' : 'var(--muted)',
                background: overdue ? 'rgba(239,71,111,0.07)' : 'transparent',
                border: `1px solid ${overdue ? 'rgba(239,71,111,0.2)' : 'var(--border)'}`,
                borderRadius: 999,
                padding: '1px 8px',
                letterSpacing: '0.03em',
              }}
            >
              {overdue ? '⚠ ' : ''}{formatDate(item.dueDate)}
            </span>
          )}
          {item.completed && item.completedAt && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: '#3a9163',
                background: 'rgba(107,203,119,0.08)',
                border: '1px solid rgba(107,203,119,0.25)',
                borderRadius: 999,
                padding: '1px 8px',
                letterSpacing: '0.03em',
              }}
            >
              ✓ {formatCompletedAt(item.completedAt)}
            </span>
          )}
        </div>
      )}

      {/* Action error (delete/toggle failures) — always visible */}
      {actionError && !editing && (
        <div
          style={{
            padding: '3px 6px 6px 56px',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            color: '#a23d52',
          }}
        >
          {actionError}
        </div>
      )}
    </div>
  )
}

// ─── Plan Section ─────────────────────────────────────────────────────────────

function PlanSection({
  kind,
  items,
  onAdd,
  onEdit,
  onDelete,
  onToggleComplete,
  isMobile,
}: {
  kind: PlanKind
  items: PlanItem[]
  onAdd: (item: Omit<PlanItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onEdit: (id: string, patch: Partial<Pick<PlanItem, 'title' | 'description' | 'dueDate'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggleComplete: (id: string, completed: boolean) => Promise<void>
  isMobile: boolean
}) {
  const meta = SECTION_META[kind]
  const completedCount = items.filter(i => i.completed).length

  return (
    <div>
      {/* Group header — identical to task list group header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 6px 4px',
          borderBottom: '1.5px solid var(--border)',
          marginBottom: 2,
        }}
      >
        <IconFolder size={18} color="var(--fg)" />
        <span
          style={{
            fontFamily: 'var(--font-task)',
            fontSize: 16,
            fontWeight: 'bold',
            color: 'var(--fg)',
          }}
        >
          {meta.label}
        </span>
        {items.length > 0 && (
          <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 2 }}>
            ({items.length}{kind !== 'mission' && completedCount > 0 ? ` · ${completedCount} done` : ''})
          </span>
        )}
      </div>

      {/* Item rows */}
      {items.map(item => (
        <PlanItemRow
          key={item.id}
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleComplete={onToggleComplete}
          isMobile={isMobile}
        />
      ))}

      {/* Inline add row — at bottom of each section */}
      <InlineAddRow kind={kind} onAdd={onAdd} isMobile={isMobile} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyPlanSection({ authedFetch, isMobile = false }: MyPlanSectionProps) {
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await authedFetch('/api/my-plan/notes')
      const data = await res.json() as PlanItemResponse[] | { error?: string }
      if (!res.ok) {
        const err = data as { error?: string }
        throw new Error(err.error ?? 'Failed to load your plan')
      }
      const raw = Array.isArray(data) ? data : []
      const loaded: PlanItem[] = raw
        .filter((d): d is PlanItemResponse => Boolean(d && typeof d === 'object'))
        .filter(d => d.kind === 'mission' || d.kind === 'vision' || d.kind === 'goals')
        .map(d => ({
          id: typeof d.id === 'string' ? d.id : crypto.randomUUID(),
          kind: d.kind as PlanKind,
          title: typeof d.title === 'string' ? d.title : '',
          description: typeof d.description === 'string' ? d.description : '',
          dueDate: typeof d.dueDate === 'string' ? d.dueDate : '',
          completed: Boolean(d.completed),
          completedAt: typeof d.completedAt === 'number' ? d.completedAt : null,
          createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
          updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
        }))
        .sort((a, b) => b.createdAt - a.createdAt)
      setItems(loaded)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load your plan')
    } finally {
      setLoading(false)
    }
  }, [authedFetch])

  useEffect(() => {
    void (async () => { await loadItems() })()
  }, [loadItems])

  const addItem = useCallback(async (payload: Omit<PlanItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const res = await authedFetch('/api/my-plan/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: payload.kind,
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
        completed: payload.completed,
        completedAt: payload.completedAt,
        contentHtml: '<p><br></p>',
        pinned: false,
      }),
    })
    const data = await res.json() as PlanItemResponse
    if (!res.ok) throw new Error(data.error ?? 'Failed to add')
    const created: PlanItem = {
      id: typeof data.id === 'string' ? data.id : crypto.randomUUID(),
      kind: payload.kind,
      title: typeof data.title === 'string' ? data.title : payload.title,
      description: typeof data.description === 'string' ? data.description : payload.description,
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : payload.dueDate,
      completed: Boolean(data.completed),
      completedAt: typeof data.completedAt === 'number' ? data.completedAt : null,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    }
    setItems(prev => [created, ...prev])
  }, [authedFetch])

  const editItem = useCallback(async (id: string, patch: Partial<Pick<PlanItem, 'title' | 'description' | 'dueDate'>>) => {
    const res = await authedFetch(`/api/my-plan/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json() as PlanItemResponse
    if (!res.ok) throw new Error(data.error ?? 'Failed to save')
    setItems(prev => prev.map(item =>
      item.id === id
        ? {
            ...item,
            title: typeof data.title === 'string' ? data.title : item.title,
            description: typeof data.description === 'string' ? data.description : item.description,
            dueDate: typeof data.dueDate === 'string' ? data.dueDate : item.dueDate,
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
          }
        : item
    ))
  }, [authedFetch])

  const deleteItem = useCallback(async (id: string) => {
    const res = await authedFetch(`/api/my-plan/notes/${id}`, { method: 'DELETE' })
    const data = await res.json() as { error?: string }
    if (!res.ok) throw new Error(data.error ?? 'Failed to delete')
    setItems(prev => prev.filter(item => item.id !== id))
  }, [authedFetch])

  const toggleComplete = useCallback(async (id: string, completed: boolean) => {
    const res = await authedFetch(`/api/my-plan/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    const data = await res.json() as PlanItemResponse
    if (!res.ok) throw new Error(data.error ?? 'Failed to update')
    setItems(prev => prev.map(item =>
      item.id === id
        ? {
            ...item,
            completed: Boolean(data.completed),
            completedAt: typeof data.completedAt === 'number' ? data.completedAt : null,
            updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
          }
        : item
    ))
  }, [authedFetch])

  const missions = items.filter(i => i.kind === 'mission')
  const visions = items.filter(i => i.kind === 'vision')
  const goals = items.filter(i => i.kind === 'goals')

  const contentStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: isMobile ? '16px 12px 32px' : '20px 32px 32px 28px',
    background: 'var(--bg)',
  }

  if (loading) {
    return (
      <div style={contentStyle}>
        <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: 20, padding: '40px 0' }}>
          Opening your plan...
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={contentStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: '#a23d52', fontSize: 14, padding: '8px 0' }}>
          <span>{loadError}</span>
          <button
            onClick={() => void (async () => { await loadItems() })()}
            style={{ background: 'transparent', border: '1px solid rgba(162,61,82,0.35)', borderRadius: 2, padding: '5px 12px', fontSize: 13, color: '#a23d52', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={contentStyle}>
      <PlanSection kind="mission" items={missions} onAdd={addItem} onEdit={editItem} onDelete={deleteItem} onToggleComplete={toggleComplete} isMobile={isMobile} />
      <PlanSection kind="vision"  items={visions}  onAdd={addItem} onEdit={editItem} onDelete={deleteItem} onToggleComplete={toggleComplete} isMobile={isMobile} />
      <PlanSection kind="goals"   items={goals}    onAdd={addItem} onEdit={editItem} onDelete={deleteItem} onToggleComplete={toggleComplete} isMobile={isMobile} />
    </div>
  )
}
