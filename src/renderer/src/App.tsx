import { useState, useEffect, useCallback } from 'react'
import PlanningScreen from './components/PlanningScreen'
import TaskList from './components/TaskList'
import SessionControls from './components/SessionControls'
import Timeline from './components/Timeline'
import Settings from './components/Settings'
import CheckInPopup from './components/CheckInPopup'
import InactivityModal from './components/InactivityModal'

type Page = 'tasks' | 'planning' | 'session' | 'timeline' | 'settings'

// Detect if this is the check-in popup window
const isCheckInWindow = window.location.hash === '#/checkin'

function App(): JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('tasks')
  const [inactivitySessionId, setInactivitySessionId] = useState<number | null>(null)

  // Listen for navigation commands from main process
  useEffect(() => {
    window.api.onNavigate((route: string) => {
      const page = route.replace('/', '') as Page
      if (['tasks', 'planning', 'session', 'timeline', 'settings'].includes(page)) {
        setCurrentPage(page)
      }
    })

    window.api.onInactivityDetected((sessionId: number) => {
      setInactivitySessionId(sessionId)
    })
  }, [])

  const handleInactivityResolved = useCallback(() => {
    setInactivitySessionId(null)
  }, [])

  // If this is the check-in popup window, render just that
  if (isCheckInWindow) {
    return <CheckInPopup />
  }

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="main-content">
        {currentPage === 'tasks' && <TaskList />}
        {currentPage === 'planning' && <PlanningScreen onComplete={() => setCurrentPage('tasks')} />}
        {currentPage === 'session' && <SessionControls />}
        {currentPage === 'timeline' && <Timeline />}
        {currentPage === 'settings' && <Settings />}
      </main>

      {inactivitySessionId !== null && (
        <InactivityModal
          sessionId={inactivitySessionId}
          onResolved={handleInactivityResolved}
        />
      )}
    </div>
  )
}

function Sidebar({
  currentPage,
  onNavigate
}: {
  currentPage: Page
  onNavigate: (page: Page) => void
}): JSX.Element {
  const [hasActiveSession, setHasActiveSession] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const session = await window.api.getActiveSession()
      setHasActiveSession(!!session)
    }
    checkSession()

    window.api.onSessionUpdated(checkSession)
    const interval = setInterval(checkSession, 10000)
    return () => clearInterval(interval)
  }, [])

  const links: { page: Page; label: string; icon: string }[] = [
    { page: 'tasks', label: 'Today', icon: '☐' },
    { page: 'session', label: 'Session', icon: '▶' },
    { page: 'timeline', label: 'Timeline', icon: '◷' },
    { page: 'planning', label: 'Plan Tomorrow', icon: '✎' },
    { page: 'settings', label: 'Settings', icon: '⚙' }
  ]

  return (
    <nav className="sidebar">
      <div className="sidebar-nav">
        {links.map((link) => (
          <button
            key={link.page}
            className={`sidebar-link ${currentPage === link.page ? 'active' : ''}`}
            onClick={() => onNavigate(link.page)}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{link.icon}</span>
            {link.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div className={`sidebar-session-status ${hasActiveSession ? 'active' : ''}`}>
        {hasActiveSession ? 'Session in progress' : 'No active session'}
      </div>
    </nav>
  )
}

export default App
