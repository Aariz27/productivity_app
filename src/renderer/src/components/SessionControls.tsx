import { useState, useEffect, useRef } from 'react'
import { formatElapsed } from '../lib/utils'

interface Session {
  id: number
  plan_id: number
  planned_start: string | null
  actual_start: string | null
  end_time: string | null
  status: string
}

export default function SessionControls(): JSX.Element {
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [pendingSessions, setPendingSessions] = useState<Session[]>([])
  const [elapsed, setElapsed] = useState('00:00:00')
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadSessionState()
    checkOllama()

    window.api.onSessionUpdated(loadSessionState)
    window.api.onSessionDue((_sessionId: number) => {
      loadSessionState()
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (activeSession?.actual_start) {
      timerRef.current = setInterval(() => {
        setElapsed(formatElapsed(activeSession.actual_start!))
      }, 1000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [activeSession])

  const loadSessionState = async () => {
    const active = await window.api.getActiveSession()
    setActiveSession(active || null)

    const planData = await window.api.getTodayPlan()
    const pending = planData.sessions.filter((s: Session) => s.status === 'pending')
    setPendingSessions(pending)
  }

  const checkOllama = async () => {
    const status = await window.api.getOllamaStatus()
    setOllamaStatus(status)
  }

  const handleStartSession = async (sessionId?: number) => {
    let session: Session

    if (sessionId) {
      await window.api.startSession(sessionId)
      session = { id: sessionId } as Session
    } else {
      // Quick start — create a new session and start it
      const planData = await window.api.getTodayPlan()
      const newSession = await window.api.createSession(planData.plan.id)
      await window.api.startSession(newSession.id)
      session = newSession
    }

    window.api.notifySessionStarted()
    loadSessionState()
  }

  const handleEndSession = async () => {
    if (!activeSession) return
    await window.api.endSession(activeSession.id)
    window.api.notifySessionEnded()
    setActiveSession(null)
    setElapsed('00:00:00')
    loadSessionState()
  }

  const handleSkipSession = async (sessionId: number) => {
    await window.api.skipSession(sessionId)
    loadSessionState()
  }

  return (
    <div>
      <h1 className="page-title">Session</h1>

      {/* Ollama status */}
      {ollamaStatus === false && (
        <div className="card" style={{ borderColor: 'var(--yellow)', background: 'var(--yellow-bg)', marginBottom: 16 }}>
          <p style={{ color: 'var(--yellow)', fontSize: 14 }}>
            Ollama is not running. Start it to enable AI categorization.
            Without it, you can still log check-ins manually.
          </p>
        </div>
      )}

      {/* Active session banner */}
      {activeSession ? (
        <div className="session-banner active">
          <div>
            <div style={{ fontSize: 14, color: 'var(--green)', marginBottom: 4 }}>
              Session in progress
            </div>
            <div className="session-timer">{elapsed}</div>
          </div>
          <button className="btn btn-danger" onClick={handleEndSession}>
            End Session
          </button>
        </div>
      ) : (
        <div className="session-banner inactive">
          <div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              No active session
            </div>
          </div>
          <button className="btn btn-success" onClick={() => handleStartSession()}>
            Quick Start
          </button>
        </div>
      )}

      {/* Pending scheduled sessions */}
      {pendingSessions.length > 0 && !activeSession && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Scheduled Sessions</h3>
          {pendingSessions.map((session) => (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <span style={{ fontSize: 14 }}>
                {session.planned_start || 'Unscheduled'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-success"
                  onClick={() => handleStartSession(session.id)}
                >
                  Start
                </button>
                <button
                  className="btn"
                  onClick={() => handleSkipSession(session.id)}
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session info when active */}
      {activeSession && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>How it works</h3>
          <ul style={{ color: 'var(--text-secondary)', fontSize: 14, paddingLeft: 20, lineHeight: 2 }}>
            <li>A check-in popup will appear at your configured interval</li>
            <li>You'll see a screenshot and type what you're working on</li>
            <li>AI will categorize it against your tasks</li>
            <li>If you go idle, you'll be asked what you were doing</li>
            <li>End the session when you're done working</li>
          </ul>
        </div>
      )}
    </div>
  )
}
