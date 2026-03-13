import { ipcMain } from 'electron'
import {
  getAllSettings,
  setSetting,
  getOrCreateTodayPlan,
  getOrCreatePlanForDate,
  getPlanByDate,
  addTask,
  completeTask,
  uncompleteTask,
  removeTask,
  createSession,
  startSession,
  endSession,
  skipSession,
  getActiveSession,
  createCheckIn,
  getCheckInsForDate,
  createInactivityLog,
  resolveInactivityLog,
  getInactivityLogsForDate,
  getTimelineForDate
} from './database'
import { captureScreenshot, getScreenshotAsBase64 } from './screenshot'
import { categorizeActivity, isOllamaRunning } from './ollama'

export function registerIpcHandlers(): void {
  // ===== Settings =====
  ipcMain.handle('settings:getAll', () => {
    return getAllSettings()
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    setSetting(key, value)
    return true
  })

  // ===== Plans =====
  ipcMain.handle('plan:getToday', () => {
    return getOrCreateTodayPlan()
  })

  ipcMain.handle('plan:getByDate', (_event, date: string) => {
    return getPlanByDate(date)
  })

  ipcMain.handle('plan:getOrCreateForDate', (_event, date: string) => {
    return getOrCreatePlanForDate(date)
  })

  // ===== Tasks =====
  ipcMain.handle(
    'task:add',
    (
      _event,
      planId: number,
      title: string,
      displayOrder: number,
      scheduledStart?: string,
      scheduledEnd?: string
    ) => {
      return addTask(planId, title, displayOrder, scheduledStart, scheduledEnd)
    }
  )

  ipcMain.handle('task:complete', (_event, taskId: number) => {
    completeTask(taskId)
    return true
  })

  ipcMain.handle('task:uncomplete', (_event, taskId: number) => {
    uncompleteTask(taskId)
    return true
  })

  ipcMain.handle('task:remove', (_event, taskId: number) => {
    removeTask(taskId)
    return true
  })

  // ===== Sessions =====
  ipcMain.handle('session:create', (_event, planId: number, plannedStart?: string) => {
    return createSession(planId, plannedStart)
  })

  ipcMain.handle('session:start', (_event, sessionId: number) => {
    startSession(sessionId)
    return true
  })

  ipcMain.handle('session:end', (_event, sessionId: number) => {
    endSession(sessionId)
    return true
  })

  ipcMain.handle('session:skip', (_event, sessionId: number) => {
    skipSession(sessionId)
    return true
  })

  ipcMain.handle('session:getActive', () => {
    return getActiveSession()
  })

  // ===== Check-ins =====
  ipcMain.handle('checkin:capture', async () => {
    try {
      const screenshotPath = await captureScreenshot()
      const base64 = getScreenshotAsBase64(screenshotPath)
      return { screenshotPath, screenshotData: base64 }
    } catch (err) {
      console.error('Screenshot capture failed:', err)
      return null
    }
  })

  ipcMain.handle(
    'checkin:submit',
    async (
      _event,
      sessionId: number,
      screenshotPath: string,
      userNote: string,
      tasks: { id: number; title: string }[]
    ) => {
      // Try AI categorization
      let aiCategory = 'uncategorized'
      let taskId: number | null = null

      const ollamaUp = await isOllamaRunning()
      if (ollamaUp && userNote.trim()) {
        const result = await categorizeActivity(userNote, tasks)
        aiCategory = result.category
        taskId = result.taskId
      }

      const checkIn = createCheckIn(sessionId, screenshotPath, userNote, aiCategory, taskId)
      return checkIn
    }
  )

  ipcMain.handle('checkin:getForDate', (_event, date: string) => {
    const checkIns = getCheckInsForDate(date)
    // Attach base64 screenshot data
    return checkIns.map((ci: any) => ({
      ...ci,
      screenshot_data: getScreenshotAsBase64(ci.screenshot_path)
    }))
  })

  // ===== Inactivity =====
  ipcMain.handle('inactivity:create', (_event, sessionId: number) => {
    return createInactivityLog(sessionId)
  })

  ipcMain.handle('inactivity:resolve', (_event, logId: number, userNote: string) => {
    resolveInactivityLog(logId, userNote)
    return true
  })

  ipcMain.handle('inactivity:getForDate', (_event, date: string) => {
    return getInactivityLogsForDate(date)
  })

  // ===== Timeline =====
  ipcMain.handle('timeline:getForDate', (_event, date: string) => {
    return getTimelineForDate(date)
  })

  // ===== Ollama =====
  ipcMain.handle('ollama:status', async () => {
    return await isOllamaRunning()
  })
}
