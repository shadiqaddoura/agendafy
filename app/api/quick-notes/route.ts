import { NextResponse } from 'next/server'
import { quickNotesCol } from '@/lib/firestore'

type QuickNoteDoc = {
  id: string
  text?: string
  completed?: boolean
  createdAt?: number
}

export async function GET() {
  try {
    const snapshot = await quickNotesCol().get()
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
    const note = await req.json()
    if (typeof note?.id !== 'string' || note.id.trim() === '') {
      return NextResponse.json({ error: 'Invalid quick note id' }, { status: 400 })
    }
    await quickNotesCol().doc(note.id).set({
      text: note.text ?? '',
      completed: note.completed ?? false,
      createdAt: note.createdAt ?? Date.now(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/quick-notes]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
