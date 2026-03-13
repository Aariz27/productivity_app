# Productivity Tracker App

## What This Project Is

A desktop app (macOS) that helps the user see where their time actually goes. It captures periodic screenshots during work sessions, prompts the user to note what they're doing, uses local AI to categorize that activity against daily tasks, and presents an end-of-day timeline for self-reflection.

The core philosophy: **log, don't lecture.** The app never judges, advises, or nags. It acts as an honest mirror — showing exactly where time went so the user can decide for themselves what to change.

## The Problem It Solves

The user has a packed daily schedule (content creation, university, client work, gym) but time disappears without them realizing it. They fall into rabbit holes — checking analytics, exploring ideas, socializing — and by the time they look up, hours are gone and critical tasks are untouched. They tried manual tracking in Notion but it requires too much discipline and doesn't capture what actually happened in real time.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop shell | **Electron** | Screenshots via `desktopCapturer`, native notifications, system tray, background processes. Fastest path for a desktop app with web UI. |
| Frontend UI | **React** (with TypeScript) | Timeline, task list, planning screen. Bundled via Vite or Webpack inside Electron. |
| Database | **SQLite** (via `better-sqlite3`) | Local storage for tasks, check-ins, sessions, settings. Single file, no server needed. |
| AI categorization | **Ollama** (local) | Runs at `http://localhost:11434`. Uses a small model like `llama3.2:3b` or `mistral`. HTTP requests from Electron main process. No API keys, no cost, fully offline. |
| Screenshot storage | **Local filesystem** | Screenshots saved as PNG/JPEG in an app data directory. Paths stored in SQLite. Not embedded in the database to keep it lightweight. |

## Architecture Overview

Electron has two processes:

- **Main process** (Node.js): Handles screenshot capture, scheduling/timers, Ollama API calls, SQLite operations, system tray, notifications. This is the "backend."
- **Renderer process** (React): The UI the user interacts with. Communicates with main process via Electron IPC.

```
┌─────────────────────────────────────────────────┐
│                   Electron App                   │
│                                                  │
│  ┌──────────────────┐  IPC  ┌─────────────────┐ │
│  │   Main Process   │◄────►│ Renderer (React) │ │
│  │                  │       │                  │ │
│  │ - Screenshot     │       │ - Planning UI    │ │
│  │   capture        │       │ - Task list      │ │
│  │ - Timers/cron    │       │ - Check-in popup │ │
│  │ - Ollama client  │       │ - Timeline view  │ │
│  │ - SQLite queries │       │ - Settings       │ │
│  │ - Notifications  │       │                  │ │
│  │ - System tray    │       │                  │ │
│  └──────┬───────────┘       └─────────────────┘ │
│         │                                        │
│         ▼                                        │
│  ┌──────────────┐  ┌──────────────┐             │
│  │   SQLite DB  │  │  Screenshots │             │
│  │  (metadata)  │  │  (filesystem)│             │
│  └──────────────┘  └──────────────┘             │
│         │                                        │
│         ▼                                        │
│  ┌──────────────┐                                │
│  │   Ollama     │  (localhost:11434)             │
│  │  (local AI)  │                                │
│  └──────────────┘                                │
└─────────────────────────────────────────────────┘
```

## Core Features (in priority order)

### 1. Evening Planning

Triggered by a notification at a user-configured time (e.g., 9pm, 10pm — set in app settings). The notification repeats at a configurable interval until the user opens the app and completes planning.

**The planning screen:**
- 3 non-negotiable tasks are pre-filled every day and cannot be removed:
  1. Gym
  2. One YouTube video
  3. One LinkedIn post
- Up to 3 additional tasks can be added by the user (university work, client projects, etc.)
- Maximum 6 tasks per day. This is a hard cap. The constraint is intentional.
- For each task, the user can optionally set a scheduled time block (e.g., "9am-11am: Film YouTube video")
- The user can also define work session start times (see feature 2)

**Data stored:** `daily_plans` table with date, tasks (JSON array), session schedule, created_at timestamp.

### 2. Work Sessions

Work sessions are time blocks during which the app actively monitors via screenshots and check-ins.

**How sessions start:**
- During evening planning, the user sets session start times for the next day (e.g., "9:00 AM", "1:00 PM", "4:00 PM")
- At the scheduled time, a notification fires and **repeats at a configurable interval** until the user either:
  - Clicks "Start Session" (opens app, begins monitoring)
  - Clicks "Dismiss" (logs that the session was skipped, with timestamp)
- The user can also manually start a session at any time from the app or system tray

**How sessions end:**
- The user manually ends the session from the app or system tray
- Or a session auto-ends at a configurable maximum duration

**Data stored:** `sessions` table with start_time, end_time, status (active/completed/skipped/dismissed), planned_start_time.

### 3. Periodic Check-ins (During Active Sessions)

This is the heart of the app. During an active work session:

1. Every N minutes (default: 60, configurable in settings), the app:
   - Captures a screenshot using Electron's `desktopCapturer`
   - Saves it to the local filesystem
   - Shows a **popup window** (always on top) with:
     - The screenshot as a thumbnail/preview
     - A text input: "What are you working on?"
     - A submit button
2. The user types a brief note (e.g., "editing YouTube thumbnail", "researching SEGP report samples")
3. On submit, the app sends the user's note + today's task list to **Ollama**
4. Ollama categorizes the activity:
   - If it matches a task → logs it under that task
   - If it doesn't match any task → logs it as "uncategorized" with no comment or judgment
5. The popup closes and the user continues working

**Important behavioral rules:**
- The popup should not be dismissable without entering something (even "nothing" is fine, but they must interact)
- The popup should be visually minimal and fast to dismiss — this must not feel like a chore
- If the user is mid-flow, this should take <10 seconds to handle

**Ollama prompt strategy:**
```
You are a task categorizer. Given a user's description of what they are doing
and their task list for today, determine which task (if any) the activity
belongs to. Respond with ONLY the task name exactly as written, or "uncategorized"
if it doesn't clearly fit any task. Do not explain, judge, or advise.

Today's tasks:
1. Gym
2. YouTube video
3. LinkedIn post
4. SEGP report
5. Lean review
6. Client work - Faris Automation

User says: "editing my youtube thumbnail in canva"

Category:
```

**Data stored:** `check_ins` table with session_id, timestamp, screenshot_path, user_note, ai_category, task_id (nullable FK).

### 4. Task Completion Tracking

The app has a built-in todo list (the tasks from evening planning). The user can mark tasks as complete directly in the app.

**Behavior:**
- When a task is marked complete, the exact timestamp is recorded
- Based on check-in responses, Ollama can also **predictively ask** if a task is done. For example, if the user's last 2 check-ins were categorized under "YouTube video" and they then say "starting on SEGP report," the app can show a small non-intrusive prompt: "Did you finish the YouTube video?" (Yes/No)
- This prediction is a nice-to-have, not a launch blocker

**Data stored:** Updated in `tasks` table — completed_at timestamp, or in a `task_completions` table.

### 5. Inactivity Detection

If the app detects no laptop activity (no mouse/keyboard input) for a configurable period during an active session:

- A notification appears: "You've been away for a while. What were you doing?"
- The user responds with a brief note (e.g., "lunch", "went for a walk", "got distracted talking to friends")
- The response is logged with timestamps. No judgment, no advice.

**Important:** This is NOT surveillance. It only activates during work sessions the user explicitly started. The purpose is to fill gaps in the timeline so the end-of-day review is complete.

**Data stored:** `inactivity_logs` table with session_id, detected_at, returned_at, user_note.

### 6. End-of-Day Timeline Review

A scrollable, visual timeline of the entire day. This is the payoff — the moment the user sees exactly where their time went.

**Timeline entries show:**
- Timestamp
- Screenshot thumbnail (expandable to full size on click)
- User's note from the check-in
- AI-categorized task (with a colored tag/badge matching the task)
- Task completion markers (when a task was marked done)
- Inactivity gaps with the user's explanation

**Additional summary at the top:**
- Time spent per task (based on check-in categories)
- Tasks completed vs. not completed
- Total active session time vs. total day
- Uncategorized time (how much time went to things not on the list)

**This view should feel like scrolling through a story of your day.** Not a spreadsheet, not a chart — a narrative timeline.

### 7. Settings

All configurable values in one place:

| Setting | Default | Description |
|---------|---------|-------------|
| Evening planning time | 21:00 | When the planning notification fires |
| Check-in interval | 60 min | How often screenshots + prompts happen during sessions |
| Notification repeat interval | 5 min | How often reminders repeat until acknowledged |
| Inactivity threshold | 30 min | How long before inactivity prompt triggers |
| Max session duration | 4 hours | Auto-end session after this long |
| Screenshot quality | Medium | JPEG quality to balance storage vs. clarity |
| Screenshot storage path | App default | Where screenshots are saved on disk |
| Ollama model | llama3.2:3b | Which local model to use for categorization |
| Ollama endpoint | localhost:11434 | In case the user runs Ollama on a different port |

## Database Schema (SQLite)

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE daily_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES daily_plans(id),
  title TEXT NOT NULL,
  is_non_negotiable INTEGER NOT NULL DEFAULT 0,  -- 1 for gym/youtube/linkedin
  display_order INTEGER NOT NULL,
  scheduled_start TEXT,  -- optional time block
  scheduled_end TEXT,
  completed_at TEXT,  -- NULL if not yet completed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER REFERENCES daily_plans(id),
  planned_start TEXT,  -- when it was supposed to start
  actual_start TEXT,   -- when user actually clicked start
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending/active/completed/skipped
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  screenshot_path TEXT NOT NULL,
  user_note TEXT,
  ai_category TEXT,  -- the task title or "uncategorized"
  task_id INTEGER REFERENCES tasks(id),  -- NULL if uncategorized
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE inactivity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  detected_at TEXT NOT NULL,
  returned_at TEXT,
  user_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## File Structure (Target)

```
productivity_app/
├── CLAUDE.md                  # This file
├── package.json
├── electron.vite.config.ts    # Or webpack — Vite preferred for speed
├── tsconfig.json
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App entry, window creation, tray setup
│   │   ├── screenshot.ts      # Screenshot capture logic
│   │   ├── scheduler.ts       # Timers for check-ins, session reminders
│   │   ├── ollama.ts          # Ollama API client
│   │   ├── database.ts        # SQLite connection and queries
│   │   ├── notifications.ts   # System notification helpers
│   │   ├── inactivity.ts      # Mouse/keyboard idle detection
│   │   └── ipc-handlers.ts    # IPC channel handlers
│   ├── renderer/              # React app (renderer process)
│   │   ├── index.html
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Root component, routing
│   │   ├── components/
│   │   │   ├── PlanningScreen.tsx    # Evening planning UI
│   │   │   ├── TaskList.tsx          # Today's task list with checkboxes
│   │   │   ├── CheckInPopup.tsx      # Screenshot + "what are you doing?" popup
│   │   │   ├── Timeline.tsx          # End-of-day scrollable timeline
│   │   │   ├── TimelineSummary.tsx   # Stats at top of timeline
│   │   │   ├── SessionControls.tsx   # Start/stop session, status indicator
│   │   │   ├── Settings.tsx          # Settings page
│   │   │   └── SystemTray.tsx        # Tray menu component (if needed)
│   │   ├── hooks/
│   │   │   ├── useIPC.ts            # Hook for Electron IPC communication
│   │   │   ├── useTasks.ts          # Task state management
│   │   │   └── useSession.ts        # Session state management
│   │   ├── styles/
│   │   │   └── global.css           # Tailwind or plain CSS
│   │   └── lib/
│   │       ├── types.ts             # Shared TypeScript types
│   │       └── utils.ts             # Date formatting, helpers
│   └── preload/
│       └── index.ts           # Electron preload script (secure IPC bridge)
├── resources/                 # App icons, tray icons
└── data/                      # Default screenshot storage location (gitignored)
```

## Design Principles

1. **Non-judgmental.** The app logs. It does not lecture, advise, suggest, motivate, or guilt-trip. No "you spent too much time on X!" messages. No productivity scores. No streaks. Just data.

2. **Minimal friction.** Every interaction should take <10 seconds. The check-in popup should be type-and-go. Planning should be fast because 3 tasks are pre-filled.

3. **Honest mirror.** The timeline shows exactly what happened, including the uncomfortable parts. Uncategorized time is shown plainly, not hidden or minimized.

4. **Privacy-first.** Everything is local. Screenshots never leave the machine. Ollama runs locally. No cloud, no telemetry, no accounts.

5. **Battery/resource conscious.** Screenshots are periodic (not continuous recording). Ollama is called only at check-in time, not continuously. The app should be lightweight in the background.

## Important Implementation Notes

### Ollama Integration
- The app should gracefully handle Ollama not running. Show a clear message: "Ollama is not running. Start it to enable AI categorization." The app should still work without it — just skip the AI categorization and let the user manually pick a task category from a dropdown.
- Use the `/api/generate` endpoint with `stream: false` for simple request/response.
- Keep prompts minimal. The categorization prompt should be <200 tokens input. Response should be 1-5 tokens.

### Screenshot Capture
- Use Electron's `desktopCapturer.getSources({ types: ['screen'] })` to capture the full screen.
- Save as JPEG with configurable quality (default 80%) to manage storage.
- Store in a date-organized folder structure: `data/screenshots/YYYY-MM-DD/checkin-HHmmss.jpg`

### Notifications on macOS
- Use Electron's `Notification` API.
- For repeated reminders, use `setInterval` to fire notifications every N minutes until acknowledged.
- When the user clicks the notification, it should bring the app to the foreground with the relevant screen (planning, session start, etc.)

### Check-In Popup
- This should be a separate `BrowserWindow` with `alwaysOnTop: true`, not a notification.
- It should be a small, focused window — not full-screen.
- Show the screenshot as a preview, text input below it, submit button.
- After submit, the window closes automatically.

### System Tray
- The app should live in the macOS menu bar when not actively being used.
- Tray menu options: "Start Session", "End Session", "Open App", "Today's Progress", "Quit"
- Show a subtle indicator of whether a session is active (e.g., different tray icon color)

## What This App Is NOT

- It is NOT a Pomodoro timer
- It is NOT a habit tracker
- It is NOT a calendar or scheduling app
- It is NOT a screen time monitor (it only captures at intervals, not continuously)
- It is NOT a productivity coach — it does not give advice
- It does NOT sync to the cloud
- It does NOT have accounts, logins, or social features

## Future Enhancements (Not for V1)

These were mentioned by the user as future additions once the core loop is solid:
- **Storage management**: Auto-cleanup of screenshots older than X days, aggressive JPEG compression, configurable retention policy, Google Drive offload (user has 2TB plan) to push older screenshots to cloud and delete local copies
- Reading tracking
- Intellectual sharpness drills
- Mandarin learning integration
- Weekly/monthly trend analysis
- Multiple task list templates for different day types
