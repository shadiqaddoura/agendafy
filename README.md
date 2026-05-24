# Agendafy

Agendafy is a notebook-style daily planner and todo app built with Next.js, React, and SQLite.

## Features

- Daily agenda pages with Today / Tomorrow / date navigation
- Task management with inline add/edit, drag-and-drop sorting, and completion tracking
- Task metadata: priority, tags, and optional group assignment
- Group management: create, rename, and delete groups
- Tag filtering per day
- Roll over uncompleted tasks from past days to today
- **Achievement logs** view to see all completed tasks across all days, including task group labels when available

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- better-sqlite3 (local SQLite database)
- dnd-kit (drag-and-drop interactions)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open `http://localhost:3000`.

The SQLite database file (`agendafy.db`) is created automatically in the project root when the app runs.

## Available Scripts

- `npm run dev` — start development server
- `npm run build` — create production build
- `npm run start` — run production server
- `npm run lint` — run ESLint
