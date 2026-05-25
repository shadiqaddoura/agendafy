import { NextResponse } from 'next/server'
import { getDb, todosCol } from '@/lib/firestore'

export async function GET() {
  try {
    const snapshot = await todosCol()
      .orderBy('sortOrder', 'asc')
      .orderBy('createdAt', 'asc')
      .get()
    const todos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json(todos)
  } catch (err) {
    console.error('[GET /api/todos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const todo = await req.json()
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
  } catch (err) {
    console.error('[POST /api/todos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const snapshot = await todosCol().where('completed', '==', true).get()
    const batch = getDb().batch()
    snapshot.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/todos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
