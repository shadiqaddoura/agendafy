import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

type TodoRow = {
  id: string
  text: string
  completed: number
  date: string
  priority: string
  tags: string
  group_id: string | null
  sort_order: number
  created_at: number
}

function rowToTodo(r: TodoRow) {
  return {
    id: r.id,
    text: r.text,
    completed: Boolean(r.completed),
    date: r.date,
    priority: r.priority,
    tags: JSON.parse(r.tags) as string[],
    groupId: r.group_id ?? undefined,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }
}

export function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM todos ORDER BY sort_order ASC, created_at ASC').all() as TodoRow[]
  return NextResponse.json(rows.map(rowToTodo))
}

export async function POST(req: Request) {
  const db = getDb()
  const todo = await req.json()
  const maxRow = db.prepare('SELECT MAX(sort_order) as m FROM todos').get() as { m: number | null }
  const sortOrder = (maxRow.m ?? -1) + 1
  db.prepare(`
    INSERT INTO todos (id, text, completed, date, priority, tags, group_id, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    todo.id,
    todo.text,
    todo.completed ? 1 : 0,
    todo.date ?? '',
    todo.priority ?? 'medium',
    JSON.stringify(todo.tags ?? []),
    todo.groupId ?? null,
    sortOrder,
    todo.createdAt ?? Date.now(),
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const db = getDb()
  db.prepare('DELETE FROM todos WHERE completed = 1').run()
  return NextResponse.json({ ok: true })
}
