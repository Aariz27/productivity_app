export function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}

export function getToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function elapsedMinutes(startTime: string): number {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  return (now - start) / (1000 * 60)
}

export function formatElapsed(startTime: string): string {
  const mins = elapsedMinutes(startTime)
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  const s = Math.floor((mins * 60) % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Color assignments for task categories in timeline
const TASK_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#06b6d4'  // cyan
]

export function getTaskColor(taskTitle: string, allTasks: string[]): string {
  const index = allTasks.indexOf(taskTitle)
  if (index === -1) return '#666666'
  return TASK_COLORS[index % TASK_COLORS.length]
}
