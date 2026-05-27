import { NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { getFirebaseApp } from '@/lib/firestore'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: unknown }
    const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : ''

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }

    const decoded = await getAuth(getFirebaseApp()).verifyIdToken(idToken)
    const provider = decoded.firebase?.sign_in_provider

    if (provider !== 'google.com') {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      user: {
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        picture: decoded.picture ?? null,
      },
    })
  } catch (err) {
    console.error('[POST /api/auth/google]', err)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
