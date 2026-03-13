import { systemPreferences } from 'electron'
import { getSetting, getScreenshotDir } from './database'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function captureScreenshot(): Promise<string> {
  // Check macOS screen recording permission
  const hasAccess = systemPreferences.getMediaAccessStatus('screen')
  if (hasAccess === 'denied') {
    throw new Error(
      'Screen recording permission denied. Go to System Settings > Privacy & Security > Screen Recording and enable this app.'
    )
  }

  // Organize by date
  const today = new Date().toISOString().split('T')[0]
  const screenshotDir = getSetting('screenshot_path') || getScreenshotDir()
  const dateDir = path.join(screenshotDir, today)

  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true })
  }

  const timestamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '')
  const filename = `checkin-${timestamp}.jpg`
  const filepath = path.join(dateDir, filename)

  try {
    // Attempt fallback to native macOS screencapture CLI instead of Electron's buggy desktopCapturer
    if (process.platform === 'darwin') {
      await execAsync(`screencapture -x -t jpg "${filepath}"`)

      // Double check capture worked
      if (!fs.existsSync(filepath) || fs.statSync(filepath).size < 100) {
        throw new Error('Screenshot file created but is empty.')
      }

      return filepath
    } else {
      throw new Error('This app is currently optimized for macOS. Screencapture failed.')
    }
  } catch (error: any) {
    throw new Error(`Failed to capture screen: ${error.message || 'Unknown error'}`)
  }
}

export function getScreenshotAsBase64(filepath: string): string {
  if (!fs.existsSync(filepath)) {
    console.warn(`Screenshot file not found: ${filepath}`)
    return ''
  }
  const buffer = fs.readFileSync(filepath)
  if (buffer.length < 100) {
    console.warn(`Screenshot file is too small (${buffer.length} bytes), likely corrupted: ${filepath}`)
    return ''
  }
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}
