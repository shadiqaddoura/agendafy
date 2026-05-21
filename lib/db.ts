import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'agendafy.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      id         TEXT    PRIMARY KEY,
      text       TEXT    NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      date       TEXT    NOT NULL DEFAULT '',
      priority   TEXT    NOT NULL DEFAULT 'medium',
      tags       TEXT    NOT NULL DEFAULT '[]',
      group_id   TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
    );
  `)
}
