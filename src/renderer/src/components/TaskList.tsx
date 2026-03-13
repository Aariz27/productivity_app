import { useState, useEffect, useCallback } from 'react'

interface Task {
  id: number
  plan_id: number
  title: string
  is_non_negotiable: number
  display_order: number
  scheduled_start: string | null
  scheduled_end: string | null
  completed_at: string | null
}

export default function TaskList(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([])
  const [planId, setPlanId] = useState<number | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const loadTasks = useCallback(async () => {
    const data = await window.api.getTodayPlan()
    setPlanId(data.plan.id)
    setTasks(data.tasks)
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleToggle = async (task: Task) => {
    if (task.completed_at) {
      await window.api.uncompleteTask(task.id)
    } else {
      await window.api.completeTask(task.id)
    }
    loadTasks()
  }

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !planId) return

    const customTasks = tasks.filter((t) => !t.is_non_negotiable)
    if (customTasks.length >= 3) return // Hard cap: 3 non-negotiable + 3 custom = 6

    await window.api.addTask(planId, newTaskTitle.trim(), tasks.length)
    setNewTaskTitle('')
    loadTasks()
  }

  const handleRemoveTask = async (taskId: number) => {
    await window.api.removeTask(taskId)
    loadTasks()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddTask()
  }

  const completedCount = tasks.filter((t) => t.completed_at).length
  const customTaskCount = tasks.filter((t) => !t.is_non_negotiable).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Today</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {completedCount}/{tasks.length} done
        </span>
      </div>

      <div>
        {tasks.map((task) => (
          <div key={task.id} className={`task-item ${task.completed_at ? 'completed' : ''}`}>
            <button
              className={`task-checkbox ${task.completed_at ? 'checked' : ''}`}
              onClick={() => handleToggle(task)}
            >
              {task.completed_at && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            <span className={`task-title ${task.completed_at ? 'completed' : ''}`}>
              {task.title}
            </span>

            {task.is_non_negotiable ? (
              <span className="task-badge non-negotiable">core</span>
            ) : null}

            {task.scheduled_start && (
              <span className="task-time">
                {task.scheduled_start}{task.scheduled_end ? ` - ${task.scheduled_end}` : ''}
              </span>
            )}

            {task.completed_at && (
              <span className="task-time">
                {new Date(task.completed_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            )}

            {!task.is_non_negotiable && !task.completed_at && (
              <button className="task-remove" onClick={() => handleRemoveTask(task.id)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {customTaskCount < 3 && (
        <div className="add-task-row">
          <input
            className="input"
            placeholder="Add a task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn btn-primary" onClick={handleAddTask}>
            Add
          </button>
        </div>
      )}

      {customTaskCount >= 3 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
          Maximum 6 tasks reached (3 core + 3 custom)
        </p>
      )}
    </div>
  )
}
