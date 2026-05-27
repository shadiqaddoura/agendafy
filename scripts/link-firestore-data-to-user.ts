#!/usr/bin/env node
/**
 * link-firestore-data-to-user.ts
 *
 * Sets `userId` on all docs in `todos`, `groups`, and `quickNotes`
 * so existing Firestore data is linked to a single authenticated user.
 *
 * Usage:
 *   npx tsx scripts/link-firestore-data-to-user.ts
 *
 * Optional:
 *   TARGET_USER_ID=someUid npx tsx scripts/link-firestore-data-to-user.ts
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.local') })

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const TARGET_USER_ID =
  process.env.TARGET_USER_ID?.trim() || 'qvv0TUXpIkVc31ZdQLTO7b4b8M52'

const COLLECTIONS = ['todos', 'groups', 'quickNotes'] as const
const BATCH_SIZE = 400

function initFirebase() {
  if (getApps().length > 0) return getApp()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials in .env.local')
    process.exit(1)
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

async function linkCollectionToUser(
  db: FirebaseFirestore.Firestore,
  collectionName: (typeof COLLECTIONS)[number],
  userId: string
) {
  const snapshot = await db.collection(collectionName).get()
  if (snapshot.empty) {
    console.log(`${collectionName}: no docs found`)
    return { scanned: 0, updated: 0 }
  }

  const docsToUpdate = snapshot.docs.filter((doc) => doc.data().userId !== userId)
  if (docsToUpdate.length === 0) {
    console.log(`${collectionName}: already linked (${snapshot.docs.length} docs)`)
    return { scanned: snapshot.docs.length, updated: 0 }
  }

  let updated = 0
  for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = docsToUpdate.slice(i, i + BATCH_SIZE)
    chunk.forEach((doc) => {
      batch.update(doc.ref, { userId })
    })

    await batch.commit()
    updated += chunk.length
    console.log(`${collectionName}: updated ${updated} / ${docsToUpdate.length}`)
  }

  return { scanned: snapshot.docs.length, updated }
}

async function main() {
  if (!TARGET_USER_ID) {
    console.error('Missing target user id')
    process.exit(1)
  }

  console.log(`Linking all Firestore docs to user: ${TARGET_USER_ID}`)

  initFirebase()
  const db = getFirestore()

  const results: Array<{ collection: string; scanned: number; updated: number }> = []

  for (const collectionName of COLLECTIONS) {
    const result = await linkCollectionToUser(db, collectionName, TARGET_USER_ID)
    results.push({ collection: collectionName, ...result })
  }

  console.log('\nDone. Summary:')
  results.forEach((r) => {
    console.log(`- ${r.collection}: scanned=${r.scanned}, updated=${r.updated}`)
  })
}

main().catch((err) => {
  console.error('Linking failed:', err)
  process.exit(1)
})
