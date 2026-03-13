import { useState, useEffect } from 'react'

interface SettingItem {
  key: string
  label: string
  description: string
  type: 'time' | 'number' | 'text'
  suffix?: string
}

const SETTING_DEFINITIONS: SettingItem[] = [
  {
    key: 'planning_time',
    label: 'Evening planning time',
    description: 'When you get prompted to plan tomorrow',
    type: 'time'
  },
  {
    key: 'checkin_interval',
    label: 'Check-in interval',
    description: 'How often screenshots + prompts happen during sessions',
    type: 'number',
    suffix: 'minutes'
  },
  {
    key: 'notification_repeat',
    label: 'Notification repeat interval',
    description: 'How often reminders repeat until you acknowledge them',
    type: 'number',
    suffix: 'minutes'
  },
  {
    key: 'inactivity_threshold',
    label: 'Inactivity threshold',
    description: 'How long before you get asked what you were doing',
    type: 'number',
    suffix: 'minutes'
  },
  {
    key: 'max_session_duration',
    label: 'Max session duration',
    description: 'Sessions auto-end after this long',
    type: 'number',
    suffix: 'minutes'
  },
  {
    key: 'screenshot_quality',
    label: 'Screenshot quality',
    description: 'JPEG quality (1-100). Lower = smaller files.',
    type: 'number',
    suffix: '%'
  },
  {
    key: 'ollama_model',
    label: 'Ollama model',
    description: 'The local AI model used for task categorization',
    type: 'text'
  },
  {
    key: 'ollama_endpoint',
    label: 'Ollama endpoint',
    description: 'URL where Ollama is running',
    type: 'text'
  }
]

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
    checkOllama()
  }, [])

  const loadSettings = async () => {
    const data = await window.api.getSettings()
    setSettings(data)
  }

  const checkOllama = async () => {
    const status = await window.api.getOllamaStatus()
    setOllamaStatus(status)
  }

  const handleChange = async (key: string, value: string) => {
    setSettings({ ...settings, [key]: value })
    await window.api.setSetting(key, value)
    setSaved(key)
    setTimeout(() => setSaved(null), 1500)
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      {/* Ollama status */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Ollama Status</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Local AI for task categorization
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: ollamaStatus ? 'var(--green)' : 'var(--red)'
              }}
            />
            <span style={{ fontSize: 14, color: ollamaStatus ? 'var(--green)' : 'var(--red)' }}>
              {ollamaStatus === null ? 'Checking...' : ollamaStatus ? 'Connected' : 'Not running'}
            </span>
            <button className="btn" onClick={checkOllama} style={{ marginLeft: 8 }}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Settings list */}
      <div className="card">
        {SETTING_DEFINITIONS.map((setting) => (
          <div key={setting.key} className="settings-row">
            <div>
              <div className="settings-label">{setting.label}</div>
              <div className="settings-description">{setting.description}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type={setting.type === 'time' ? 'time' : setting.type === 'number' ? 'number' : 'text'}
                className="settings-input"
                value={settings[setting.key] || ''}
                onChange={(e) => handleChange(setting.key, e.target.value)}
                min={setting.type === 'number' ? 1 : undefined}
              />
              {setting.suffix && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 50 }}>
                  {setting.suffix}
                </span>
              )}
              {saved === setting.key && (
                <span style={{ fontSize: 12, color: 'var(--green)' }}>Saved</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
