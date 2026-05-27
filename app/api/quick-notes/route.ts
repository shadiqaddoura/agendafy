import { NextResponse } from 'next/server'
import { quickNotesCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'

type QuickNoteDoc = {
  id: string
  text?: string
  completed?: boolean
  createdAt?: number
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const snapshot = await quickNotesCol().where('userId', '==', userId).get()
    const notes = snapshot.docs
      .map((doc): QuickNoteDoc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    return NextResponse.json(notes)
  } catch (err) {
    console.error('[GET /api/quick-notes]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const note = await req.json()
    if (typeof note?.text !== 'string' || note.text.trim() === '') {
      return NextResponse.json({ error: 'Invalid quick note text' }, { status: 400 })
    }
    // Generate the document ID server-side — never trust a client-supplied ID
    const docRef = quickNotesCol().doc()
    await docRef.set({
      userId,
      text: note.text,
      completed: note.completed ?? false,
      createdAt: note.createdAt ?? Date.now(),
    })
    return NextResponse.json({ ok: true, id: docRef.id })
  } catch (err) {
    console.error('[POST /api/quick-notes]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
