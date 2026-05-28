import { NextResponse } from 'next/server'
import { getDb, todosCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ids } = (await req.json()) as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // Single query to fetch all of this user's todos — one round-trip regardless of list size
    const snapshot = await todosCol().where('userId', '==', userId).get()
    const ownedIds = new Set(snapshot.docs.map((doc) => doc.id))

    for (const id of ids) {
      if (!ownedIds.has(id)) {
        return NextResponse.json(
          { error: ownedIds.size === 0 ? `Todo not found: ${id}` : 'Forbidden' },
          { status: ownedIds.size === 0 ? 404 : 403 }
        )
      }
    }

    const batch = getDb().batch()
    ids.forEach((id, i) => {
      batch.update(todosCol().doc(id), { sortOrder: i })
    })
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/todos/reorder]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
