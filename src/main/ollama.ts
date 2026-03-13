import { getSetting } from './database'

interface OllamaResponse {
  response: string
  done: boolean
}

export async function isOllamaRunning(): Promise<boolean> {
  const endpoint = getSetting('ollama_endpoint') || 'http://localhost:11434'
  try {
    const res = await fetch(`${endpoint}/api/tags`)
    return res.ok
  } catch {
    return false
  }
}

export async function categorizeActivity(
  userNote: string,
  tasks: { id: number; title: string }[]
): Promise<{ category: string; taskId: number | null }> {
  const endpoint = getSetting('ollama_endpoint') || 'http://localhost:11434'
  const model = getSetting('ollama_model') || 'llama3.2:3b'

  // Build numbered task list for the prompt
  const taskOptions = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n')

  const prompt = `You categorize activities. Given a list of today's tasks and what the user is currently doing, respond with ONLY the number of the matching task. If it does not match any task, respond with 0.

Rules:
- Respond with ONLY a single number, nothing else.
- "editing youtube thumbnail" matches "YouTube video"
- "writing linkedin post" matches "LinkedIn post"
- "at the gym" matches "Gym"
- If the activity is related to a task even indirectly, match it.
- If unsure or no match, respond 0.

Tasks:
${taskOptions}

Activity: "${userNote}"

Number:`

  try {
    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0,
          num_predict: 5
        }
      })
    })

    if (!res.ok) {
      console.error('Ollama request failed:', res.status)
      return { category: 'uncategorized', taskId: null }
    }

    const data = (await res.json()) as OllamaResponse
    const rawResponse = data.response.trim()

    // Extract the first number from the response
    const match = rawResponse.match(/(\d+)/)
    if (!match) {
      return { category: 'uncategorized', taskId: null }
    }

    const taskNumber = parseInt(match[1], 10)

    // 0 means uncategorized
    if (taskNumber === 0 || taskNumber > tasks.length) {
      return { category: 'uncategorized', taskId: null }
    }

    // task numbers are 1-indexed
    const matchedTask = tasks[taskNumber - 1]
    return { category: matchedTask.title, taskId: matchedTask.id }
  } catch (err) {
    console.error('Ollama categorization failed:', err)
    return { category: 'uncategorized', taskId: null }
  }
}
