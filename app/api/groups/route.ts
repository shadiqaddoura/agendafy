import { NextResponse } from 'next/server'
import { groupsCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'

type GroupDoc = {
  id: string
  name?: string
  [key: string]: unknown
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const snapshot = await groupsCol().where('userId', '==', userId).get()
    const groups = snapshot.docs.map((doc): GroupDoc => ({ id: doc.id, ...doc.data() }))
    groups.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
    return NextResponse.json(groups)
  } catch (err) {
    console.error('[GET /api/groups]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const group = await req.json()
    // Generate the document ID server-side — never trust a client-supplied ID
    const docRef = groupsCol().doc()
    await docRef.set({ name: group.name, userId })
    return NextResponse.json({ ok: true, id: docRef.id })
  } catch (err) {
    console.error('[POST /api/groups]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
