import { NextResponse } from 'next/server'
import { todosCol } from '@/lib/firestore'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await todosCol().doc(id).delete()
  return NextResponse.json({ ok: true })
}
