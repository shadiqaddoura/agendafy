# Agendafy

Agendafy is a notebook-style daily planner and todo app built with Next.js, React, Firebase Auth, and Firestore.

## Features

- Daily agenda pages with Today / Tomorrow / date navigation
- Task management with inline add/edit, drag-and-drop sorting, and completion tracking
- Task metadata: priority, tags, and optional group assignment
- Group management: create, rename, and delete groups
- Tag filtering per day
- Roll over uncompleted tasks from past days to today
- **Achievement logs** view to see all completed tasks across all days, including task group labels when available
- Google sign-in with per-user data isolation

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Firebase Auth (Google provider)
- Firestore (via firebase-admin on server)
- dnd-kit (drag-and-drop interactions)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (for both admin SDK and client auth):

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id
```

3. Start the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000` and sign in with Google.

All todo, group, and quick-note operations are scoped to the authenticated user.

## Available Scripts

- `npm run dev` — start development server
- `npm run build` — create production build
- `npm run start` — run production server
- `npm run lint` — run ESLint
