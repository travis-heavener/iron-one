# Agent Instructions & Operational Guidelines

> **Notice:** This document is strictly for AI agents operating on the `IronOne` codebase. It establishes operational boundaries, project scope, security constraints, and execution standards.

---

## 1. Absolute Directives & Security Guardrails

1. **Environment Secrets Protection**: 
   - **NEVER** read, display, log, or ask the user to read or share `.env` files or any secret configuration files.
   - When environment variables are needed, define and reference them via `.env.example` with sanitized placeholder values.
2. **Non-Destructive Operations**:
   - Never run destructive commands (e.g., `rm -rf`, dropping production database tables) without explicit instruction.
   - Prefer non-breaking schema migrations and additive updates.
3. **Autonomous Verification**:
   - Do not ask for user confirmation for routine steps, standard commands, or bug diagnosis. Proactively run tests, build checks, and verify your own work.

---

## 2. Code Styling, Conventions & Behavior

> [!IMPORTANT]
> **Always refer to [`CONVENTIONS.md`](./CONVENTIONS.md) before writing or modifying any code in this repository.**

All code contributions must strictly adhere to the project standards defined in [`CONVENTIONS.md`](./CONVENTIONS.md), including:

- **Commenting**:
  - Start every comment with an uppercase letter and omit terminal periods on single-line comments.
  - Omit grammatical articles (*a*, *an*, *the*) for telegraphic phrasing (`// Bind socket`, `// Verify token`).
  - Lead with imperative action verbs. Use approved shorthand (`w/`, `opts`, `ptr`, `len`, `val`).
  - Prefix utility function headers with `// Used to <action>`.
- **Formatting & Layout**:
  - **4-space indentation** across all languages (JS, CSS, HTML, Shell).
  - 1TBS / K&R brace placement (opening braces on same line).
  - Use double quotes (`"..."`) consistently for strings and keys.
  - Surround binary operators with single spaces (`val + 1`).
- **Imports & Organization**:
  - Group imports in standard order separated by blank lines: (1) External packages, (2) Parent/cross-module, (3) Local directory files.
  - Alphabetize module paths and named exports within import groups.
- **Naming & Idioms**:
  - `camelCase` for variables and functions; `PascalCase` for React components, classes, and types.
  - Default to pre-increment/pre-decrement (`++i`, `--count`) in loops and standalone statements.
  - Use single-line guard clauses for early exits (`if (!user) return;`).

---

## 3. Project Scope & Architecture Boundaries

### 3.1 Defined In-Scope Deliverables
The agent must focus exclusively on the core mission: building a fast, reliable, self-hosted workout tracking SPA for the user moving away from Samsung Notes.

- **Authentication & User Profile**:
  - Single-string unique `username` (no full name required).
  - Securely hashed passwords using **Argon2id** (OWASP recommended memory-hard hashing).
  - Profile picture (PFP) upload via `multer`, stored locally and served statically.
  - Optional body metrics (`weight`, `height`) with unit toggles (lbs/kg, in/cm).
- **Master Exercise Library**:
  - Seeded standard exercise list categorized by target muscle group, equipment, and modality (weight/reps, time/duration, distance/time).
  - User ability to add, edit, and search custom exercises.
- **Workout Routines & Journal Entries Engine**:
  - **Workout Routines (Templates)**: Reusable split templates that can be created, copied, and edited.
  - **Workout Entries (Logs)**: Daily session logs; multiple entries per day permitted. Can originate from a routine, cloned from a past entry, or logged ad-hoc (freeform) without a routine template.
  - Multi-modal set tracking:
    - Lifts: Independent weight & reps per set, optional RPE/RIR, set type (warmup, normal, drop).
    - Time: Timed holds / isometric exercises (e.g. 60s plank), with optional added load.
    - Distance: Cardio / endurance (distance, duration, pace).
  - **Exercise Swapping**: Replace an exercise in an active or past workout seamlessly.
  - **Dual Views**: Chronological journal feed + interactive calendar view showing workouts by date.
- **Mobile-First, Tactile SPA**:
  - Minimal friction design for the gym (large thumb-friendly tap targets, quick +5lb/+2.5lb/+1 rep chips, 1-tap set completion checkmarks, rest timer).
  - Responsive desktop layout for at-home planning and log reviews.
- **Tailscale & Self-Hosting Integration**:
  - Bound to local network / Tailscale IP (`100.x.y.z`) or `0.0.0.0` on the home Ubuntu 26 server.
  - Configuration for `systemd` or `pm2` background service management.

### 3.2 Explicitly Out-of-Scope (Anti-Creep Rules)
Do **NOT** add the following features during MVP unless explicitly instructed by the user:
- No third-party OAuth integrations (Google, Apple, GitHub logins). Keep authentication local and self-contained.
- No social networks, community feeds, or leaderboards during initial phases (these are documented in the Post-MVP Roadmap Phase 8 and must not distract from the core single-user tracking UX).
- No heavy third-party SaaS analytics or telemetry trackers.
- No microservice architecture or distributed queues. Keep the backend in a clean, unified Express monolith.

---

## 4. Technical Decision Rules

1. **Database & ORM**:
   - Default to **SQLite with Prisma ORM** (or Drizzle) for local durability, zero external service dependencies, and effortless backups on Ubuntu.
   - Always ensure database foreign keys have appropriate cascade delete policies (e.g., deleting a workout removes its associated exercise join records and sets).
2. **File Storage**:
   - User avatars must be stored in a dedicated `uploads/avatars/` directory on the server.
   - Enforce MIME type validation (JPEG, PNG, WebP) and file size limits (e.g., 5MB max).
3. **API Contract**:
   - Follow clean REST conventions under `/api/`.
   - Always return consistent JSON response envelopes:
     - Success: `{ "success": true, "data": ... }`
     - Error: `{ "success": false, "error": { "message": "...", "code": "..." } }`
   - Use proper HTTP status codes (200, 201, 400, 401, 403, 404, 500).

---

## 5. Execution Workflow for Agents

When implementing tasks in this repository, follow this sequence:

```
┌─────────────────────────────────┐
│ 1. Read PLAN.md & REQUIREMENTS  │  Understand target feature and architecture
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ 2. Consult CONVENTIONS.md       │  Align syntax, comment style, formatting, imports
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ 3. Implement Incrementally      │  Write minimal, high-signal, production-ready code
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ 4. Verify & Test                │  Run tests, test endpoints, verify builds
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│ 5. Report Concisely             │  Provide file links and brief summary
└─────────────────────────────────┘
```

1. **Plan First**: Before starting any phase, review [`PLAN.md`](./PLAN.md) and [`REQUIREMENTS.md`](./REQUIREMENTS.md).
2. **Zero Stubs Policy**: Implement complete, functional code. Never leave stubbed comments (`/* STUB */` or `// implement later`) on critical functional paths.
3. **Test Before Complete**: Run build scripts (`npm run build`), verify server startup, and execute endpoint checks before declaring a phase complete.
4. **Communicate Clearly**: Keep user explanations concise and technical, using relative paths for repository documentation.
