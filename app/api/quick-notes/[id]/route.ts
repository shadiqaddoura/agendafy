import { NextResponse } from 'next/server'
import { quickNotesCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const note = await req.json()
    const docRef = quickNotesCol().doc(id)
    const docSnap = await docRef.get()
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (docSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: { text?: string; completed?: boolean } = {}
    if (typeof note.text === 'string') updateData.text = note.text
    if (typeof note.completed === 'boolean') updateData.completed = note.completed
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    await docRef.update(updateData)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/quick-notes/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
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
    const docRef = quickNotesCol().doc(id)
    const docSnap = await docRef.get()
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (docSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await docRef.delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/quick-notes/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
