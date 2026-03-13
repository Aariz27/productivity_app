import { useState, useEffect, useRef } from 'react'

export default function CheckInPopup(): JSX.Element {
  const [screenshotPath, setScreenshotPath] = useState('')
  const [screenshotData, setScreenshotData] = useState('')
  const [userNote, setUserNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Listen for screenshot data from main process
    window.api.onCheckInScreenshot((data) => {
      setScreenshotPath(data.screenshotPath)
      setScreenshotData(data.screenshotData)
    })

    // Focus the input when ready
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  const handleSubmit = async () => {
    if (submitting || submitted) return

    setSubmitting(true)

    try {
      // Get active session and today's tasks
      const session = await window.api.getActiveSession()
      const planData = await window.api.getTodayPlan()

      if (session) {
        const tasks = planData.tasks.map((t: any) => ({ id: t.id, title: t.title }))
        await window.api.submitCheckIn(session.id, screenshotPath, userNote || 'nothing', tasks)
      }

      setSubmitted(true)

      // Close the popup window after a brief moment
      setTimeout(() => {
        window.api.notifyCheckInClosed()
      }, 500)
    } catch (err) {
      console.error('Check-in submit failed:', err)
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="checkin-popup">
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
        What are you working on?
      </div>

      {screenshotData && (
        <img
          src={screenshotData}
          alt="Current screen"
          className="checkin-screenshot-preview"
        />
      )}

      <div className="checkin-input-area">
        <textarea
          ref={inputRef}
          className="checkin-input"
          placeholder="e.g. editing youtube thumbnail, researching SEGP samples..."
          value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting || submitted}
        />

        <div className="checkin-submit-row">
          {submitted ? (
            <span style={{ color: 'var(--green)', fontSize: 14 }}>Logged!</span>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ padding: '8px 24px' }}
            >
              {submitting ? 'Logging...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
