import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function hasConfig() {
  return Object.values(firebaseConfig).every((value) => typeof value === 'string' && value.length > 0)
}

function getFirebaseApp(): FirebaseApp | null {
  if (!hasConfig()) return null
  if (getApps().length > 0) return getApp()
  return initializeApp(firebaseConfig)
}

export function getFirebaseClientAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app) return null
  return getAuth(app)
}

export function createGoogleProvider() {
  return new GoogleAuthProvider()
}
