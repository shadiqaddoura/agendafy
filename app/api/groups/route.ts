import { NextResponse } from 'next/server'
import { groupsCol } from '@/lib/firestore'

export async function GET() {
  const snapshot = await groupsCol().orderBy('name').get()
  const groups = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  return NextResponse.json(groups)
}

export async function POST(req: Request) {
  const group = await req.json()
  await groupsCol().doc(group.id).set({ name: group.name })
  return NextResponse.json({ ok: true })
}
