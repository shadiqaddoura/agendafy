#!/usr/bin/env node
/**
 * migrate-sqlite-to-firestore.ts
 *
 * Reads all groups and todos from the local SQLite database (agendafy.db)
 * and writes them to Firebase Firestore.
 *
 * Usage:
 *   npx tsx scripts/migrate-sqlite-to-firestore.ts
 *
 * Requires .env.local with FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 * and FIREBASE_PRIVATE_KEY set.
 */

import path from 'path'
import { config } from 'dotenv'

// Load .env.local before importing anything that reads env vars
config({ path: path.resolve(process.cwd(), '.env.local') })

import Database from 'better-sqlite3'
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ─── Types matching the SQLite schema ────────────────────────────────────────

type GroupRow = {
  id: string
  name: string
}

type TodoRow = {
  id: string
  text: string
  completed: number
  date: string
  priority: string
  tags: string        // JSON-encoded string[]
  group_id: string | null
  sort_order: number
  created_at: number
}

// ─── Firebase init ────────────────────────────────────────────────────────────

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

// ─── Firestore batch helper (max 500 ops per batch) ──────────────────────────

const BATCH_SIZE = 400

async function commitInBatches(
  db: FirebaseFirestore.Firestore,
  writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: object }>
) {
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + BATCH_SIZE)
    chunk.forEach(({ ref, data }) => batch.set(ref, data))
    await batch.commit()
    console.log(`  committed ${i + chunk.length} / ${writes.length}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔌  Opening SQLite database…')
  const sqliteDb = new Database(path.join(process.cwd(), 'agendafy.db'), { readonly: true })

  const groups = sqliteDb.prepare('SELECT * FROM groups').all() as GroupRow[]
  const todos  = sqliteDb.prepare('SELECT * FROM todos ORDER BY sort_order ASC, created_at ASC').all() as TodoRow[]
  sqliteDb.close()

  console.log(`📦  Found ${groups.length} group(s) and ${todos.length} todo(s) in SQLite`)

  if (groups.length === 0 && todos.length === 0) {
    console.log('ℹ️   Nothing to migrate.')
    process.exit(0)
  }

  console.log('🔥  Connecting to Firestore…')
  initFirebase()
  const firestoreDb = getFirestore()

  // ── Migrate groups ──────────────────────────────────────────────────────────
  if (groups.length > 0) {
    console.log(`\n📁  Migrating ${groups.length} group(s)…`)
    const groupWrites = groups.map((g) => ({
      ref: firestoreDb.collection('groups').doc(g.id),
      data: { name: g.name },
    }))
    await commitInBatches(firestoreDb, groupWrites)
    console.log('✅  Groups done')
  }

  // ── Migrate todos ───────────────────────────────────────────────────────────
  if (todos.length > 0) {
    console.log(`\n📝  Migrating ${todos.length} todo(s)…`)
    const todoWrites = todos.map((t) => ({
      ref: firestoreDb.collection('todos').doc(t.id),
      data: {
        text:      t.text,
        completed: Boolean(t.completed),
        date:      t.date,
        priority:  t.priority,
        tags:      JSON.parse(t.tags) as string[],
        groupId:   t.group_id ?? null,
        sortOrder: t.sort_order,
        createdAt: t.created_at,
      },
    }))
    await commitInBatches(firestoreDb, todoWrites)
    console.log('✅  Todos done')
  }

  console.log('\n🎉  Migration complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌  Migration failed:', err)
  process.exit(1)
})
