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
    const batch = getDb().batch()
    for (const [i, id] of ids.entries()) {
      const docRef = todosCol().doc(id)
      const docSnap = await docRef.get()
      if (!docSnap.exists) {
        return NextResponse.json({ error: `Todo not found: ${id}` }, { status: 404 })
      }
      if (docSnap.data()?.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      batch.update(docRef, { sortOrder: i })
    }
    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/todos/reorder]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
