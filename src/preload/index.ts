import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // Plans
  getTodayPlan: () => ipcRenderer.invoke('plan:getToday'),
  getPlanByDate: (date: string) => ipcRenderer.invoke('plan:getByDate', date),
  getOrCreatePlanForDate: (date: string) => ipcRenderer.invoke('plan:getOrCreateForDate', date),

  // Tasks
  addTask: (
    planId: number,
    title: string,
    displayOrder: number,
    scheduledStart?: string,
    scheduledEnd?: string
  ) => ipcRenderer.invoke('task:add', planId, title, displayOrder, scheduledStart, scheduledEnd),
  completeTask: (taskId: number) => ipcRenderer.invoke('task:complete', taskId),
  uncompleteTask: (taskId: number) => ipcRenderer.invoke('task:uncomplete', taskId),
  removeTask: (taskId: number) => ipcRenderer.invoke('task:remove', taskId),

  // Sessions
  createSession: (planId: number, plannedStart?: string) =>
    ipcRenderer.invoke('session:create', planId, plannedStart),
  startSession: (sessionId: number) => ipcRenderer.invoke('session:start', sessionId),
  endSession: (sessionId: number) => ipcRenderer.invoke('session:end', sessionId),
  skipSession: (sessionId: number) => ipcRenderer.invoke('session:skip', sessionId),
  getActiveSession: () => ipcRenderer.invoke('session:getActive'),

  // Check-ins
  captureScreenshot: () => ipcRenderer.invoke('checkin:capture'),
  submitCheckIn: (
    sessionId: number,
    screenshotPath: string,
    userNote: string,
    tasks: { id: number; title: string }[]
  ) => ipcRenderer.invoke('checkin:submit', sessionId, screenshotPath, userNote, tasks),
  getCheckInsForDate: (date: string) => ipcRenderer.invoke('checkin:getForDate', date),

  // Inactivity
  createInactivityLog: (sessionId: number) => ipcRenderer.invoke('inactivity:create', sessionId),
  resolveInactivityLog: (logId: number, userNote: string) =>
    ipcRenderer.invoke('inactivity:resolve', logId, userNote),

  // Timeline
  getTimelineForDate: (date: string) => ipcRenderer.invoke('timeline:getForDate', date),

  // Ollama
  getOllamaStatus: () => ipcRenderer.invoke('ollama:status'),

  // Events from main process
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate', (_event, route) => callback(route))
  },
  onSessionUpdated: (callback: () => void) => {
    ipcRenderer.on('session:updated', () => callback())
  },
  onSessionDue: (callback: (sessionId: number) => void) => {
    ipcRenderer.on('session:due', (_event, sessionId) => callback(sessionId))
  },
  onCheckInScreenshot: (
    callback: (data: { screenshotPath: string; screenshotData: string }) => void
  ) => {
    ipcRenderer.on('checkin:screenshot', (_event, data) => callback(data))
  },
  onInactivityDetected: (callback: (sessionId: number) => void) => {
    ipcRenderer.on('inactivity:detected', (_event, sessionId) => callback(sessionId))
  },

  // Notify main process
  notifySessionStarted: () => ipcRenderer.send('session:started'),
  notifySessionEnded: () => ipcRenderer.send('session:ended'),
  notifyPlanningCompleted: () => ipcRenderer.send('planning:completed'),
  notifyCheckInClosed: () => ipcRenderer.send('checkin:windowClosed')
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
