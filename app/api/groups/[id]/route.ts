import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb()
  const { id } = await params
  db.prepare('UPDATE todos SET group_id=NULL WHERE group_id=?').run(id)
  db.prepare('DELETE FROM groups WHERE id=?').run(id)
  return NextResponse.json({ ok: true })
}
