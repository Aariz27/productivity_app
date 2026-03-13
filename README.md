# Productivity Tracker App

A desktop productivity tracking application built with **Electron**, **React**, **TypeScript**, and local AI (**Ollama**). This app helps you plan your day, tracks your time, takes automated screenshots to log your work, and uses local AI to categorize what you are doing—all while keeping your data 100% private and on your machine.

---

## 🚀 Quick Start Guide (No Coding Experience Needed!)

If you just want to download this app and use it, follow these simple steps:

### 1. Install Prerequisites
Before you begin, you need to install two free programs on your computer:
* **Node.js**: This is required to run the app. Go to [nodejs.org](https://nodejs.org/) and download the "LTS" (Long Term Support) version and install it.
* **Ollama (Optional but highly recommended)**: This powers the local AI that categorizes your screenshots without sending your data to the cloud. Download it from [ollama.com](https://ollama.com/) and install it. 
  * Once installed, open your terminal (Mac) or command prompt (Windows) and run `ollama run llama3.2` to download the AI model. *Note: this step might take a few minutes as the model is large.*

### 2. Download the App
1. Click the green **"Code"** button at the top right of this page.
2. Click **"Download ZIP"**.
3. Extract the downloaded ZIP file to a folder on your computer (e.g., your Desktop).

### 3. Run the App
1. Open your computer's **Terminal** (Mac) or **Command Prompt** / **PowerShell** (Windows).
2. Type `cd ` (make sure there is a space after `cd`) and then **drag and drop** the extracted folder into the terminal window. Press Enter.
3. Install the required dependencies behind the scenes by typing this command and pressing Enter:
   ```bash
   npm install
   ```
4. Start the app by typing this command and pressing Enter:
   ```bash
   npm run dev
   ```
The app will open up, and you can start tracking your productivity!

---

## 🏗️ Project Architecture & Deep Dive

This app is built using **Electron**, which means it has two main parts that talk to each other:
1. **The Main Process (Backend)**: Runs in the background, handles the database, takes screenshots, talks to the AI, and manages the system tray.
2. **The Renderer Process (Frontend)**: The visual user interface built with React that you interact with.

### Folder Structure

```text
├── src/
│   ├── main/           # The Backend (Electron Main Process)
│   ├── preload/        # The Bridge (Translates between Backend and Frontend)
│   └── renderer/       # The Frontend (React UI)
```

### Deep Dive: How the Files Relate to Each Other

#### 1. The Backend (`src/main/`)
This folder controls the core logic of the desktop app. It handles everything that requires access to your computer's system (like saving files or taking screenshots).
* **`index.ts`**: The brain of the operation. It starts the app, creates the windows (main dashboard and check-in popups), sets up the system tray icon, and listens for events to trigger screenshots or notifications.
* **`database.ts`**: Manages the local SQLite database. It saves your settings, daily plans, tasks, work sessions, and the path to your screenshots. Your data never leaves your computer.
* **`screenshot.ts`**: Takes pictures of your screen. To bypass permission bugs in macOS, it uses the native `screencapture` tool to snap an image and save it securely to your local drive.
* **`ipc-handlers.ts`**: The "post office" of the backend. When the React frontend needs data (like "give me today's timeline" or "save this setting"), it sends a message here. This file processes the request, gets data from the database, and sends it back.
* **`scheduler.ts`**: Acts as an internal clock. It runs in the background to check if it's time for a scheduled work session, a check-in popup, or if your session has exceeded its maximum duration.
* **`ollama.ts`**: Communicates with your local AI (Ollama) to look at your screenshot and your note, and automatically categorize what task you are working on.

#### 2. The Bridge (`src/preload/index.ts`)
For security reasons, the Frontend (React) isn't allowed to directly access your computer's files or database. The `preload/index.ts` file acts as a secure bridge. It defines a specific set of commands (like `window.api.getTodayPlan()`) that the frontend is allowed to use to talk to the Backend's `ipc-handlers.ts`.

#### 3. The Frontend (`src/renderer/src/`)
This is the visual part of the app built with React. It's what you see when you open the app.
* **`App.tsx`**: The main container that loads the sidebar layout and decides which page to show (Today, Session, Timeline, Plan Tomorrow, Settings).
* **`components/Timeline.tsx`**: The most complex visual component. It fetches your check-ins, tasks, and inactivity periods, calculates the exact time spent on each task chronologically, and renders the visual timeline with your screenshots.
* **`components/SessionControls.tsx`**: The dashboard you see when a session is active. It shows the running timer and handles starting/ending your focus sessions.
* **`styles/global.css`**: Contains all the styling rules that make the app look modern, dark, and beautiful. It manages everything from scrolling areas to the custom colors for different tasks.

### The Data Flow (Example: Taking a check-in)
To understand how these files work together, let's look at what happens when you start a session:
1. You click "Start Session" in **`SessionControls.tsx`** (Frontend).
2. It calls `window.api.startSession()` via the secure bridge (**`preload/index.ts`**).
3. The bridge sends a message to **`ipc-handlers.ts`** (Backend).
4. The backend tells **`index.ts`** to trigger an immediate check-in.
5. **`screenshot.ts`** snaps your screen using a native terminal command and saves the JPEG to your hard drive.
6. A new popup window (`CheckInPopup.tsx`) opens showing the screenshot. You type a note and click save.
7. **`ollama.ts`** analyzes the image and your note to automatically categorize the task.
8. **`database.ts`** saves the exact timestamp, screenshot file path, note, and AI category to your local database.
9. When you open the Timeline page, **`Timeline.tsx`** requests this data and dynamically calculates how many minutes passed between this event and the next one to accurately chart your productivity!
