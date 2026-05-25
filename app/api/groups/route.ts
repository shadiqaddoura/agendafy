import { NextResponse } from 'next/server'
import { groupsCol } from '@/lib/firestore'

export async function GET() {
  try {
    const snapshot = await groupsCol().orderBy('name').get()
    const groups = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json(groups)
  } catch (err) {
    console.error('[GET /api/groups]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const group = await req.json()
    await groupsCol().doc(group.id).set({ name: group.name })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/groups]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
