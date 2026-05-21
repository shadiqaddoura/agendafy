import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb()
  const { id } = await params
  const todo = await req.json()
  db.prepare(`
    UPDATE todos
    SET text=?, completed=?, date=?, priority=?, tags=?, group_id=?
    WHERE id=?
  `).run(
    todo.text,
    todo.completed ? 1 : 0,
    todo.date ?? '',
    todo.priority ?? 'medium',
    JSON.stringify(todo.tags ?? []),
    todo.groupId ?? null,
    id,
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb()
  const { id } = await params
  db.prepare('DELETE FROM todos WHERE id=?').run(id)
  return NextResponse.json({ ok: true })
}
