import { NextResponse } from 'next/server'
import { db, todosCol } from '@/lib/firestore'
import { FieldValue } from 'firebase-admin/firestore'

export async function GET() {
  const snapshot = await todosCol()
    .orderBy('sortOrder', 'asc')
    .orderBy('createdAt', 'asc')
    .get()
  const todos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  return NextResponse.json(todos)
}

export async function POST(req: Request) {
  const todo = await req.json()

  // Determine next sort order
  const lastSnap = await todosCol().orderBy('sortOrder', 'desc').limit(1).get()
  const sortOrder = lastSnap.empty ? 0 : (lastSnap.docs[0].data().sortOrder as number) + 1

  await todosCol().doc(todo.id).set({
    text: todo.text,
    completed: todo.completed ?? false,
    date: todo.date ?? '',
    priority: todo.priority ?? 'medium',
    tags: todo.tags ?? [],
    groupId: todo.groupId ?? null,
    sortOrder,
    createdAt: todo.createdAt ?? Date.now(),
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const snapshot = await todosCol().where('completed', '==', true).get()
  const batch = db.batch()
  snapshot.docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()
  return NextResponse.json({ ok: true })
}
