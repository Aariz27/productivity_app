import { useState, useEffect } from 'react'
import { getTomorrow, formatDate } from '../lib/utils'

interface Task {
  id: number
  title: string
  is_non_negotiable: number
  display_order: number
  scheduled_start: string | null
  scheduled_end: string | null
}

interface Props {
  onComplete: () => void
}

export default function PlanningScreen({ onComplete }: Props): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([])
  const [planId, setPlanId] = useState<number | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [sessionTimes, setSessionTimes] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const tomorrow = getTomorrow()

  useEffect(() => {
    loadPlan()
  }, [])

  const loadPlan = async () => {
    // Get or create tomorrow's plan (creates it with the 3 core tasks if it doesn't exist)
    const data = await window.api.getOrCreatePlanForDate(tomorrow)

    setPlanId(data.plan.id)
    setTasks(data.tasks)

    // Load existing session times
    if (data.sessions && data.sessions.length > 0) {
      setSessionTimes(data.sessions.map((s: any) => s.planned_start || ''))
    }
  }

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !planId) return
    const customTasks = tasks.filter((t) => !t.is_non_negotiable)
    if (customTasks.length >= 3) return

    const task = await window.api.addTask(planId, newTaskTitle.trim(), tasks.length)
    setTasks([...tasks, task])
    setNewTaskTitle('')
  }

  const handleRemoveTask = async (taskId: number) => {
    await window.api.removeTask(taskId)
    setTasks(tasks.filter((t) => t.id !== taskId))
  }

  const addSessionTime = () => {
    setSessionTimes([...sessionTimes, ''])
  }

  const updateSessionTime = (index: number, value: string) => {
    const updated = [...sessionTimes]
    updated[index] = value
    setSessionTimes(updated)
  }

  const removeSessionTime = (index: number) => {
    setSessionTimes(sessionTimes.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!planId) return
    setSaving(true)

    // Create sessions for each time
    const validTimes = sessionTimes.filter((t) => t.trim() !== '')
    for (const time of validTimes) {
      await window.api.createSession(planId, time)
    }

    // Notify main process that planning is done
    window.api.notifyPlanningCompleted()

    setSaving(false)
    setSaved(true)
  }

  const customTaskCount = tasks.filter((t) => !t.is_non_negotiable).length

  return (
    <div>
      <h1 className="page-title">Plan for {formatDate(tomorrow)}</h1>

      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Tasks</h3>

        {tasks.map((task) => (
          <div key={task.id} className="task-item">
            <span className="task-title">{task.title}</span>
            {task.is_non_negotiable ? (
              <span className="task-badge non-negotiable">core</span>
            ) : (
              <button className="task-remove" onClick={() => handleRemoveTask(task.id)}>
                ×
              </button>
            )}
          </div>
        ))}

        {customTaskCount < 3 && (
          <div className="add-task-row">
            <input
              className="input"
              placeholder="Add a task for tomorrow..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            />
            <button className="btn btn-primary" onClick={handleAddTask}>
              Add
            </button>
          </div>
        )}

        {customTaskCount >= 3 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
            Maximum 6 tasks (3 core + 3 custom)
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Work Sessions</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Set start times for your work sessions. You'll get a notification at each time.
        </p>

        {sessionTimes.map((time, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14, width: 80 }}>
              Session {index + 1}
            </span>
            <input
              type="time"
              className="input"
              style={{ width: 160 }}
              value={time}
              onChange={(e) => updateSessionTime(index, e.target.value)}
            />
            {sessionTimes.length > 1 && (
              <button className="task-remove" onClick={() => removeSessionTime(index)}>
                ×
              </button>
            )}
          </div>
        ))}

        <button
          className="btn"
          onClick={addSessionTime}
          style={{ marginTop: 8 }}
        >
          + Add session
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 }}>
        {saved && (
          <span style={{ color: 'var(--green)', fontSize: 14 }}>
            Plan saved for tomorrow
          </span>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || saved}
          style={{ padding: '10px 32px', fontSize: 16 }}
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Plan'}
        </button>
      </div>
    </div>
  )
}
