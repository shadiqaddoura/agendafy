import { NextResponse } from 'next/server'
import { quickNotesCol } from '@/lib/firestore'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const note = await req.json()
    const updateData: { text?: string; completed?: boolean } = {}
    if (typeof note.text === 'string') updateData.text = note.text
    if (typeof note.completed === 'boolean') updateData.completed = note.completed
    await quickNotesCol().doc(id).update(updateData)
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
