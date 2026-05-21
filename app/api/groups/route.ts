import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  const db = getDb()
  const groups = db.prepare('SELECT * FROM groups').all()
  return NextResponse.json(groups)
}

export async function POST(req: Request) {
  const db = getDb()
  const group = await req.json()
  db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(group.id, group.name)
  return NextResponse.json({ ok: true })
}
