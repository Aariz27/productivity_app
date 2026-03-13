import { useState, useEffect } from 'react'
import { getToday, formatDate, formatTime, minutesToHHMM, getTaskColor } from '../lib/utils'

interface CheckIn {
  id: number
  session_id: number
  timestamp: string
  screenshot_path: string
  screenshot_data?: string
  user_note: string | null
  ai_category: string | null
  task_id: number | null
}

interface Task {
  id: number
  title: string
  completed_at: string | null
}

interface InactivityLog {
  id: number
  detected_at: string
  returned_at: string | null
  user_note: string | null
}

export default function Timeline(): JSX.Element {
  const [date, setDate] = useState(getToday())
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [inactivityLogs, setInactivityLogs] = useState<InactivityLog[]>([])
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTimeline()
  }, [date])

  const loadTimeline = async () => {
    setLoading(true)

    const [checkInsData, planData] = await Promise.all([
      window.api.getCheckInsForDate(date),
      window.api.getPlanByDate(date)
    ])

    setCheckIns(checkInsData || [])
    setTasks(planData?.tasks || [])

    const inactivity = await window.api.getTimelineForDate(date)
    setInactivityLogs(inactivity?.inactivityLogs || [])

    setLoading(false)
  }

  const changeDate = (delta: number) => {
    const [year, month, day] = date.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() + delta)
    const newYear = d.getFullYear()
    const newMonth = String(d.getMonth() + 1).padStart(2, '0')
    const newDay = String(d.getDate()).padStart(2, '0')
    setDate(`${newYear}-${newMonth}-${newDay}`)
  }

  // Merge check-ins and inactivity logs into a single timeline
  type TimelineItem =
    | { type: 'checkin'; timestamp: string; data: CheckIn }
    | { type: 'inactivity'; timestamp: string; data: InactivityLog }
    | { type: 'task_completed'; timestamp: string; data: Task }

  const timelineItems: TimelineItem[] = []

  for (const ci of checkIns) {
    timelineItems.push({ type: 'checkin', timestamp: ci.timestamp, data: ci })
  }

  for (const il of inactivityLogs) {
    timelineItems.push({ type: 'inactivity', timestamp: il.detected_at, data: il })
  }

  for (const task of tasks) {
    if (task.completed_at) {
      timelineItems.push({ type: 'task_completed', timestamp: task.completed_at, data: task })
    }
  }

  timelineItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Better Summary calculations tracking precise times
  const completedTasks = tasks.filter((t) => t.completed_at)
  const taskTitles = tasks.map((t) => t.title)
  const timePerTask: Record<string, number> = {}
  let totalTrackedMinutes = 0

  // Calculate time by taking the delta between chronological events
  let lastEventTime: number | null = null
  let currentCategory: string | null = null
  let isIdle = false

  for (let i = 0; i < timelineItems.length; i++) {
    const item = timelineItems[i]
    const currentEventTime = new Date(item.timestamp).getTime()

    // If we have a previous event and we weren't idle, add the delta
    if (lastEventTime && currentCategory && !isIdle) {
      const deltaMinutes = (currentEventTime - lastEventTime) / (1000 * 60)

      // Cap individual deltas at 120 minutes to prevent massive outliers if the app crashed
      const validDelta = Math.min(Math.max(0, deltaMinutes), 120)

      timePerTask[currentCategory] = (timePerTask[currentCategory] || 0) + validDelta
      totalTrackedMinutes += validDelta
    }

    // Update state for the next iteration
    if (item.type === 'checkin') {
      currentCategory = (item.data as CheckIn).ai_category || 'uncategorized'
      isIdle = false
    } else if (item.type === 'inactivity') {
      const il = item.data as InactivityLog
      isIdle = true

      // If we returned from inactivity, that counts as the start of a new tracking period
      if (il.returned_at) {
        lastEventTime = new Date(il.returned_at).getTime()
        isIdle = false
        continue // Skip updating lastEventTime to currentEventTime
      }
    }

    lastEventTime = currentEventTime
  }

  // If there's an active session on "today", add the rolling time to the last known category
  const isTodayDate = (d: string) => d === getToday()
  if (isTodayDate(date) && lastEventTime && !isIdle && currentCategory) {
    const now = Date.now()
    const deltaMinutes = (now - lastEventTime) / (1000 * 60)
    // Only add if less than 60 minutes have passed since last event (avoids phantom tracking if app disconnected)
    if (deltaMinutes > 0 && deltaMinutes <= 60) {
      timePerTask[currentCategory] = (timePerTask[currentCategory] || 0) + deltaMinutes
      totalTrackedMinutes += deltaMinutes
    }
  }

  const uncategorizedMinutes = timePerTask['uncategorized'] || 0
  delete timePerTask['uncategorized']

  return (
    <div className="timeline-page">
      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn" onClick={() => changeDate(-1)}>
          ←
        </button>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {formatDate(date)}
        </h1>
        <button className="btn" onClick={() => changeDate(1)} disabled={isTodayDate(date)}>
          →
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <>
          {/* Summary */}
          <div className="summary-grid">
            <div className="summary-stat">
              <div className="summary-stat-value">
                {completedTasks.length}/{tasks.length}
              </div>
              <div className="summary-stat-label">Tasks completed</div>
            </div>
            <div className="summary-stat">
              <div className="summary-stat-value">{checkIns.length}</div>
              <div className="summary-stat-label">Check-ins</div>
            </div>
            <div className="summary-stat">
              <div className="summary-stat-value">
                {minutesToHHMM(totalTrackedMinutes)}
              </div>
              <div className="summary-stat-label">Tracked time</div>
            </div>
            {uncategorizedMinutes > 0 && (
              <div className="summary-stat">
                <div className="summary-stat-value" style={{ color: 'var(--text-muted)' }}>
                  {minutesToHHMM(uncategorizedMinutes)}
                </div>
                <div className="summary-stat-label">Uncategorized</div>
              </div>
            )}
          </div>

          {/* Time per task breakdown */}
          {Object.keys(timePerTask).length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
                Time per task
              </h3>
              {Object.entries(timePerTask).map(([task, minutes]) => (
                <div
                  key={task}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getTaskColor(task, taskTitles),
                        display: 'inline-block'
                      }}
                    />
                    {task}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{minutesToHHMM(minutes)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          {timelineItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                No activity logged for this day.
              </p>
            </div>
          ) : (
            <div className="timeline">
              {timelineItems.map((item, index) => {
                if (item.type === 'checkin') {
                  const ci = item.data as CheckIn
                  const category = ci.ai_category || 'uncategorized'
                  return (
                    <div key={`ci-${ci.id}`} className="timeline-entry">
                      <div className="timeline-time">{formatTime(ci.timestamp)}</div>
                      {ci.screenshot_data && (
                        <img
                          src={ci.screenshot_data}
                          alt="Screenshot"
                          className={`timeline-screenshot ${expandedScreenshot === ci.screenshot_data ? 'expanded' : ''}`}
                          onClick={() =>
                            setExpandedScreenshot(
                              expandedScreenshot === ci.screenshot_data ? null : ci.screenshot_data!
                            )
                          }
                        />
                      )}
                      <div className="timeline-note">{ci.user_note || '(no note)'}</div>
                      <span
                        className={`timeline-category ${category === 'uncategorized' ? 'uncategorized' : ''}`}
                        style={
                          category !== 'uncategorized'
                            ? { background: getTaskColor(category, taskTitles) }
                            : undefined
                        }
                      >
                        {category}
                      </span>
                    </div>
                  )
                }

                if (item.type === 'inactivity') {
                  const il = item.data as InactivityLog
                  return (
                    <div key={`il-${il.id}`} className="timeline-entry inactivity">
                      <div className="timeline-time">{formatTime(il.detected_at)}</div>
                      <div className="timeline-note" style={{ color: 'var(--yellow)' }}>
                        Away: {il.user_note || '(no reason given)'}
                      </div>
                      {il.returned_at && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Returned at {formatTime(il.returned_at)}
                        </div>
                      )}
                    </div>
                  )
                }

                if (item.type === 'task_completed') {
                  const task = item.data as Task
                  return (
                    <div key={`tc-${task.id}`} className="timeline-entry completed">
                      <div className="timeline-time">{formatTime(task.completed_at!)}</div>
                      <div className="timeline-note" style={{ color: 'var(--green)' }}>
                        Completed: {task.title}
                      </div>
                    </div>
                  )
                }

                return null
              })}
            </div>
          )}
        </>
      )}

      {/* Expanded screenshot overlay backdrop */}
      {expandedScreenshot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 999
          }}
          onClick={() => setExpandedScreenshot(null)}
        />
      )}
    </div>
  )
}
