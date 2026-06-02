import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

export function getFirebaseApp(): App {
  if (getApps().length > 0) return getApp()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env variables.'
    )
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

// Lazy — called inside route handlers so errors are caught by their try/catch
export function getDb(): Firestore {
  return getFirestore(getFirebaseApp())
}

// Collection references
export const groupsCol = () => getDb().collection('groups')
export const todosCol = () => getDb().collection('todos')
export const quickNotesCol = () => getDb().collection('quickNotes')
export const myPlansCol = () => getDb().collection('myPlans')
export const myPlanNotesCol = () => getDb().collection('myPlanNotes')
