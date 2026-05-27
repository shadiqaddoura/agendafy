import { NextResponse } from 'next/server'
import { getDb, todosCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'

type TodoDoc = { id: string; sortOrder?: number; createdAt?: number; [key: string]: unknown }

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const snapshot = await todosCol().where('userId', '==', userId).get()
    const todos = snapshot.docs
      .map((doc): TodoDoc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        if (so !== 0) return so
        return (a.createdAt ?? 0) - (b.createdAt ?? 0)
      })
    return NextResponse.json(todos)
  } catch (err) {
    console.error('[GET /api/todos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todo = await req.json()
    const userTodos = await todosCol().where('userId', '==', userId).get()
    const sortOrder = userTodos.docs.reduce((max, doc) => {
      const nextSortOrder = doc.data().sortOrder as number | undefined
      return Math.max(max, nextSortOrder ?? -1)
    }, -1) + 1
    await todosCol().doc(todo.id).set({
      userId,
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

export async function DELETE(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const snapshot = await todosCol()
      .where('userId', '==', userId)
      .where('completed', '==', true)
      .get()
    const batch = getDb().batch()
    snapshot.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/todos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
