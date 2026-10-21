# IronOne Project Handoff & Session Transition Guide

> **Target Audience:** Incoming AI coding agents and human developers resuming development on any device.
> **Last Updated:** October 21, 2026 (v0.4.0: Introduction Walkthrough, Footer Branding & Version Milestone)

---

## 1. Project Overview & Architecture

**IronOne** is a mobile-first, high-density progressive overload workout logging SPA designed to run flawlessly on the gym floor over private networks (Tailscale) and home servers.

- **Backend:** Node.js (Express), Prisma ORM, SQLite with WAL mode (`ironone.db`).
- **Auth:** Argon2id password hashing, stateless JWT tokens stored in localStorage.
- **Frontend:** Vite, React 19, Tailwind CSS (gym-floor dark aesthetic: `slate-950` / `emerald-500`), Lucide React icons, `canvas-confetti`.
- **Hardware Integration:** Screen Wake Lock API (`client/src/utils/wakeLock.js`), Web Audio API tone synthesis, Native Haptics (`client/src/utils/audio.js`).
- **Offline / Resilience:** Optimistic UI with `localStorage` draft preservation (`client/src/utils/offlineSync.js`), network offline queue, and 3.5s multi-device heartbeat polling.

---

## 2. Current Implementation State

### Completed Phases & Sub-Phases:
- **Phase 1–4:** Core database architecture, Argon2id security hardening, master exercise taxonomy, routine template blueprints, and granular workout entries.
- **Phase 5:** Set management, order reindexing, and real-time exercise hot-swapping (`POST /api/workout-exercises/:id/swap`) with set retention or reset toggles.
- **Sub-Phase 6A (Frontend Foundation):** Responsive shell with sticky header, persistent in-progress workout ribbon, mobile bottom navigation dock, authentication flows, and profile settings with imperial/metric conversion.
- **Sub-Phase 6B (Routines & Catalog):** Exercise library browser with instant search and muscle group tags, custom exercise builder, routine blueprint manager with 1-tap duplication (`POST /api/routines/:id/copy`), and modal editor.
- **Sub-Phase 6C (Active Workout Logger & Gym Floor UX):**
  - Live logging page ([`ActiveWorkoutPage.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/pages/ActiveWorkoutPage.jsx)) with micro-steppers for load, reps, and minutes.
  - Modality-aware set rows (`WEIGHT_REPS`, `TIME_DURATION`, `DISTANCE_TIME`).
  - 1-tap set badge cycling (`NORMAL` -> `WARMUP` -> `DROP` -> `FAILURE`).
  - Floating Gym Rest Timer ([`RestTimer.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/components/RestTimer.jsx)) with preset buttons, auto-start on set completion, and auto-reset when logging subsequent sets.
  - Synchronous ref tracking (`workoutDetailsRef`) preventing asynchronous closure zero-reset bugs on steppers.
  - Strict numeric validation (`> 0` sets and reps) across routine templates.
  - High-visibility routine name validation with red focus rings, inline helper labels, and auto-scroll.
  - Multi-stage confetti celebration ([`confetti.js`](file:///home/travis/Documents/Projects/IronOne/client/src/utils/confetti.js)) and victory haptics upon finishing a workout session.
- **Sub-Phase 6D (Calendar View & Journal Feed):**
  - Interactive monthly calendar grid ([`HistoryPage.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/pages/HistoryPage.jsx)) with daily badges, multi-session indicators, and monthly aggregate cards.
  - Selected date details drawer with full exercise breakdown and sets.
  - Chronological journal stream with instant search, split category filter chips, and pagination.
  - 1-tap "Clone to Today" action (`POST /api/workout-entries/:id/clone`) replicating previous exercises and sets as uncompleted target baselines for progressive overload.
  - Client-local timezone boundary shifting preventing evening workout clipping across timezones.
  - Dashboard integration ([`DashboardPage.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/pages/DashboardPage.jsx)) displaying recent session summaries and quick navigation.
- **Sub-Phase 6E (UX Refinement, Modality Distinction & Catalog Synchronization):**
  - Desktop horizontal navigation chevrons and mouse wheel scrolling translation (`onWheel`) across all chip sets (routine editor picker, live workout picker, swap modal, catalog categories/modalities, and history split filters).
  - Explicit modality taxonomy: `WEIGHT_REPS` (Weight × Reps, Emerald), `TIME_DURATION` (Time Duration Holds, Sky), and `DISTANCE_TIME` (Distance & Time Cardio, Amber).
  - Target value clarification across routine editor forms ("Target Hold / Duration *" vs "Target Distance & Pace *").
  - Live workout table headers distinguishing hold durations from cardio distance and pace.
  - Custom exercise modal equipped with descriptive cards detailing tracked metrics.
  - Idempotent, non-destructive catalog sync script (`server/seeds/seed.js` via `npm run db:seed`) expanding master movements to 74 standard exercises without dropping tables or altering user data.
- **Sub-Phase 6F (Onboarding Tour & Ergonomics):**
  - Interactive multi-slide onboarding walkthrough modal ([`OnboardingModal.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/components/OnboardingModal.jsx)) automatically welcoming new users and replayable anytime from the Dashboard and Profile pages.
  - Routine blueprint editor input ergonomics: enlarged tactile touch targets (~40px) with centered bold monospace typography while strictly preserving layout density.
  - Global application version and copyright notice footer across all authenticated screens and authentication gateways.

---

## 3. Next Milestone: Phase 7 (Development Burn-In & Multi-Device Testing)

The project has entered **Phase 7 (Development Burn-In & Field Testing)**:
1. **Development Run (1–2 Weeks):**
   - The user will run IronOne directly via `npm start` / `npm run dev` to test gym floor ergonomics, multi-device polling, and progressive overload tracking during live training.
   - **NO systemd service file:** Daemonization is deferred until after this burn-in period. Do NOT re-introduce any hardcoded service files.
2. **Automated SQLite Online Backups:**
   - Portable, zero-external-dependency automated backup tool (`npm run db:backup` / `scripts/backup.sh` via `scripts/backup.js`) with non-blocking WAL snapshotting, size verification, and 14-day rotation.
3. **Multi-Device & Network Verification:**
   - Verify live session syncing between mobile (gym floor) and desktop (home review) over Tailscale.

---

## 4. Key Files Reference

| File | Purpose |
| :--- | :--- |
| [`client/src/pages/ActiveWorkoutPage.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/pages/ActiveWorkoutPage.jsx) | Live gym floor workout logger, set adjustments, hot-swap, and completion |
| [`client/src/pages/RoutinesPage.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/pages/RoutinesPage.jsx) | Routine blueprint templates manager, modal builder, and 1-tap launcher |
| [`client/src/components/RestTimer.jsx`](file:///home/travis/Documents/Projects/IronOne/client/src/components/RestTimer.jsx) | Floating draggable/dockable rest timer with audio chime and presets |
| [`client/src/utils/confetti.js`](file:///home/travis/Documents/Projects/IronOne/client/src/utils/confetti.js) | `canvas-confetti` celebration cannons and victory haptics |
| [`client/src/utils/audio.js`](file:///home/travis/Documents/Projects/IronOne/client/src/utils/audio.js) | Web Audio synthesized chimes and mobile vibration triggers |
| [`client/src/utils/wakeLock.js`](file:///home/travis/Documents/Projects/IronOne/client/src/utils/wakeLock.js) | Screen Wake Lock API wrapper to prevent screen sleep during sessions |
| [`client/src/utils/offlineSync.js`](file:///home/travis/Documents/Projects/IronOne/client/src/utils/offlineSync.js) | Draft caching and offline queue management |
| [`server/controllers/workoutController.js`](file:///home/travis/Documents/Projects/IronOne/server/controllers/workoutController.js) | Workout entry lifecycle, routine deployment, and session completion |
| [`server/controllers/routineController.js`](file:///home/travis/Documents/Projects/IronOne/server/controllers/routineController.js) | Routine CRUD, cloning, and exercise ordering |
| [`agents/PLAN.md`](file:///home/travis/Documents/Projects/IronOne/agents/PLAN.md) | Master development roadmap and domain entity definitions |
| [`agents/CONVENTIONS.md`](file:///home/travis/Documents/Projects/IronOne/agents/CONVENTIONS.md) | Code styling, commenting, and architectural guidelines |

---

## 5. Development Environment & Testing Cheat Sheet

### Environment Setup
- **Node.js:** Ensure Node v20+ or v25 (e.g. `export PATH="/home/travis/.nvm/versions/node/v25.4.0/bin:$PATH"`).
- **Install Dependencies:**
  ```bash
  npm install
  npm --prefix client install
  ```
- **Build Client Bundle:**
  ```bash
  npm run build
  ```
- **Start Backend Server:**
  ```bash
  npm start
  # or node server/server.js
  ```

### Running Test Suites
When testing in sandbox or development environments, pass `PORT=3005` to avoid port collisions with any background server on port 3000:
```bash
# Verify Sub-Phase 6C active logger & hot-swap
PORT=3005 node <scratch_dir>/test_subphase_6c.js

# Verify Sub-Phase 6C feedback fixes (routine validation, sets persistence)
PORT=3005 node <scratch_dir>/test_feedback_fixes.js
```

---

## 6. Strict Conventions & Architectural Rules
- **Formatting:** 4-space indentation across all code and JSX; double quotes (`"..."`) for strings and attributes.
- **Comments:** Telegraphic style leading with imperative verbs, capital initial letter, and no terminal period (e.g., `// Update set metrics`).
- **Pre-increment:** Always use pre-increment (`++i`) in loops.
- **Privacy:** Never disclose, print, or log credentials from `.env`.

