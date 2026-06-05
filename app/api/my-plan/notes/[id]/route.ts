import { NextResponse } from 'next/server'
import { myPlanNotesCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'
import { sanitizeNotebookHtml } from '@/lib/sanitize-notebook-html'

const NOTE_KINDS = ['mission', 'vision', 'values', 'principles', 'goals', 'custom'] as const
type NoteKind = (typeof NOTE_KINDS)[number]

const TITLE_MAX = 120
const CONTENT_MAX = 12000
const DESCRIPTION_MAX = 500
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : ''
}

function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === 'string' && NOTE_KINDS.includes(value as NoteKind)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const docRef = myPlanNotesCol().doc(id)
    const snapshot = await docRef.get()
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (snapshot.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    }

    if ('kind' in body) {
      if (!isNoteKind(body.kind)) {
        return NextResponse.json({ error: 'Invalid note kind' }, { status: 400 })
      }
      patch.kind = body.kind
    }

    if ('title' in body) {
      const title = normalize(body.title)
      if (title.length > TITLE_MAX) {
        return NextResponse.json({ error: `Title must be ${TITLE_MAX} characters or fewer.` }, { status: 400 })
      }
      patch.title = title
    }

    if ('contentHtml' in body) {
      const contentHtml = sanitizeNotebookHtml(body.contentHtml)
      if (contentHtml.length > CONTENT_MAX) {
        return NextResponse.json({ error: `Content must be ${CONTENT_MAX} characters or fewer.` }, { status: 400 })
      }
      patch.contentHtml = contentHtml
    }

    if ('pinned' in body) {
      patch.pinned = Boolean(body.pinned)
    }

    if ('description' in body) {
      const description = normalize(body.description).slice(0, DESCRIPTION_MAX)
      patch.description = description
    }

    if ('dueDate' in body) {
      const dueDate = typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : ''
      patch.dueDate = dueDate
    }

    if ('completed' in body) {
      const completed = Boolean(body.completed)
      patch.completed = completed
      patch.completedAt = completed ? Date.now() : null
    }

    await docRef.update(patch)
    return NextResponse.json({ ok: true, id, ...patch })
  } catch (err) {
    console.error('[PATCH /api/my-plan/notes/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const docRef = myPlanNotesCol().doc(id)
    const snapshot = await docRef.get()
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (snapshot.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await docRef.delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/my-plan/notes/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
