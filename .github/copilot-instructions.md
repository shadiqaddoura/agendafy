# Agendafy — Copilot Instructions

Agendafy is a notebook-style daily planner (todos, quick notes, personal planning). Single-user per session; all data is scoped by Firebase Auth UID.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.6, App Router (`app/`) |
| UI | React 19, Tailwind CSS v4, `Playpen_Sans` font |
| Drag-and-drop | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Auth | Firebase Auth (Google provider) |
| Database | Firestore (primary, via `firebase-admin`) |
| Legacy DB | `better-sqlite3` — only used by migration scripts in `scripts/` |
| Rich-text sanitization | `sanitize-html` via `lib/sanitize-notebook-html.ts` |
| Language | TypeScript 5, strict mode |

---

## File Structure

```
app/
  layout.tsx              # Root layout — Playpen_Sans font, global metadata
  page.tsx                # Renders <NotebookTodo /> only
  globals.css
  components/
    NotebookTodo.tsx      # Main client component (~100 KB). All todo/group/quick-note UI lives here.
    MyPlanSection.tsx     # My Plan tab — notebook notes (mission, vision, values, etc.)
  api/
    auth/google/          # POST — exchange Firebase ID token
    todos/
      route.ts            # GET (list), POST (create), DELETE (clear completed)
      [id]/route.ts       # PUT (update), DELETE (single)
      reorder/route.ts    # POST — persist drag-drop order via Firestore batch
    groups/
      route.ts            # GET, POST
      [id]/route.ts       # PUT, DELETE
    quick-notes/
      route.ts            # GET, POST
      [id]/route.ts       # PUT, DELETE
    my-plan/
      route.ts            # GET, PUT — single plan doc (legacy mission/vision fields)
      notes/route.ts      # GET, POST — notebook notes collection
      notes/[id]/route.ts # PUT, DELETE
lib/
  firestore.ts            # Firebase Admin init + collection helpers
  auth.ts                 # getUserIdFromRequest(req) — verifies Bearer token, returns uid or null
  firebase-client.ts      # Client-side Firebase init, getFirebaseClientAuth(), createGoogleProvider()
  db.ts                   # better-sqlite3 init — only used by migration scripts, NOT in app routes
  sanitize-notebook-html.ts
scripts/                  # Migration utilities (tsx) — not part of the app runtime
```

---

## Core Types (defined in `NotebookTodo.tsx`)

```ts
type Priority = 'low' | 'medium' | 'high'

type Todo = {
  id: string
  text: string
  completed: boolean
  date: string        // 'YYYY-MM-DD' or ''
  priority: Priority
  tags: string[]
  groupId?: string    // references Group.id
  createdAt: number   // ms timestamp
  sortOrder?: number
}

type Group = {
  id: string
  name: string
}

type QuickNote = {
  id: string
  text: string
  completed: boolean
  createdAt: number
}
```

```ts
// Defined in MyPlanSection.tsx
type NoteKind = 'mission' | 'vision' | 'values' | 'principles' | 'goals' | 'custom'

type NotebookNote = {
  id: string
  kind: NoteKind
  title: string
  contentHtml: string   // sanitized HTML — always write/read via sanitizeNotebookHtml()
  pinned: boolean
  createdAt: number
  updatedAt: number
}

type SaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'error'
```

---

## Firestore Collections

All documents include a `userId` field (Firebase UID) — every query **must** filter by `userId`.

| Collection | Key fields |
|---|---|
| `todos` | `userId`, `text`, `completed`, `date`, `priority`, `tags`, `groupId`, `sortOrder`, `createdAt` |
| `groups` | `userId`, `name` |
| `quickNotes` | `userId`, `text`, `completed`, `createdAt` |
| `myPlans` | doc ID = `userId`; fields: `mission`, `vision`, `updatedAt`, `createdAt` |
| `myPlanNotes` | `userId`, `kind`, `title`, `contentHtml`, `pinned`, `createdAt`, `updatedAt` |

Collection helpers (`lib/firestore.ts`): `todosCol()`, `groupsCol()`, `quickNotesCol()`, `myPlansCol()`, `myPlanNotesCol()`, `getDb()` (returns Firestore instance for batches).

---

## Auth Pattern

**Server (API routes):**
```ts
import { getUserIdFromRequest } from '@/lib/auth'

const userId = await getUserIdFromRequest(req)
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```
- Reads `Authorization: Bearer <Firebase ID token>` header
- Returns `string | null` — always guard with null check before touching Firestore

**Client:**
```ts
import { getFirebaseClientAuth, createGoogleProvider } from '@/lib/firebase-client'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
```
- Auth state is managed in `NotebookTodo.tsx` via `onAuthStateChanged`
- All API calls use an `authedFetch` helper (defined in `NotebookTodo.tsx`) that attaches the Bearer token automatically — pass it as a prop to child components (`MyPlanSectionProps.authedFetch`)

---

## API Route Conventions

1. **Always verify auth first** — `getUserIdFromRequest` at the top of every handler.
2. **Generate document IDs server-side** — `col().doc()` with no argument. Never trust a client-supplied ID.
3. **Scope every Firestore query to `userId`** — `.where('userId', '==', userId)`.
4. **Verify ownership before mutate** — fetch the doc, check `docSnap.data()?.userId !== userId`, return 403 if mismatch.
5. **Route params are `Promise` in Next.js 16** — always `await params`:
   ```ts
   async function handler(req, { params }: { params: Promise<{ id: string }> }) {
     const { id } = await params
   ```
6. **Error logging pattern** — `console.error('[METHOD /route/path]', err)`.
7. **Batch writes** via `getDb().batch()` from `lib/firestore.ts`.
8. **Return shape** — success mutations return `{ ok: true, ...payload }`, errors return `{ error: string }`.

---

## Rich-Text Content

Any user-generated HTML (notebook notes `contentHtml`) must go through:
```ts
import { sanitizeNotebookHtml } from '@/lib/sanitize-notebook-html'
const safe = sanitizeNotebookHtml(rawHtml)
```
Allowed tags: `p br strong b em i u ul ol li blockquote a`. Only `http/https/mailto` schemes.

---

## Env Variables

**Server-only (Firebase Admin):**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` — paste with literal `\n`, the lib replaces them

**Public (Firebase Client, `NEXT_PUBLIC_` prefix):**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

---

## Commands

```bash
npm run dev        # Start dev server (Next.js)
npm run build      # Production build
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript type check (no build output)
npm run migrate    # SQLite → Firestore migration (scripts/)
```

---

## Key Constraints

- `lib/db.ts` (SQLite) is **only** for migration scripts — never import it in `app/` routes.
- `MyPlanSection.tsx` is a large file (~33 KB) — use targeted `view_range` reads.
- `NotebookTodo.tsx` is a large file (~100 KB) — use targeted `view_range` reads or `grep` for specific logic.
- No test suite currently exists.
