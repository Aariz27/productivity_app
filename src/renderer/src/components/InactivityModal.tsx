import { useState, useRef, useEffect } from 'react'

interface Props {
  sessionId: number
  onResolved: () => void
}

export default function InactivityModal({ sessionId, onResolved }: Props): JSX.Element {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [logId, setLogId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Create the inactivity log entry immediately
    const createLog = async () => {
      const log = await window.api.createInactivityLog(sessionId)
      setLogId(log.id)
    }
    createLog()
    inputRef.current?.focus()
  }, [sessionId])

  const handleSubmit = async () => {
    if (!note.trim() || !logId || submitting) return
    setSubmitting(true)

    await window.api.resolveInactivityLog(logId, note.trim())
    setSubmitting(false)
    onResolved()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">You've been away for a while</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          What were you doing? (No judgment — just logging.)
        </p>

        <input
          ref={inputRef}
          className="input"
          placeholder="e.g. lunch, went for a walk, talking to friends..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting}
          style={{ marginBottom: 16 }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!note.trim() || submitting}
          >
            {submitting ? 'Logging...' : 'Log it'}
          </button>
        </div>
      </div>
    </div>
  )
}
