import { NextResponse } from 'next/server'
import { todosCol } from '@/lib/firestore'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const todo = await req.json()
    await todosCol().doc(id).update({
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
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await todosCol().doc(id).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/todos/:id]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
