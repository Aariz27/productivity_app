import { app, BrowserWindow, Tray, Menu, nativeImage, screen, dialog } from 'electron'
import path from 'path'
import { initDatabase, getActiveSession, getSetting, endSession } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { startScheduler, stopScheduler, startCheckInTimer, stopCheckInTimer } from './scheduler'
import {
  showNotification,
  startRepeatingNotification,
  stopRepeatingNotification,
  stopAllRepeatingNotifications,
  focusOrCreateWindow
} from './notifications'
import {
  startInactivityMonitor,
  stopInactivityMonitor,
  resetInactivityMonitor
} from './inactivity'

let mainWindow: BrowserWindow | null = null
let checkinWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: Math.min(1200, width),
    height: Math.min(800, height),
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    // Don't quit, minimize to tray
    event.preventDefault()
    mainWindow?.hide()
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function createCheckinWindow(screenshotPath: string, screenshotData: string): BrowserWindow {
  if (checkinWindow && !checkinWindow.isDestroyed()) {
    checkinWindow.focus()
    return checkinWindow
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  checkinWindow = new BrowserWindow({
    width: 600,
    height: 500,
    x: Math.round(width / 2 - 300),
    y: Math.round(height / 2 - 250),
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Load the same renderer but with a hash route for the checkin popup
  if (process.env.ELECTRON_RENDERER_URL) {
    checkinWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/checkin`)
  } else {
    checkinWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/checkin'
    })
  }

  // Pass screenshot data to the window once it's ready
  checkinWindow.webContents.once('did-finish-load', () => {
    checkinWindow?.webContents.send('checkin:screenshot', {
      screenshotPath,
      screenshotData
    })
  })

  checkinWindow.on('closed', () => {
    checkinWindow = null
  })

  return checkinWindow
}

function setupTray(): void {
  // Create a simple tray icon (16x16 template image for macOS)
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  updateTrayMenu()

  tray.setToolTip('Productivity Tracker')
}

function updateTrayMenu(): void {
  if (!tray) return

  const activeSession = getActiveSession()
  const isActive = !!activeSession

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isActive ? '● Session Active' : '○ No Active Session',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open App',
      click: () => focusOrCreateWindow(mainWindow)
    },
    {
      label: isActive ? 'End Session' : 'Quick Start Session',
      click: () => {
        if (isActive) {
          endSession(activeSession.id)
          stopCheckInTimer()
          stopInactivityMonitor()
          stopRepeatingNotification('session-reminder')
          updateTrayMenu()
          mainWindow?.webContents.send('session:updated')
        } else {
          focusOrCreateWindow(mainWindow)
          mainWindow?.webContents.send('navigate', '/session')
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        // Actually quit
        mainWindow?.removeAllListeners('close')
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setTitle(isActive ? '●' : '')
}

async function triggerCheckIn(): Promise<void> {
  const activeSession = getActiveSession()
  if (!activeSession) return

  try {
    // Import dynamically to avoid circular deps
    const { captureScreenshot, getScreenshotAsBase64 } = await import('./screenshot')
    const screenshotPath = await captureScreenshot()
    const screenshotData = getScreenshotAsBase64(screenshotPath)
    createCheckinWindow(screenshotPath, screenshotData)
  } catch (err) {
    console.error('Failed to trigger check-in:', err)
  }
}

function handleInactivityDetected(): void {
  const activeSession = getActiveSession()
  if (!activeSession) return

  // Send event to renderer to show inactivity prompt
  mainWindow?.webContents.send('inactivity:detected', activeSession.id)
  focusOrCreateWindow(mainWindow)
}

app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerIpcHandlers()

  // Create main window
  createMainWindow()

  // Setup system tray
  setupTray()

  // Start the scheduler
  startScheduler({
    onPlanningTime: () => {
      startRepeatingNotification(
        'planning-reminder',
        'Time to plan tomorrow',
        'Set your tasks and sessions for tomorrow.',
        parseInt(getSetting('notification_repeat') || '5', 10),
        () => {
          focusOrCreateWindow(mainWindow)
          mainWindow?.webContents.send('navigate', '/planning')
        }
      )
    },
    onSessionDue: (sessionId: number) => {
      startRepeatingNotification(
        'session-reminder',
        'Work session starting',
        'Time to start your scheduled work session.',
        parseInt(getSetting('notification_repeat') || '5', 10),
        () => {
          focusOrCreateWindow(mainWindow)
          mainWindow?.webContents.send('navigate', '/session')
          mainWindow?.webContents.send('session:due', sessionId)
        }
      )
    },
    onMaxSessionDuration: (sessionId: number) => {
      endSession(sessionId)
      stopCheckInTimer()
      stopInactivityMonitor()
      updateTrayMenu()
      showNotification(
        'Session ended',
        'Your session reached the maximum duration and was automatically ended.'
      )
      mainWindow?.webContents.send('session:updated')
    }
  })

  // Listen for session lifecycle events from renderer
  const { ipcMain } = require('electron')

  ipcMain.on('session:started', () => {
    // Trigger an immediate check-in when the session starts
    triggerCheckIn()

    // Start check-in timer for subsequent check-ins
    startCheckInTimer(triggerCheckIn)

    // Start inactivity monitor
    const threshold = parseInt(getSetting('inactivity_threshold') || '30', 10)
    startInactivityMonitor(threshold, handleInactivityDetected)

    // Stop session reminder notifications
    stopRepeatingNotification('session-reminder')

    updateTrayMenu()
  })

  ipcMain.on('session:ended', () => {
    stopCheckInTimer()
    stopInactivityMonitor()
    updateTrayMenu()
  })

  ipcMain.on('planning:completed', () => {
    stopRepeatingNotification('planning-reminder')
  })

  ipcMain.on('checkin:windowClosed', () => {
    if (checkinWindow && !checkinWindow.isDestroyed()) {
      checkinWindow.close()
    }
    // Reset inactivity monitor for next detection
    resetInactivityMonitor(handleInactivityDetected)
  })

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow()
    } else {
      mainWindow.show()
    }
  })

  // Test screenshot functionality on launch
  import('./screenshot').then(async ({ captureScreenshot }) => {
    try {
      await captureScreenshot()
    } catch (err: any) {
      dialog.showErrorBox(
        'Screenshot Test Failed',
        `Failed to capture a test screenshot on app launch. The check-in feature may not work correctly.\n\n${err.message}`
      )
    }
  }).catch(console.error)
})

app.on('window-all-closed', () => {
  // On macOS, don't quit when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopScheduler()
  stopCheckInTimer()
  stopInactivityMonitor()
  stopAllRepeatingNotifications()
})
