import { NextResponse } from 'next/server'
import { db, todosCol } from '@/lib/firestore'

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] }
  const batch = db.batch()
  ids.forEach((id, i) => {
    batch.update(todosCol().doc(id), { sortOrder: i })
  })
  await batch.commit()
  return NextResponse.json({ ok: true })
}
