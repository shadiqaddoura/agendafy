import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function initFirebase() {
  if (getApps().length > 0) return

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env variables.'
    )
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

try {
  initFirebase()
} catch (err) {
  console.error('[firestore] Initialization failed:', err)
}

export const db = getFirestore()

// Collection references
export const groupsCol = () => db.collection('groups')
export const todosCol = () => db.collection('todos')
