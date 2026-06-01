import { NextResponse } from 'next/server'
import { myPlansCol } from '@/lib/firestore'
import { getUserIdFromRequest } from '@/lib/auth'

type PlanDoc = {
  mission?: string
  vision?: string
  exists?: boolean
  updatedAt?: number
}

const MAX_LENGTH = 4000

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n/g, '\n')
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docRef = myPlansCol().doc(userId)
    const snapshot = await docRef.get()
    const data = snapshot.exists ? (snapshot.data() as PlanDoc) : {}

    return NextResponse.json({
      mission: normalizeText(data.mission),
      vision: normalizeText(data.vision),
      exists: snapshot.exists,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null,
    })
  } catch (err) {
    console.error('[GET /api/my-plan]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const mission = normalizeText(body.mission)
    const vision = normalizeText(body.vision)
    const isNew = Boolean(body.isNew)

    if (mission.length > MAX_LENGTH || vision.length > MAX_LENGTH) {
      return NextResponse.json({ error: `Mission and vision must be ${MAX_LENGTH} characters or fewer.` }, { status: 400 })
    }

    const now = Date.now()
    const docRef = myPlansCol().doc(userId)

    await docRef.set(
      {
        userId,
        mission,
        vision,
        updatedAt: now,
        ...(isNew ? { createdAt: now } : {}),
      },
      { merge: true }
    )

    return NextResponse.json({
      ok: true,
      mission,
      vision,
      exists: true,
      updatedAt: now,
    })
  } catch (err) {
    console.error('[PUT /api/my-plan]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
