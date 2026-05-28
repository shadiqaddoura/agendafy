import { NextResponse } from 'next/server'
import { getDb, groupsCol, todosCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'

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
    const { name } = await req.json()
    const groupRef = groupsCol().doc(id)
    const groupSnap = await groupRef.get()
    if (!groupSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (groupSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await groupRef.update({ name })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/groups/:id]', err)
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
    const groupRef = groupsCol().doc(id)
    const groupSnap = await groupRef.get()
    if (!groupSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (groupSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const todosSnap = await todosCol()
      .where('userId', '==', userId)
      .where('groupId', '==', id)
      .get()
    const batch = getDb().batch()
    todosSnap.docs.forEach((doc) => batch.update(doc.ref, { groupId: null }))
    batch.delete(groupRef)
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/groups/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
