import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(req: Request) {
  const db = getDb()
  const { ids } = await req.json() as { ids: string[] }
  const update = db.prepare('UPDATE todos SET sort_order=? WHERE id=?')
  const updateAll = db.transaction((ids: string[]) => {
    ids.forEach((id, i) => update.run(i, id))
  })
  updateAll(ids)
  return NextResponse.json({ ok: true })
}
