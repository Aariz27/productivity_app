import { getSetting, getActiveSession, getOrCreateTodayPlan } from './database'

let schedulerInterval: NodeJS.Timeout | null = null
let lastPlanningPrompt: string | null = null
let sessionCheckCallbacks: {
  onPlanningTime?: () => void
  onSessionDue?: (sessionId: number) => void
  onCheckInDue?: () => void
  onMaxSessionDuration?: (sessionId: number) => void
} = {}

export function startScheduler(callbacks: typeof sessionCheckCallbacks): void {
  stopScheduler()
  sessionCheckCallbacks = callbacks

  // Check every 30 seconds
  schedulerInterval = setInterval(() => {
    checkScheduledEvents()
  }, 30 * 1000)

  // Also run immediately
  checkScheduledEvents()
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}

function checkScheduledEvents(): void {
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const today = now.toISOString().split('T')[0]

  // Check if it's planning time
  const planningTime = getSetting('planning_time') || '21:00'
  if (currentTime === planningTime && lastPlanningPrompt !== today) {
    lastPlanningPrompt = today
    sessionCheckCallbacks.onPlanningTime?.()
  }

  // Check if any pending sessions are due
  const planData = getOrCreateTodayPlan()
  for (const session of planData.sessions) {
    if (session.status === 'pending' && session.planned_start) {
      const plannedTime = session.planned_start
      if (currentTime >= plannedTime) {
        sessionCheckCallbacks.onSessionDue?.(session.id)
      }
    }
  }

  // Check if active session has exceeded max duration
  const activeSession = getActiveSession()
  if (activeSession && activeSession.actual_start) {
    const maxDuration = parseInt(getSetting('max_session_duration') || '240', 10)
    const startTime = new Date(activeSession.actual_start).getTime()
    const elapsed = (now.getTime() - startTime) / (1000 * 60)
    if (elapsed >= maxDuration) {
      sessionCheckCallbacks.onMaxSessionDuration?.(activeSession.id)
    }
  }
}

// Check-in timer (separate from scheduler since it's per-session)
let checkInInterval: NodeJS.Timeout | null = null

export function startCheckInTimer(onCheckIn: () => void): void {
  stopCheckInTimer()
  const intervalMinutes = parseInt(getSetting('checkin_interval') || '60', 10)
  checkInInterval = setInterval(onCheckIn, intervalMinutes * 60 * 1000)
}

export function stopCheckInTimer(): void {
  if (checkInInterval) {
    clearInterval(checkInInterval)
    checkInInterval = null
  }
}
