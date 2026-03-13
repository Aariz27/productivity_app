import { powerMonitor } from 'electron'

let inactivityCallback: (() => void) | null = null
let checkInterval: NodeJS.Timeout | null = null
let thresholdSeconds = 30 * 60 // default 30 minutes

export function startInactivityMonitor(
  thresholdMinutes: number,
  onInactive: () => void
): void {
  stopInactivityMonitor()

  thresholdSeconds = thresholdMinutes * 60
  inactivityCallback = onInactive

  // Check system idle time every 60 seconds
  checkInterval = setInterval(() => {
    const idleTime = powerMonitor.getSystemIdleTime()
    if (idleTime >= thresholdSeconds && inactivityCallback) {
      inactivityCallback()
      // Reset so we don't fire again until they come back and go idle again
      inactivityCallback = null
    }
  }, 60 * 1000)
}

export function stopInactivityMonitor(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  inactivityCallback = null
}

export function resetInactivityMonitor(onInactive: () => void): void {
  inactivityCallback = onInactive
}
