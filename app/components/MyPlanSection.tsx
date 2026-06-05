'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const TITLE_MAX = 120
const DESCRIPTION_MAX = 500
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const SECTION_META: Record<PlanKind, { label: string; accent: string; description: string }> = {
  mission: {
    label: 'Mission',
    accent: 'oklch(56% 0.13 25)',
    description: 'The purpose that guides your work and daily choices.',
  },
  vision: {
    label: 'Vision',
    accent: 'oklch(56% 0.11 255)',
    description: 'The future you are building toward — with a deadline.',
  },
  goals: {
    label: 'Goals',
    accent: 'oklch(56% 0.12 85)',
    description: 'Specific outcomes and milestones you want to achieve.',
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
  const d = new Date(dateStr + 'T00:00:00')
  return d < today
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7.5 C3.5 9.2 4.8 10.5 5.5 11 C7 8.5 9.5 5.8 12 3.5" />
    </svg>
  )
}

function IconPencil({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10.5 L1.5 12.5 L3.5 12 L11.5 4 L10 2.5 Z" />
      <path d="M9 3.5 L10.5 5" />
    </svg>
  )
}

function IconTrash({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4 L12 4" />
      <path d="M5 4 L5.5 2.5 L8.5 2.5 L9 4" />
      <path d="M3.5 4 L4.2 12 L9.8 12 L10.5 4" />
      <path d="M6 6.5 L6.2 10" />
      <path d="M8 6.5 L7.8 10" />
    </svg>
  )
}

function IconPlus({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M7 2 L7 12" />
      <path d="M2 7 L12 7" />
    </svg>
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateTitle(title: string): string | null {
  const t = title.trim()
  if (!t) return 'Title is required.'
  if (t.length > TITLE_MAX) return `Title must be ${TITLE_MAX} characters or fewer.`
  return null
}

function validateDueDate(dueDate: string): string | null {
  if (!dueDate) return null
  if (!DATE_RE.test(dueDate)) return 'Invalid date format.'
  return null
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddForm({
  kind,
  onAdd,
  onCancel,
  isMobile,
}: {
  kind: PlanKind
  onAdd: (item: Omit<PlanItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
  isMobile: boolean
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({})
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: { title?: string; dueDate?: string } = {}
    const titleErr = validateTitle(title)
    if (titleErr) errs.title = titleErr
    const dateErr = validateDueDate(dueDate)
    if (dateErr) errs.dueDate = dateErr
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      await onAdd({
        kind,
        title: title.trim(),
        description: description.trim().slice(0, DESCRIPTION_MAX),
        dueDate,
        completed: false,
        completedAt: null,
      })
    } finally {
      setSaving(false)
    }
  }

  const meta = SECTION_META[kind]
  const hasDateField = kind === 'vision' || kind === 'goals'

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--bg)',
        border: `1.5px solid ${meta.accent}`,
        borderRadius: 4,
        padding: isMobile ? '14px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          ref={titleRef}
          value={title}
          onChange={e => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })) }}
          placeholder={`${meta.label} title...`}
          maxLength={TITLE_MAX}
          style={{
            border: errors.title ? '1.5px solid #ef476f' : '1.5px solid var(--border)',
            borderRadius: 2,
            background: 'var(--surface)',
            padding: '9px 12px',
            fontSize: 16,
            fontFamily: 'var(--font-display)',
            color: 'var(--fg)',
            outline: 'none',
            width: '100%',
          }}
        />
        {errors.title && <span style={{ fontSize: 12, color: '#a23d52' }}>{errors.title}</span>}
      </div>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Short description (optional)..."
        maxLength={DESCRIPTION_MAX}
        rows={2}
        style={{
          border: '1.5px solid var(--border)',
          borderRadius: 2,
          background: 'var(--surface)',
          padding: '9px 12px',
          fontSize: 14,
          fontFamily: 'var(--font-body)',
          color: 'var(--fg)',
          outline: 'none',
          width: '100%',
          resize: 'vertical',
          lineHeight: 1.5,
        }}
      />

      {hasDateField && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Due date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={e => { setDueDate(e.target.value); setErrors(prev => ({ ...prev, dueDate: undefined })) }}
            style={{
              border: errors.dueDate ? '1.5px solid #ef476f' : '1.5px solid var(--border)',
              borderRadius: 2,
              background: 'var(--surface)',
              padding: '8px 12px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              color: 'var(--fg)',
              outline: 'none',
            }}
          />
          {errors.dueDate && <span style={{ fontSize: 12, color: '#a23d52' }}>{errors.dueDate}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: '1.5px solid var(--border)',
            borderRadius: 2,
            padding: '8px 14px',
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            background: meta.accent,
            border: 'none',
            borderRadius: 2,
            padding: '8px 18px',
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            color: 'white',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Adding...' : `Add ${meta.label}`}
        </button>
      </div>
    </form>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function EditForm({
  item,
  onSave,
  onCancel,
  isMobile,
}: {
  item: PlanItem
  onSave: (id: string, patch: Partial<Pick<PlanItem, 'title' | 'description' | 'dueDate'>>) => Promise<void>
  onCancel: () => void
  isMobile: boolean
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description || '')
  const [dueDate, setDueDate] = useState(item.dueDate || '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({})
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: { title?: string; dueDate?: string } = {}
    const titleErr = validateTitle(title)
    if (titleErr) errs.title = titleErr
    const dateErr = validateDueDate(dueDate)
    if (dateErr) errs.dueDate = dateErr
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave(item.id, { title: title.trim(), description: description.trim().slice(0, DESCRIPTION_MAX), dueDate })
    } finally {
      setSaving(false)
    }
  }

  const meta = SECTION_META[item.kind]
  const hasDateField = item.kind === 'vision' || item.kind === 'goals'

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: isMobile ? '12px 0 4px' : '10px 0 4px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          ref={titleRef}
          value={title}
          onChange={e => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })) }}
          maxLength={TITLE_MAX}
          style={{
            border: errors.title ? '1.5px solid #ef476f' : '1.5px solid var(--border)',
            borderRadius: 2,
            background: 'var(--bg)',
            padding: '8px 10px',
            fontSize: 15,
            fontFamily: 'var(--font-display)',
            color: 'var(--fg)',
            outline: 'none',
            width: '100%',
          }}
        />
        {errors.title && <span style={{ fontSize: 12, color: '#a23d52' }}>{errors.title}</span>}
      </div>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Short description (optional)..."
        maxLength={DESCRIPTION_MAX}
        rows={2}
        style={{
          border: '1.5px solid var(--border)',
          borderRadius: 2,
          background: 'var(--bg)',
          padding: '8px 10px',
          fontSize: 13,
          fontFamily: 'var(--font-body)',
          color: 'var(--fg)',
          outline: 'none',
          width: '100%',
          resize: 'vertical',
          lineHeight: 1.5,
        }}
      />

      {hasDateField && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Due date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={e => { setDueDate(e.target.value); setErrors(prev => ({ ...prev, dueDate: undefined })) }}
            style={{
              border: errors.dueDate ? '1.5px solid #ef476f' : '1.5px solid var(--border)',
              borderRadius: 2,
              background: 'var(--bg)',
              padding: '7px 10px',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              color: 'var(--fg)',
              outline: 'none',
            }}
          />
          {errors.dueDate && <span style={{ fontSize: 12, color: '#a23d52' }}>{errors.dueDate}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            background: meta.accent,
            border: 'none',
            borderRadius: 2,
            padding: '7px 16px',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'white',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: '1.5px solid var(--border)',
            borderRadius: 2,
            padding: '7px 14px',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Plan Card (Mission / Vision) ─────────────────────────────────────────────

function PlanCard({
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
  const [actionError, setActionError] = useState<string | null>(null)
  const meta = SECTION_META[item.kind]
  const hasComplete = item.kind === 'vision' || item.kind === 'goals'

  const handleDelete = () => {
    if (!window.confirm(`Delete this ${meta.label.toLowerCase()}?`)) return
    void onDelete(item.id).catch(err => setActionError(err instanceof Error ? err.message : 'Delete failed'))
  }

  const handleToggle = () => {
    void onToggleComplete(item.id, !item.completed).catch(err => setActionError(err instanceof Error ? err.message : 'Update failed'))
  }

  const handleSave = async (id: string, patch: Partial<Pick<PlanItem, 'title' | 'description' | 'dueDate'>>) => {
    await onEdit(id, patch)
    setEditing(false)
  }

  const overdue = !item.completed && item.dueDate && isPast(item.dueDate)

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${item.completed ? 'var(--border)' : meta.accent}`,
        borderRadius: 4,
        padding: isMobile ? '14px' : '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: item.completed ? 0.75 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {hasComplete && (
            <button
              onClick={handleToggle}
              title={item.completed ? 'Mark incomplete' : 'Mark complete'}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: item.completed ? 'none' : `2px solid ${meta.accent}`,
                background: item.completed ? 'var(--success, #6bcb77)' : 'transparent',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              {item.completed && <IconCheck size={12} />}
            </button>
          )}
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: isMobile ? 17 : 19,
              color: item.completed ? 'var(--muted)' : 'var(--fg)',
              textDecorationLine: item.completed ? 'line-through' : 'none',
              textDecorationColor: 'rgba(107,203,119,0.5)',
              textDecorationThickness: 2,
              wordBreak: 'break-word',
              lineHeight: 1.3,
            }}
          >
            {item.title}
          </div>
        </div>

        {!editing && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setEditing(true)}
              title="Edit"
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 2, padding: '5px 7px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
            >
              <IconPencil size={13} />
            </button>
            <button
              onClick={handleDelete}
              title="Delete"
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 2, padding: '5px 7px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
            >
              <IconTrash size={13} />
            </button>
          </div>
        )}
      </div>

      {!editing && item.description && (
        <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, paddingLeft: hasComplete ? 32 : 0 }}>
          {item.description}
        </div>
      )}

      {!editing && (item.dueDate || item.completedAt) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: hasComplete ? 32 : 0 }}>
          {item.dueDate && !item.completed && (
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: overdue ? '#a23d52' : 'var(--muted)',
                background: overdue ? 'rgba(239,71,111,0.08)' : 'var(--bg)',
                border: `1px solid ${overdue ? 'rgba(239,71,111,0.25)' : 'var(--border)'}`,
                borderRadius: 999,
                padding: '2px 9px',
                letterSpacing: '0.04em',
              }}
            >
              {overdue ? '⚠ ' : ''}Due {formatDate(item.dueDate)}
            </span>
          )}
          {item.completed && item.completedAt && (
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: '#3a9163',
                background: 'rgba(107,203,119,0.1)',
                border: '1px solid rgba(107,203,119,0.3)',
                borderRadius: 999,
                padding: '2px 9px',
                letterSpacing: '0.04em',
              }}
            >
              ✓ Completed {formatCompletedAt(item.completedAt)}
            </span>
          )}
          {item.completed && item.dueDate && (
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--muted)',
                letterSpacing: '0.04em',
              }}
            >
              Target was {formatDate(item.dueDate)}
            </span>
          )}
        </div>
      )}

      {editing && (
        <EditForm
          item={item}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          isMobile={isMobile}
        />
      )}

      {actionError && (
        <div style={{ fontSize: 12, color: '#a23d52', lineHeight: 1.5 }}>{actionError}</div>
      )}
    </div>
  )
}

// ─── Goal Row (compact list item) ─────────────────────────────────────────────

function GoalRow({
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
  const [actionError, setActionError] = useState<string | null>(null)
  const meta = SECTION_META['goals']
  const overdue = !item.completed && item.dueDate && isPast(item.dueDate)

  const handleDelete = () => {
    if (!window.confirm('Delete this goal?')) return
    void onDelete(item.id).catch(err => setActionError(err instanceof Error ? err.message : 'Delete failed'))
  }

  const handleToggle = () => {
    void onToggleComplete(item.id, !item.completed).catch(err => setActionError(err instanceof Error ? err.message : 'Update failed'))
  }

  const handleSave = async (id: string, patch: Partial<Pick<PlanItem, 'title' | 'description' | 'dueDate'>>) => {
    await onEdit(id, patch)
    setEditing(false)
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${item.completed ? 'var(--border)' : meta.accent}`,
        borderRadius: '0 4px 4px 0',
        padding: isMobile ? '12px 12px 12px 14px' : '12px 14px 12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        opacity: item.completed ? 0.72 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
          <button
            onClick={handleToggle}
            title={item.completed ? 'Mark incomplete' : 'Mark complete'}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: item.completed ? 'none' : `2px solid ${meta.accent}`,
              background: item.completed ? 'var(--success, #6bcb77)' : 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              marginTop: 2,
            }}
          >
            {item.completed && <IconCheck size={10} />}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: isMobile ? 16 : 17,
                color: item.completed ? 'var(--muted)' : 'var(--fg)',
                textDecorationLine: item.completed ? 'line-through' : 'none',
                textDecorationColor: 'rgba(107,203,119,0.5)',
                textDecorationThickness: 2,
                wordBreak: 'break-word',
                lineHeight: 1.3,
              }}
            >
              {item.title}
            </div>
            {item.description && !editing && (
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginTop: 3 }}>
                {item.description}
              </div>
            )}
          </div>
        </div>

        {!editing && (
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button
              onClick={() => setEditing(true)}
              title="Edit"
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 2, padding: '4px 6px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
            >
              <IconPencil size={12} />
            </button>
            <button
              onClick={handleDelete}
              title="Delete"
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 2, padding: '4px 6px', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
            >
              <IconTrash size={12} />
            </button>
          </div>
        )}
      </div>

      {!editing && (item.dueDate || item.completedAt) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 30 }}>
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
                letterSpacing: '0.04em',
              }}
            >
              {overdue ? '⚠ ' : ''}Due {formatDate(item.dueDate)}
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
                letterSpacing: '0.04em',
              }}
            >
              ✓ {formatCompletedAt(item.completedAt)}
            </span>
          )}
        </div>
      )}

      {editing && (
        <div style={{ paddingLeft: 30 }}>
          <EditForm
            item={item}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            isMobile={isMobile}
          />
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: 12, color: '#a23d52', paddingLeft: 30 }}>{actionError}</div>
      )}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  kind,
  count,
  completedCount,
  onAdd,
  addingNew,
}: {
  kind: PlanKind
  count: number
  completedCount?: number
  onAdd: () => void
  addingNew: boolean
}) {
  const meta = SECTION_META[kind]
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        borderBottom: `2px solid ${meta.accent}`,
        paddingBottom: 10,
        marginBottom: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--fg)',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {meta.label}
        </h2>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {meta.description}
        </span>
        {count > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--muted)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '1px 8px',
                letterSpacing: '0.08em',
              }}
            >
              {count} total
            </span>
            {completedCount !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: completedCount > 0 ? '#3a9163' : 'var(--muted)',
                  background: completedCount > 0 ? 'rgba(107,203,119,0.08)' : 'var(--bg)',
                  border: `1px solid ${completedCount > 0 ? 'rgba(107,203,119,0.3)' : 'var(--border)'}`,
                  borderRadius: 999,
                  padding: '1px 8px',
                  letterSpacing: '0.08em',
                }}
              >
                {completedCount} done
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onAdd}
        disabled={addingNew}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: addingNew ? 'var(--border)' : meta.accent,
          color: 'white',
          border: 'none',
          borderRadius: 2,
          padding: '7px 13px',
          fontSize: 13,
          fontFamily: 'var(--font-body)',
          cursor: addingNew ? 'default' : 'pointer',
          flexShrink: 0,
        }}
      >
        <IconPlus size={12} color="white" />
        Add {meta.label}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyPlanSection({ authedFetch, isMobile = false }: MyPlanSectionProps) {
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [addingKind, setAddingKind] = useState<PlanKind | null>(null)

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
    setSaveState('saving')
    try {
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
      if (!res.ok) throw new Error(data.error ?? 'Failed to add item')
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
      setAddingKind(null)
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      throw err
    }
  }, [authedFetch])

  const editItem = useCallback(async (id: string, patch: Partial<Pick<PlanItem, 'title' | 'description' | 'dueDate'>>) => {
    setSaveState('saving')
    try {
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
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      throw err
    }
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
  const completedGoals = goals.filter(g => g.completed).length
  const completedVisions = visions.filter(v => v.completed).length

  const containerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: isMobile ? '12px 12px 32px' : '24px 32px 40px',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px dashed var(--border)',
            borderRadius: 4,
            padding: '32px 24px',
            color: 'var(--muted)',
            fontFamily: 'var(--font-display)',
            fontSize: 20,
          }}
        >
          Opening your plan...
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            border: '1px solid rgba(239,71,111,0.25)',
            background: 'rgba(239,71,111,0.08)',
            color: '#a23d52',
            borderRadius: 4,
            padding: '14px 16px',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>{loadError}</span>
          <button
            onClick={() => void loadItems()}
            style={{
              background: 'transparent',
              border: '1px solid rgba(162,61,82,0.35)',
              borderRadius: 2,
              padding: '6px 12px',
              fontSize: 13,
              color: '#a23d52',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Page header */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 4,
          padding: isMobile ? '16px' : '20px 24px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
            Plan
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 22 : 28, lineHeight: 1.15, color: 'var(--fg)' }}>
            Your Mission, Vision & Goals
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatPill label="Mission" value={missions.length} />
          <StatPill label="Vision" value={visions.length} completed={completedVisions} />
          <StatPill label="Goals" value={goals.length} completed={completedGoals} />
        </div>
      </div>

      {saveState === 'error' && (
        <div style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.2)', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#a23d52' }}>
          Something went wrong saving. Please try again.
        </div>
      )}

      {/* Mission Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeader
          kind="mission"
          count={missions.length}
          onAdd={() => setAddingKind(addingKind === 'mission' ? null : 'mission')}
          addingNew={addingKind === 'mission'}
        />

        {addingKind === 'mission' && (
          <AddForm
            kind="mission"
            onAdd={addItem}
            onCancel={() => setAddingKind(null)}
            isMobile={isMobile}
          />
        )}

        {missions.length === 0 && addingKind !== 'mission' ? (
          <EmptyState kind="mission" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {missions.map(item => (
              <PlanCard
                key={item.id}
                item={item}
                onEdit={editItem}
                onDelete={deleteItem}
                onToggleComplete={toggleComplete}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </section>

      {/* Vision Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeader
          kind="vision"
          count={visions.length}
          completedCount={completedVisions}
          onAdd={() => setAddingKind(addingKind === 'vision' ? null : 'vision')}
          addingNew={addingKind === 'vision'}
        />

        {addingKind === 'vision' && (
          <AddForm
            kind="vision"
            onAdd={addItem}
            onCancel={() => setAddingKind(null)}
            isMobile={isMobile}
          />
        )}

        {visions.length === 0 && addingKind !== 'vision' ? (
          <EmptyState kind="vision" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visions.map(item => (
              <PlanCard
                key={item.id}
                item={item}
                onEdit={editItem}
                onDelete={deleteItem}
                onToggleComplete={toggleComplete}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </section>

      {/* Goals Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeader
          kind="goals"
          count={goals.length}
          completedCount={completedGoals}
          onAdd={() => setAddingKind(addingKind === 'goals' ? null : 'goals')}
          addingNew={addingKind === 'goals'}
        />

        {addingKind === 'goals' && (
          <AddForm
            kind="goals"
            onAdd={addItem}
            onCancel={() => setAddingKind(null)}
            isMobile={isMobile}
          />
        )}

        {goals.length === 0 && addingKind !== 'goals' ? (
          <EmptyState kind="goals" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {goals.map(item => (
              <GoalRow
                key={item.id}
                item={item}
                onEdit={editItem}
                onDelete={deleteItem}
                onToggleComplete={toggleComplete}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatPill({ label, value, completed }: { label: string; value: number; completed?: number }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '8px 12px',
        minWidth: 72,
        background: 'var(--bg)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--fg)', lineHeight: 1, marginTop: 2 }}>
        {value}
        {completed !== undefined && value > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-body)', marginLeft: 4 }}>
            / {completed} done
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyState({ kind }: { kind: PlanKind }) {
  const messages: Record<PlanKind, string> = {
    mission: 'No mission statements yet. Add one to define your purpose.',
    vision: 'No vision statements yet. Paint the future you\'re working toward.',
    goals: 'No goals yet. Break your vision into specific, achievable targets.',
  }
  return (
    <div
      style={{
        border: '1.5px dashed var(--border)',
        borderRadius: 4,
        padding: '24px 20px',
        color: 'var(--muted)',
        fontSize: 14,
        fontFamily: 'var(--font-body)',
        lineHeight: 1.6,
        textAlign: 'center',
      }}
    >
      {messages[kind]}
    </div>
  )
}
