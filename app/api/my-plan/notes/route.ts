import { NextResponse } from 'next/server'
import { myPlanNotesCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'
import { sanitizeNotebookHtml } from '@/lib/sanitize-notebook-html'

const NOTE_KINDS = ['mission', 'vision', 'values', 'principles', 'goals', 'custom'] as const
type NoteKind = (typeof NOTE_KINDS)[number]

const TITLE_MAX = 120
const CONTENT_MAX = 12000

type NoteDoc = {
  id: string
  pinned?: boolean
  updatedAt?: number
  createdAt?: number
  [key: string]: unknown
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : ''
}

function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === 'string' && NOTE_KINDS.includes(value as NoteKind)
}

function defaultTitle(kind: NoteKind) {
  switch (kind) {
    case 'mission':
      return 'Mission'
    case 'vision':
      return 'Vision'
    case 'values':
      return 'Core Values'
    case 'principles':
      return 'Personal Principles'
    case 'goals':
      return 'Life Goals'
    default:
      return 'New Note'
  }
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const snapshot = await myPlanNotesCol().where('userId', '==', userId).get()
    const notes = snapshot.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as Omit<NoteDoc, 'id'>) }) as NoteDoc)
      .sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
        const updated = (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
        if (updated !== 0) return updated
        return (b.createdAt ?? 0) - (a.createdAt ?? 0)
      })
    return NextResponse.json(notes)
  } catch (err) {
    console.error('[GET /api/my-plan/notes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const kind = isNoteKind(body.kind) ? body.kind : 'custom'
    const title = normalize(body.title) || defaultTitle(kind)
    const contentHtml = sanitizeNotebookHtml(body.contentHtml)
    const pinned = typeof body.pinned === 'boolean' ? body.pinned : kind === 'mission' || kind === 'vision'

    if (title.length > TITLE_MAX) {
      return NextResponse.json({ error: `Title must be ${TITLE_MAX} characters or fewer.` }, { status: 400 })
    }
    if (contentHtml.length > CONTENT_MAX) {
      return NextResponse.json({ error: `Content must be ${CONTENT_MAX} characters or fewer.` }, { status: 400 })
    }

    const now = Date.now()
    const docRef = myPlanNotesCol().doc()
    await docRef.set({
      userId,
      kind,
      title,
      contentHtml,
      pinned,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      ok: true,
      id: docRef.id,
      kind,
      title,
      contentHtml,
      pinned,
      createdAt: now,
      updatedAt: now,
    })
  } catch (err) {
    console.error('[POST /api/my-plan/notes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
