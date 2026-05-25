import { NextResponse } from 'next/server'
import { getDb, todosCol } from '@/lib/firestore'

export async function POST(req: Request) {
  try {
    const { ids } = (await req.json()) as { ids: string[] }
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
