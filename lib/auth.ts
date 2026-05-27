import { getAuth } from 'firebase-admin/auth'
import { getFirebaseApp } from '@/lib/firestore'

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.slice(7).trim()
  if (!idToken) return null

  try {
    const decoded = await getAuth(getFirebaseApp()).verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}
