// ===== Database row types =====

export interface DailyPlan {
  id: number
  date: string // YYYY-MM-DD
  created_at: string
}

export interface Task {
  id: number
  plan_id: number
  title: string
  is_non_negotiable: number // 0 or 1
  display_order: number
  scheduled_start: string | null
  scheduled_end: string | null
  completed_at: string | null
  created_at: string
}

export interface Session {
  id: number
  plan_id: number | null
  planned_start: string | null
  actual_start: string | null
  end_time: string | null
  status: 'pending' | 'active' | 'completed' | 'skipped'
  created_at: string
}

export interface CheckIn {
  id: number
  session_id: number
  timestamp: string
  screenshot_path: string
  user_note: string | null
  ai_category: string | null
  task_id: number | null
  created_at: string
}

export interface InactivityLog {
  id: number
  session_id: number
  detected_at: string
  returned_at: string | null
  user_note: string | null
  created_at: string
}

export interface AppSettings {
  planning_time: string        // HH:MM format, default "21:00"
  checkin_interval: number     // minutes, default 60
  notification_repeat: number  // minutes, default 5
  inactivity_threshold: number // minutes, default 30
  max_session_duration: number // minutes, default 240
  screenshot_quality: number   // 1-100, default 80
  screenshot_path: string      // filesystem path
  ollama_model: string         // default "llama3.2:3b"
  ollama_endpoint: string      // default "http://localhost:11434"
}

// ===== IPC types =====

export interface PlanWithTasks extends DailyPlan {
  tasks: Task[]
  sessions: Session[]
}

export interface CheckInWithScreenshot extends CheckIn {
  screenshot_data?: string // base64 for display in renderer
}

export interface TimelineEntry {
  type: 'checkin' | 'task_completed' | 'inactivity' | 'session_start' | 'session_end'
  timestamp: string
  data: CheckIn | Task | InactivityLog | Session
}

export interface DaySummary {
  date: string
  total_session_time_minutes: number
  tasks_completed: number
  tasks_total: number
  time_per_task: Record<string, number> // task title -> minutes
  uncategorized_minutes: number
  timeline: TimelineEntry[]
}
