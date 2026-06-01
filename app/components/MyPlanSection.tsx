'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

type NoteKind = 'mission' | 'vision' | 'values' | 'principles' | 'goals' | 'custom'
type NoteFilter = 'all' | 'pinned' | NoteKind

type NotebookNote = {
  id: string
  kind: NoteKind
  title: string
  contentHtml: string
  pinned: boolean
  createdAt: number
  updatedAt: number
}

type NotebookNoteResponse = Partial<NotebookNote> & {
  error?: string
}

type MyPlanSectionProps = {
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  isMobile?: boolean
}

type SaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type NoteMeta = {
  label: string
  title: string
  placeholder: string
  accent: string
  defaultPinned: boolean
}

const NOTE_META: Record<NoteKind, NoteMeta> = {
  mission: {
    label: 'Mission',
    title: 'Mission',
    placeholder: 'Write the purpose that guides your work and daily choices...',
    accent: 'oklch(56% 0.13 25)',
    defaultPinned: true,
  },
  vision: {
    label: 'Vision',
    title: 'Vision',
    placeholder: 'Describe the future you are building toward...',
    accent: 'oklch(56% 0.11 255)',
    defaultPinned: true,
  },
  values: {
    label: 'Core Values',
    title: 'Core Values',
    placeholder: 'List the values that should shape how you live and decide...',
    accent: 'oklch(56% 0.12 150)',
    defaultPinned: false,
  },
  principles: {
    label: 'Personal Principles',
    title: 'Personal Principles',
    placeholder: 'Write the rules you want to live by, especially when life gets noisy...',
    accent: 'oklch(56% 0.12 305)',
    defaultPinned: false,
  },
  goals: {
    label: 'Life Goals',
    title: 'Life Goals',
    placeholder: 'Capture the big outcomes and milestones you want to pursue...',
    accent: 'oklch(56% 0.12 85)',
    defaultPinned: false,
  },
  custom: {
    label: 'Note',
    title: 'New Note',
    placeholder: 'Start writing...',
    accent: 'oklch(56% 0.08 215)',
    defaultPinned: false,
  },
}

const KIND_OPTIONS: NoteKind[] = ['mission', 'vision', 'values', 'principles', 'goals', 'custom']
const TITLE_MAX = 120
const AUTOSAVE_DELAY = 800

function defaultTitle(kind: NoteKind) {
  return NOTE_META[kind].title
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, '\n')
}

function emptyHtml() {
  return '<p><br></p>'
}

function isEmptyHtml(html: string) {
  return htmlToPlainText(html).length === 0
}

function htmlToPlainText(html: string) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

function sanitizeHtml(html: string) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const allowed = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a'])

  const walk = (node: ParentNode) => {
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        const tag = el.tagName.toLowerCase()

        if (!allowed.has(tag)) {
          const parent = el.parentNode
          while (el.firstChild) parent?.insertBefore(el.firstChild, el)
          parent?.removeChild(el)
          return
        }

        Array.from(el.attributes).forEach(attr => {
          if (tag === 'a' && attr.name === 'href') return
          el.removeAttribute(attr.name)
        })

        if (tag === 'a') {
          const href = (el.getAttribute('href') || '').trim()
          if (!/^https?:\/\/|^mailto:|^\/|^#/i.test(href)) {
            el.removeAttribute('href')
          }
        }

        walk(el)
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.remove()
      }
    })
  }

  walk(doc.body)

  const cleaned = doc.body.innerHTML.trim()
  return cleaned || emptyHtml()
}

function sortNotes(notes: NotebookNote[]) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const aStamp = a.updatedAt || a.createdAt
    const bStamp = b.updatedAt || b.createdAt
    if (aStamp !== bStamp) return bStamp - aStamp
    return b.createdAt - a.createdAt
  })
}

function noteMatchesQuery(note: NotebookNote, query: string) {
  if (!query) return true
  const haystack = [
    note.title,
    NOTE_META[note.kind].label,
    htmlToPlainText(note.contentHtml),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function formatSavedAt(timestamp: number | null) {
  if (!timestamp) return 'Saved'
  return `Saved ${new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

export default function MyPlanSection({ authedFetch, isMobile = false }: MyPlanSectionProps) {
  const [notes, setNotes] = useState<NotebookNote[]>([])
  const [status, setStatus] = useState<SaveState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<NoteFilter>('all')
  const [composerKind, setComposerKind] = useState<NoteKind>('custom')
  const [composerTitle, setComposerTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const notesRef = useRef(notes)
  const queryLower = query.trim().toLowerCase()

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const loadNotes = useCallback(async () => {
    setStatus('loading')
    setError(null)

    const response = await authedFetch('/api/my-plan/notes')
    const data = (await response.json()) as NotebookNoteResponse[] | { error?: string }

    if (!response.ok) {
      const errorBody = data as { error?: string }
      throw new Error(errorBody.error ?? 'Failed to load your notebook')
    }

    const loaded = Array.isArray(data)
      ? data
          .filter((note): note is NotebookNoteResponse => Boolean(note && typeof note === 'object'))
          .map(note => ({
            id: typeof note.id === 'string' ? note.id : crypto.randomUUID(),
            kind: (typeof note.kind === 'string' && note.kind in NOTE_META ? note.kind : 'custom') as NoteKind,
            title: typeof note.title === 'string' ? note.title : defaultTitle('custom'),
            contentHtml: typeof note.contentHtml === 'string' ? sanitizeHtml(note.contentHtml) : emptyHtml(),
            pinned: Boolean(note.pinned),
            createdAt: typeof note.createdAt === 'number' ? note.createdAt : Date.now(),
            updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
          }))
      : []

    setNotes(sortNotes(loaded))
    setStatus('idle')
  }, [authedFetch])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        await loadNotes()
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to load your notebook')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadNotes])

  const createNote = useCallback(async (kind: NoteKind, title?: string) => {
    const resolvedTitle = normalizeText(title ?? defaultTitle(kind)).trim() || defaultTitle(kind)
    setCreating(true)
    setError(null)

    const response = await authedFetch('/api/my-plan/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        title: resolvedTitle,
        contentHtml: emptyHtml(),
        pinned: NOTE_META[kind].defaultPinned,
      }),
    })

    const data = (await response.json()) as NotebookNoteResponse
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to create note')
    }

    const created: NotebookNote = {
      id: typeof data.id === 'string' ? data.id : crypto.randomUUID(),
      kind: (typeof data.kind === 'string' && data.kind in NOTE_META ? data.kind : kind) as NoteKind,
      title: typeof data.title === 'string' ? data.title : resolvedTitle,
      contentHtml: typeof data.contentHtml === 'string' ? sanitizeHtml(data.contentHtml) : emptyHtml(),
      pinned: Boolean(data.pinned ?? NOTE_META[kind].defaultPinned),
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    }

    setNotes(prev => sortNotes([created, ...prev]))
    setComposerTitle('')
    setComposerKind('custom')
    return created
  }, [authedFetch])

  const updateNote = useCallback(async (id: string, patch: Partial<Pick<NotebookNote, 'kind' | 'title' | 'contentHtml' | 'pinned'>>) => {
    const current = notesRef.current.find(note => note.id === id)
    if (!current) throw new Error('Note not found')

    const payload: Record<string, unknown> = {}
    if (patch.kind !== undefined) payload.kind = patch.kind
    if (patch.title !== undefined) payload.title = normalizeText(patch.title)
    if (patch.contentHtml !== undefined) payload.contentHtml = sanitizeHtml(patch.contentHtml)
    if (patch.pinned !== undefined) payload.pinned = patch.pinned

    const response = await authedFetch(`/api/my-plan/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as NotebookNoteResponse
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to save note')
    }

    const updated: NotebookNote = {
      ...current,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    }
    if (typeof data.kind === 'string' && data.kind in NOTE_META) updated.kind = data.kind as NoteKind
    if (typeof data.title === 'string') updated.title = data.title
    if (typeof data.contentHtml === 'string') updated.contentHtml = sanitizeHtml(data.contentHtml)
    if (typeof data.pinned === 'boolean') updated.pinned = data.pinned

    setNotes(prev => sortNotes(prev.map(note => (note.id === id ? updated : note))))
    return updated
  }, [authedFetch])

  const deleteNote = useCallback(async (id: string) => {
    const current = notesRef.current.find(note => note.id === id)
    if (!current) return

    const response = await authedFetch(`/api/my-plan/notes/${id}`, { method: 'DELETE' })
    const data = (await response.json()) as NotebookNoteResponse
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to delete note')
    }

    setNotes(prev => prev.filter(note => note.id !== id))
  }, [authedFetch])

  const togglePin = useCallback(async (id: string, nextPinned: boolean) => {
    return updateNote(id, { pinned: nextPinned })
  }, [updateNote])

  const visibleNotes = useMemo(() => {
    return sortNotes(
      notes.filter(note => {
        if (activeFilter === 'pinned' && !note.pinned) return false
        if (activeFilter !== 'all' && activeFilter !== 'pinned' && note.kind !== activeFilter) return false
        return noteMatchesQuery(note, queryLower)
      })
    )
  }, [activeFilter, notes, queryLower])

  const pinnedCount = notes.filter(note => note.pinned).length
  const missionCount = notes.filter(note => note.kind === 'mission').length
  const visionCount = notes.filter(note => note.kind === 'vision').length

  const retryLoad = () => {
    void loadNotes().catch(err => {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to load your notebook')
    })
  }

  const addTemplate = (kind: NoteKind) => {
    void createNote(kind).catch(err => {
      setCreating(false)
      setError(err instanceof Error ? err.message : 'Failed to create note')
    }).finally(() => setCreating(false))
  }

  const addCustomNote = () => {
    const title = composerTitle.trim() || defaultTitle(composerKind)
    void createNote(composerKind, title).catch(err => {
      setCreating(false)
      setError(err instanceof Error ? err.message : 'Failed to create note')
    }).finally(() => setCreating(false))
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '12px 12px 28px' : '20px 28px 32px',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 2,
          padding: isMobile ? '14px 14px 12px' : '18px 20px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: isMobile ? 'flex-start' : 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Mission & Vision Notebook
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 24 : 30, lineHeight: 1.1, color: 'var(--fg)' }}>
            A place to keep your direction, principles, and long-term goals visible.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <StatPill label="Notes" value={notes.length} />
          <StatPill label="Pinned" value={pinnedCount} />
          <StatPill label="Mission" value={missionCount} />
          <StatPill label="Vision" value={visionCount} />
        </div>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid rgba(239,71,111,0.25)',
            background: 'rgba(239,71,111,0.08)',
            color: '#a23d52',
            borderRadius: 2,
            padding: '10px 12px',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>{error}</span>
          <button
            onClick={retryLoad}
            style={{
              background: 'transparent',
              border: '1px solid rgba(162,61,82,0.35)',
              borderRadius: 2,
              padding: '6px 10px',
              fontSize: 13,
              color: '#a23d52',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 2,
          padding: isMobile ? '12px' : '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: isMobile ? 'stretch' : 'center' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your notebook..."
            style={{
              flex: 1,
              border: '1.5px solid var(--border)',
              borderRadius: 2,
              background: 'transparent',
              padding: '10px 12px',
              fontSize: 16,
              color: 'var(--fg)',
              outline: 'none',
              fontFamily: 'var(--font-body)',
            }}
          />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {visibleNotes.length} shown
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {([
            ['all', 'All'],
            ['pinned', 'Pinned'],
            ...KIND_OPTIONS.map(kind => [kind, NOTE_META[kind].label] as const),
          ] as const).map(([value, label]) => {
            const active = activeFilter === value
            return (
              <button
                key={value}
                onClick={() => setActiveFilter(value)}
                style={{
                  background: active ? 'var(--fg)' : 'transparent',
                  color: active ? 'var(--surface)' : 'var(--muted)',
                  border: `1.5px solid ${active ? 'var(--fg)' : 'var(--border)'}`,
                  borderRadius: 2,
                  padding: '5px 10px',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {(['mission', 'vision', 'values', 'principles', 'goals'] as NoteKind[]).map(kind => (
          <button
            key={kind}
            onClick={() => addTemplate(kind)}
            disabled={creating}
            style={{
              background: NOTE_META[kind].accent,
              color: 'white',
              border: 'none',
              borderRadius: 2,
              padding: '8px 12px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.65 : 1,
            }}
          >
            + {NOTE_META[kind].label}
          </button>
        ))}
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 2,
          padding: isMobile ? '14px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--fg)' }}>
              New note
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
              Create a notebook page entry, then write the long form directly inside the card.
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Autosaves note cards as you write.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '180px 1fr auto', gap: 10, alignItems: 'center' }}>
          <select
            value={composerKind}
            onChange={e => setComposerKind(e.target.value as NoteKind)}
            style={{
              border: '1.5px solid var(--border)',
              borderRadius: 2,
              padding: '10px 12px',
              background: 'transparent',
              color: 'var(--fg)',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {KIND_OPTIONS.map(kind => (
              <option key={kind} value={kind}>
                {NOTE_META[kind].label}
              </option>
            ))}
          </select>

          <input
            value={composerTitle}
            onChange={e => setComposerTitle(e.target.value)}
            placeholder={NOTE_META[composerKind].title}
            maxLength={TITLE_MAX}
            style={{
              border: '1.5px solid var(--border)',
              borderRadius: 2,
              padding: '10px 12px',
              background: 'transparent',
              color: 'var(--fg)',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              outline: 'none',
            }}
          />

          <button
            onClick={addCustomNote}
            disabled={creating}
            style={{
              background: 'var(--fg)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 2,
              padding: '10px 16px',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.65 : 1,
            }}
          >
            Add note
          </button>
        </div>
      </div>

      {status === 'loading' ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px dashed var(--border)',
            borderRadius: 2,
            padding: '22px',
            color: 'var(--muted)',
            fontFamily: 'var(--font-display)',
            fontSize: 20,
          }}
        >
          Opening your notebook...
        </div>
      ) : visibleNotes.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px dashed var(--border)',
            borderRadius: 2,
            padding: isMobile ? '32px 16px' : '52px 24px',
            textAlign: 'center',
            color: 'var(--muted)',
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            lineHeight: 1.8,
          }}
        >
          <div style={{ color: 'var(--fg)', marginBottom: 4 }}>Start with Mission and Vision, then add the rest of your notebook pages.</div>
          <div style={{ fontSize: 16, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
            Use the template buttons above to create your first note cards.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 14,
            alignItems: 'start',
          }}
        >
          {visibleNotes.map(note => (
            <NotebookNoteCard
              key={note.id}
              note={note}
              isMobile={isMobile}
              onSave={updateNote}
              onDelete={deleteNote}
              onTogglePin={togglePin}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 2,
        padding: '6px 10px',
        minWidth: 72,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--fg)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function NotebookNoteCard({
  note,
  isMobile = false,
  onSave,
  onDelete,
  onTogglePin,
}: {
  note: NotebookNote
  isMobile?: boolean
  onSave: (id: string, patch: Partial<Pick<NotebookNote, 'kind' | 'title' | 'contentHtml' | 'pinned'>>) => Promise<NotebookNote>
  onDelete: (id: string) => Promise<void>
  onTogglePin: (id: string, pinned: boolean) => Promise<NotebookNote>
}) {
  const [title, setTitle] = useState(note.title)
  const [contentHtml, setContentHtml] = useState(note.contentHtml)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef({ title: note.title, contentHtml: note.contentHtml, pinned: note.pinned, kind: note.kind })

  useEffect(() => {
    setTitle(note.title)
    setContentHtml(note.contentHtml)
    setSaveState('idle')
    setError(null)
    lastSavedRef.current = {
      title: note.title,
      contentHtml: note.contentHtml,
      pinned: note.pinned,
      kind: note.kind,
    }
    if (editorRef.current && !focused) {
      editorRef.current.innerHTML = note.contentHtml || emptyHtml()
    }
  }, [note.id, note.updatedAt])

  useEffect(() => {
    if (!editorRef.current || focused) return
    if (editorRef.current.innerHTML !== contentHtml) {
      editorRef.current.innerHTML = contentHtml || emptyHtml()
    }
  }, [contentHtml, focused])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmedTitle = normalizeText(title).trim()
    const normalizedHtml = sanitizeHtml(contentHtml)
    const changed =
      trimmedTitle !== lastSavedRef.current.title ||
      normalizedHtml !== lastSavedRef.current.contentHtml ||
      note.pinned !== lastSavedRef.current.pinned ||
      note.kind !== lastSavedRef.current.kind

    if (!changed) {
      setSaveState('idle')
      return
    }

    if (!trimmedTitle) {
      setSaveState('error')
      setError('Title is required before saving.')
      return
    }

    setSaveState('idle')
    timerRef.current = setTimeout(() => {
      void persist()
    }, AUTOSAVE_DELAY)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, contentHtml, note.pinned, note.kind])

  const persist = useCallback(async () => {
    const trimmedTitle = normalizeText(title).trim()
    if (!trimmedTitle) {
      setSaveState('error')
      setError('Title is required before saving.')
      return
    }

    const normalizedHtml = sanitizeHtml(contentHtml)
    setSaveState('saving')
    setError(null)

    try {
      const updated = await onSave(note.id, {
        title: trimmedTitle,
        contentHtml: normalizedHtml,
      })
      lastSavedRef.current = {
        title: updated.title,
        contentHtml: updated.contentHtml,
        pinned: updated.pinned,
        kind: updated.kind,
      }
      setTitle(updated.title)
      setContentHtml(updated.contentHtml)
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      setError(err instanceof Error ? err.message : 'Failed to save note')
    }
  }, [contentHtml, note.id, onSave, title])

  const flushSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    void persist()
  }

  const setEditorHtml = (value: string) => {
    const cleaned = sanitizeHtml(value)
    setContentHtml(cleaned)
    setError(null)
    if (saveState === 'saved' || saveState === 'error') setSaveState('idle')
  }

  const exec = (command: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false)
    const nextHtml = sanitizeHtml(editorRef.current?.innerHTML || emptyHtml())
    setEditorHtml(nextHtml)
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this note?')) return
    void onDelete(note.id).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    })
  }

  const handlePin = () => {
    void onTogglePin(note.id, !note.pinned).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to update note')
    })
  }

  const meta = NOTE_META[note.kind]
  const words = htmlToPlainText(contentHtml).split(/\s+/).filter(Boolean).length

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${note.pinned ? meta.accent : 'var(--border)'}`,
        borderRadius: 2,
        padding: isMobile ? '14px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        boxShadow: note.pinned ? '0 2px 0 rgba(0,0,0,0.03)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              background: note.pinned ? meta.accent : 'transparent',
              color: note.pinned ? 'white' : 'var(--muted)',
              border: `1.5px solid ${meta.accent}`,
              borderRadius: 999,
              padding: '4px 9px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {meta.label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {saveState === 'saving' && 'Saving...'}
            {saveState === 'saved' && formatSavedAt(note.updatedAt)}
            {saveState === 'idle' && ' '}
            {saveState === 'error' && 'Needs attention'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handlePin}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
            style={{
              background: note.pinned ? meta.accent : 'transparent',
              color: note.pinned ? 'white' : 'var(--muted)',
              border: `1px solid ${meta.accent}`,
              borderRadius: 2,
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            {note.pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            onClick={handleDelete}
            title="Delete note"
            style={{
              background: 'transparent',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 2,
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={e => {
          setTitle(e.target.value)
          setError(null)
        }}
        onBlur={flushSave}
        maxLength={TITLE_MAX}
        placeholder={meta.title}
        style={{
          width: '100%',
          border: 'none',
          borderBottom: '1.5px dashed var(--border)',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          lineHeight: 1.15,
          color: 'var(--fg)',
          padding: '2px 0 6px',
        }}
      />

      <RichTextField
        editorRef={editorRef}
        value={contentHtml}
        placeholder={meta.placeholder}
        onChange={setEditorHtml}
        onBlur={flushSave}
        onFocus={() => setFocused(true)}
        onFocusLost={() => setFocused(false)}
        onToolbarAction={exec}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {words} word{words === 1 ? '' : 's'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {saveState === 'error' ? error : note.pinned ? 'Pinned to the top' : 'Autosaves while you write'}
        </div>
      </div>

      {error && saveState === 'error' && (
        <div style={{ color: '#a23d52', fontSize: 13, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
    </div>
  )
}

type RichTextFieldProps = {
  editorRef: RefObject<HTMLDivElement | null>
  value: string
  placeholder: string
  onChange: (value: string) => void
  onBlur: () => void
  onFocus: () => void
  onFocusLost: () => void
  onToolbarAction: (command: string) => void
}

const RichTextField = (() => {
  return function RichTextField({
    editorRef,
    value,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    onFocusLost,
    onToolbarAction,
  }: RichTextFieldProps) {
    const [active, setActive] = useState(false)

    useEffect(() => {
      if (!editorRef.current || active) return
      const next = value || emptyHtml()
      if (editorRef.current.innerHTML !== next) {
        editorRef.current.innerHTML = next
      }
    }, [active, value])

    const handleInput = () => {
      const raw = editorRef.current?.innerHTML || emptyHtml()
      onChange(sanitizeHtml(raw))
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {[
            ['bold', 'B'],
            ['italic', 'I'],
            ['insertUnorderedList', '• List'],
            ['insertOrderedList', '1. List'],
            ['removeFormat', 'Clear'],
          ].map(([command, label]) => (
            <button
              key={command}
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                onToolbarAction(command)
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          {isEmptyHtml(value) && !active && (
            <div
              style={{
                position: 'absolute',
                inset: '12px 12px auto 12px',
                color: 'var(--border)',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                lineHeight: 1.65,
                pointerEvents: 'none',
                whiteSpace: 'pre-wrap',
              }}
            >
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onFocus={() => {
              setActive(true)
              onFocus()
            }}
            onBlur={() => {
              setActive(false)
              onFocusLost()
              onBlur()
            }}
            onPaste={e => {
              e.preventDefault()
              const text = e.clipboardData.getData('text/plain')
              document.execCommand('insertText', false, text)
              handleInput()
            }}
            style={{
              minHeight: 200,
              border: '1.5px solid var(--border)',
              borderRadius: 2,
              background: 'linear-gradient(180deg, oklch(99% 0.01 80), oklch(98% 0.01 80))',
              color: 'var(--fg)',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              lineHeight: 1.75,
              padding: '12px 12px',
              outline: 'none',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          />
        </div>
      </div>
    )
  }
})()
