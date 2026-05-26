import { NextResponse } from 'next/server'
import { quickNotesCol } from '@/lib/firestore'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const note = await req.json()
    await quickNotesCol().doc(id).update({
      text: note.text ?? '',
      completed: note.completed ?? false,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/quick-notes/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await quickNotesCol().doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/quick-notes/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
