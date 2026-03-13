import { Notification, BrowserWindow } from 'electron'

let reminderIntervals: Map<string, NodeJS.Timeout> = new Map()

export function showNotification(
  title: string,
  body: string,
  onClick?: () => void
): void {
  const notification = new Notification({
    title,
    body,
    silent: false
  })

  if (onClick) {
    notification.on('click', onClick)
  }

  notification.show()
}

export function startRepeatingNotification(
  id: string,
  title: string,
  body: string,
  intervalMinutes: number,
  onClick?: () => void
): void {
  // Stop any existing reminder with this id
  stopRepeatingNotification(id)

  // Show immediately
  showNotification(title, body, onClick)

  // Then repeat
  const interval = setInterval(() => {
    showNotification(title, body, onClick)
  }, intervalMinutes * 60 * 1000)

  reminderIntervals.set(id, interval)
}

export function stopRepeatingNotification(id: string): void {
  const interval = reminderIntervals.get(id)
  if (interval) {
    clearInterval(interval)
    reminderIntervals.delete(id)
  }
}

export function stopAllRepeatingNotifications(): void {
  for (const [id] of reminderIntervals) {
    stopRepeatingNotification(id)
  }
}

export function focusOrCreateWindow(mainWindow: BrowserWindow | null): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}
