#!/usr/bin/env node
/**
 * clear-firestore.ts
 *
 * Deletes ALL documents from the `todos` and `groups` Firestore collections.
 *
 * Usage:
 *   npx tsx scripts/clear-firestore.ts
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.local') })

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function initFirebase() {
  if (getApps().length > 0) return getApp()

  const projectId   = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌  Missing Firebase credentials in .env.local')
    process.exit(1)
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

const BATCH_SIZE = 400

async function deleteCollection(db: FirebaseFirestore.Firestore, collectionName: string) {
  const snapshot = await db.collection(collectionName).get()
  if (snapshot.empty) {
    console.log(`  ℹ️  ${collectionName}: already empty`)
    return
  }

  let deleted = 0
  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    snapshot.docs.slice(i, i + BATCH_SIZE).forEach(doc => batch.delete(doc.ref))
    await batch.commit()
    deleted += Math.min(BATCH_SIZE, snapshot.docs.length - i)
    console.log(`  deleted ${deleted} / ${snapshot.docs.length} from ${collectionName}`)
  }
  console.log(`✅  ${collectionName} cleared (${snapshot.docs.length} docs)`)
}

async function main() {
  console.log('🔥  Connecting to Firestore…')
  initFirebase()
  const db = getFirestore()

  console.log('\n🗑️   Clearing todos…')
  await deleteCollection(db, 'todos')

  console.log('\n🗑️   Clearing groups…')
  await deleteCollection(db, 'groups')

  console.log('\n🎉  Firestore cleared!')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌  Clear failed:', err)
  process.exit(1)
})
