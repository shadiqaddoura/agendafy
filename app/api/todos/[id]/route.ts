import { NextResponse } from 'next/server'
import { todosCol } from '@/lib/firestore'
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
    const todo = await req.json()
    const docRef = todosCol().doc(id)
    const docSnap = await docRef.get()
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (docSnap.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await docRef.update({
      text: todo.text,
      completed: todo.completed ?? false,
      date: todo.date ?? '',
      priority: todo.priority ?? 'medium',
      tags: todo.tags ?? [],
      groupId: todo.groupId ?? null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/todos/:id]', err)
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
    const docRef = todosCol().doc(id)
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
    console.error('[DELETE /api/todos/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
