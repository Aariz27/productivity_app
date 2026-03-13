import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

let db: Database.Database

export function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'productivity-tracker.db')
}

export function getScreenshotDir(): string {
  const userDataPath = app.getPath('userData')
  const dir = path.join(userDataPath, 'screenshots')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function initDatabase(): Database.Database {
  const dbPath = getDbPath()
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      is_non_negotiable INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL,
      scheduled_start TEXT,
      scheduled_end TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER REFERENCES daily_plans(id),
      planned_start TEXT,
      actual_start TEXT,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      screenshot_path TEXT NOT NULL,
      user_note TEXT,
      ai_category TEXT,
      task_id INTEGER REFERENCES tasks(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS inactivity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      detected_at TEXT NOT NULL,
      returned_at TEXT,
      user_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `)

  // Seed default settings if not present
  const defaults: Record<string, string> = {
    planning_time: '21:00',
    checkin_interval: '60',
    notification_repeat: '5',
    inactivity_threshold: '30',
    max_session_duration: '240',
    screenshot_quality: '80',
    screenshot_path: getScreenshotDir(),
    ollama_model: 'llama3.2:3b',
    ollama_endpoint: 'http://localhost:11434'
  }

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value)
  }

  return db
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// ===== Settings =====

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

// ===== Daily Plans =====

export function getOrCreateTodayPlan(): {
  plan: { id: number; date: string; created_at: string }
  tasks: any[]
  sessions: any[]
} {
  const today = new Date().toISOString().split('T')[0]

  let plan = getDb()
    .prepare('SELECT * FROM daily_plans WHERE date = ?')
    .get(today) as { id: number; date: string; created_at: string } | undefined

  if (!plan) {
    const result = getDb()
      .prepare('INSERT INTO daily_plans (date) VALUES (?)')
      .run(today)
    plan = {
      id: result.lastInsertRowid as number,
      date: today,
      created_at: new Date().toISOString()
    }

    // Auto-create the 3 non-negotiable tasks
    const insertTask = getDb().prepare(
      'INSERT INTO tasks (plan_id, title, is_non_negotiable, display_order) VALUES (?, ?, 1, ?)'
    )
    insertTask.run(plan.id, 'Gym', 0)
    insertTask.run(plan.id, 'YouTube video', 1)
    insertTask.run(plan.id, 'LinkedIn post', 2)
  }

  const tasks = getDb()
    .prepare('SELECT * FROM tasks WHERE plan_id = ? ORDER BY display_order')
    .all(plan.id)

  const sessions = getDb()
    .prepare('SELECT * FROM sessions WHERE plan_id = ? ORDER BY planned_start')
    .all(plan.id)

  return { plan, tasks, sessions }
}

export function getOrCreatePlanForDate(date: string): {
  plan: { id: number; date: string; created_at: string }
  tasks: any[]
  sessions: any[]
} {
  let plan = getDb()
    .prepare('SELECT * FROM daily_plans WHERE date = ?')
    .get(date) as { id: number; date: string; created_at: string } | undefined

  if (!plan) {
    const result = getDb()
      .prepare('INSERT INTO daily_plans (date) VALUES (?)')
      .run(date)
    plan = {
      id: result.lastInsertRowid as number,
      date,
      created_at: new Date().toISOString()
    }

    // Auto-create the 3 non-negotiable tasks
    const insertTask = getDb().prepare(
      'INSERT INTO tasks (plan_id, title, is_non_negotiable, display_order) VALUES (?, ?, 1, ?)'
    )
    insertTask.run(plan.id, 'Gym', 0)
    insertTask.run(plan.id, 'YouTube video', 1)
    insertTask.run(plan.id, 'LinkedIn post', 2)
  }

  const tasks = getDb()
    .prepare('SELECT * FROM tasks WHERE plan_id = ? ORDER BY display_order')
    .all(plan.id)

  const sessions = getDb()
    .prepare('SELECT * FROM sessions WHERE plan_id = ? ORDER BY planned_start')
    .all(plan.id)

  return { plan, tasks, sessions }
}

export function getPlanByDate(date: string) {
  const plan = getDb()
    .prepare('SELECT * FROM daily_plans WHERE date = ?')
    .get(date) as { id: number; date: string; created_at: string } | undefined

  if (!plan) return null

  const tasks = getDb()
    .prepare('SELECT * FROM tasks WHERE plan_id = ? ORDER BY display_order')
    .all(plan.id)

  const sessions = getDb()
    .prepare('SELECT * FROM sessions WHERE plan_id = ? ORDER BY planned_start')
    .all(plan.id)

  return { plan, tasks, sessions }
}

// ===== Tasks =====

export function addTask(
  planId: number,
  title: string,
  displayOrder: number,
  scheduledStart?: string,
  scheduledEnd?: string
): any {
  const result = getDb()
    .prepare(
      'INSERT INTO tasks (plan_id, title, is_non_negotiable, display_order, scheduled_start, scheduled_end) VALUES (?, ?, 0, ?, ?, ?)'
    )
    .run(planId, title, displayOrder, scheduledStart || null, scheduledEnd || null)

  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
}

export function completeTask(taskId: number): void {
  getDb()
    .prepare('UPDATE tasks SET completed_at = datetime(\'now\', \'localtime\') WHERE id = ?')
    .run(taskId)
}

export function uncompleteTask(taskId: number): void {
  getDb().prepare('UPDATE tasks SET completed_at = NULL WHERE id = ?').run(taskId)
}

export function removeTask(taskId: number): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ? AND is_non_negotiable = 0').run(taskId)
}

// ===== Sessions =====

export function createSession(planId: number, plannedStart?: string): any {
  const result = getDb()
    .prepare('INSERT INTO sessions (plan_id, planned_start, status) VALUES (?, ?, ?)')
    .run(planId, plannedStart || null, 'pending')

  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid)
}

export function startSession(sessionId: number): void {
  getDb()
    .prepare(
      'UPDATE sessions SET actual_start = datetime(\'now\', \'localtime\'), status = \'active\' WHERE id = ?'
    )
    .run(sessionId)
}

export function endSession(sessionId: number): void {
  getDb()
    .prepare(
      'UPDATE sessions SET end_time = datetime(\'now\', \'localtime\'), status = \'completed\' WHERE id = ?'
    )
    .run(sessionId)
}

export function skipSession(sessionId: number): void {
  getDb()
    .prepare('UPDATE sessions SET status = \'skipped\' WHERE id = ?')
    .run(sessionId)
}

export function getActiveSession(): any {
  return getDb()
    .prepare('SELECT * FROM sessions WHERE status = \'active\' LIMIT 1')
    .get()
}

// ===== Check-ins =====

export function createCheckIn(
  sessionId: number,
  screenshotPath: string,
  userNote?: string,
  aiCategory?: string,
  taskId?: number
): any {
  const result = getDb()
    .prepare(
      'INSERT INTO check_ins (session_id, screenshot_path, user_note, ai_category, task_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(sessionId, screenshotPath, userNote || null, aiCategory || null, taskId || null)

  return getDb().prepare('SELECT * FROM check_ins WHERE id = ?').get(result.lastInsertRowid)
}

export function getCheckInsForSession(sessionId: number): any[] {
  return getDb()
    .prepare('SELECT * FROM check_ins WHERE session_id = ? ORDER BY timestamp')
    .all(sessionId)
}

export function getCheckInsForDate(date: string): any[] {
  return getDb()
    .prepare(
      `SELECT ci.* FROM check_ins ci
       JOIN sessions s ON ci.session_id = s.id
       JOIN daily_plans dp ON s.plan_id = dp.id
       WHERE dp.date = ?
       ORDER BY ci.timestamp`
    )
    .all(date)
}

// ===== Inactivity =====

export function createInactivityLog(sessionId: number): any {
  const result = getDb()
    .prepare(
      'INSERT INTO inactivity_logs (session_id, detected_at) VALUES (?, datetime(\'now\', \'localtime\'))'
    )
    .run(sessionId)

  return getDb()
    .prepare('SELECT * FROM inactivity_logs WHERE id = ?')
    .get(result.lastInsertRowid)
}

export function resolveInactivityLog(logId: number, userNote: string): void {
  getDb()
    .prepare(
      'UPDATE inactivity_logs SET returned_at = datetime(\'now\', \'localtime\'), user_note = ? WHERE id = ?'
    )
    .run(userNote, logId)
}

export function getInactivityLogsForDate(date: string): any[] {
  return getDb()
    .prepare(
      `SELECT il.* FROM inactivity_logs il
       JOIN sessions s ON il.session_id = s.id
       JOIN daily_plans dp ON s.plan_id = dp.id
       WHERE dp.date = ?
       ORDER BY il.detected_at`
    )
    .all(date)
}

// ===== Timeline =====

export function getTimelineForDate(date: string): any {
  const plan = getPlanByDate(date)
  if (!plan) return null

  const checkIns = getCheckInsForDate(date)
  const inactivityLogs = getInactivityLogsForDate(date)

  return {
    plan,
    checkIns,
    inactivityLogs
  }
}
