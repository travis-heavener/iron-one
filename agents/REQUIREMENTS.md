# Project Requirements: IronOne Workout Tracker

## 1. Executive Summary & Problem Statement
For over three years, workout tracking has been managed using Samsung Notes. While flexible, unstructured notes make progressive overload analysis, workout history comparison, and structured exercise logging tedious and manual. 

**IronOne** is a self-hosted, mobile-responsive Single Page Application (SPA) backed by Node.js and Express. It runs on an Ubuntu 26 home server located in Virginia, securely accessible remotely (e.g., from gym/mobile devices in New York) over a **Tailscale** private network.

---

## 2. Infrastructure & Deployment Environment
- **Server**: Ubuntu 26 LTS (Home Server in Virginia).
- **Client**: Web browser (Desktop / Mobile / Tablet in New York or on the go).
- **Networking**: Tailscale mesh VPN (private access via Tailscale IP or MagicDNS, bypassing public port forwarding).
- **Runtime**: Node.js (v20+ LTS recommended) & Express.js.
- **Port/Service**: Dedicated local port (e.g., `3000` or `5000`), managed via `systemd` or `pm2`.

---

## 3. Functional Requirements

### 3.1 Authentication & User Management
- **FR-AUTH-1: Account Registration**
  - Users can register with a unique `username` and `password`.
  - Passwords must be hashed using **Argon2id** (the state-of-the-art, memory-hard hashing algorithm recommended by OWASP for superior resistance against GPU/ASIC cracking) before storage.
- **FR-AUTH-2: Authentication & Session**
  - Secure login returning a token (JWT) or HTTP-only session cookie.
  - Protected API routes requiring a valid session/token.
- **FR-AUTH-3: User Profile**
  - **Username**: Single string identifier (display and login name).
  - **Profile Picture (PFP)**: Image upload capability (JPEG/PNG/WebP), stored on disk with path referenced in user record, or served statically.
  - **Height**: Optional numeric field with unit support (e.g., cm or in).
  - **Weight**: Optional numeric field with unit support (e.g., kg or lbs), with timestamped history capability to track changes over time.

### 3.2 Exercise Library (Master Table)
- **FR-EX-1: Master Exercise Catalog**
  - Curated list of standard exercises categorized by target muscle group (Chest, Back, Legs, Shoulders, Arms, Core) and equipment (Barbell, Dumbbell, Cable, Machine, Bodyweight).
- **FR-EX-2: Custom Exercise Creation**
  - Users can add custom exercises (name, muscle group, equipment, description/notes).
- **FR-EX-3: Exercise Lookup & Search**
  - Fast search and filter by name, target muscle, and equipment.

### 3.3 Workout Routines (Templates) vs. Workout Entries (Journal Logs)

A core design principle of IronOne is the explicit distinction between reusable workout blueprints (**Routines**) and individual logged sessions (**Entries**):

- **FR-ROUTINE-1: Workout Routines (Templates)**
  - Reusable workout templates (e.g., "Push Day A", "Upper Hypertrophy", "5k & Core").
  - Defines an ordered list of exercises, target modalities, default sets, and target rep/weight ranges.
  - **Routine Copying**: Users can copy an existing routine to use as a starting point for variations (e.g., duplicate "Push Day A" to create "Push Day B" and swap exercises).
  - Editing a routine never alters historical workout entries previously completed under that routine.

- **FR-ENTRY-1: Workout Entries (Daily Journal Logs)**
  - Represents an actual workout performed at a specific date and time.
  - **Multiple Entries Per Day**: Users can log multiple distinct workout entries on the same calendar day (e.g., Entry 1: Morning 2-mile run; Entry 2: Evening Push workout).
  - **Flexible Entry Initiation**:
    1. *From Routine*: Select a saved Routine template to pre-populate exercises and target sets.
    2. *From Previous Entry (Cloning)*: Clone any past workout entry to a new day to immediately carry over last-logged weights and reps for progressive overload.
    3. *Ad-Hoc (Freeform)*: Log a spontaneous session from scratch without selecting or creating a routine (no routine primary key or template association required).
  - **Entry Lifecycle**: Supports active `in_progress` state (live tracking at the gym) and `completed` state (archived with end timestamp and summary metrics).

- **FR-LOG-2: Multi-Modal Exercise Tracking**
  Workout entries support exercises spanning three distinct tracking modalities:
  1. **Weight & Reps (Lifts)**:
     - Log sets with independent weights and reps per set (e.g., Set 1: 135 lbs × 10 reps, Set 2: 155 lbs × 8 reps, Set 3: 175 lbs × 6 reps).
     - Set categorization: Warmup, Working, Drop set, Failure.
     - Optional RPE (Rate of Perceived Exertion) or RIR (Reps in Reserve).
  2. **Time / Duration (Holds & Isometric Work)**:
     - Log sets with target/completed duration in seconds (e.g., 60-second plank, 45-second hollow body hold, wall sits).
     - Optional added weight (e.g., +25 lbs weighted plank).
  3. **Distance & Cardio**:
     - Log activities with distance (miles, km) and elapsed time (e.g., 2.0 miles in 16 min 30 sec, 2000m row).
     - Automatic pace calculation where applicable.

- **FR-LOG-3: In-Session Granular Updates**
  - Real-time inline updating of individual sets, weights, reps, and durations.
  - 1-tap set completion checkmark to minimize friction during workouts.

- **FR-LOG-4: Exercise Swapping**
  - Ability to swap out an exercise on the fly in an existing workout entry (e.g., replace "Barbell Bench Press" with "Dumbbell Incline Bench Press").
  - Option to retain existing set counts/notes or initialize clean sets.

- **FR-LOG-5: Dual Views: Journal Feed & Calendar View**
  - **Calendar View**: Visual monthly/weekly calendar indicating days with logged workouts, multiple entry badges per day, and quick click-to-view navigation.
  - **Journal Feed**: Chronological stream of past workouts with search, filter by exercise/tag, and summary volume metrics.
  - *(Future Roadmap)*: Interactive workout flow visualizer mapping transitions and volume trends across split cycles.

---

## 4. Database Strategy & Selection

The database architecture is standardized on **SQLite with Prisma ORM**, leveraging SQLite's native JSON support:
- **Clean Isolation & Zero Overhead**: Runs as an embedded single-file database (`ironone.db`) on the Ubuntu server. No separate database daemon (`mongod` / `postgres`) required.
- **Relational Integrity**: Enforces strict foreign keys, cascade deletes, and relational links between Users, Workouts, and the Master Exercise Library.
- **Document Flexibility via JSON**: Complex or modality-specific set properties (isometric time holds, distance metrics, custom exercise metadata) can be stored in structured JSON columns without cumbersome schema migrations.
- **Effortless Backups**: Backing up years of workout history is as simple as copying a single `.db` file or automating a daily snapshot script.

---

## 5. Non-Functional Requirements
- **NFR-1: Minimal Friction & Tactile UI**: 
  - Logging must be as effortless as possible to eliminate workout friction and prevent user drop-off.
  - Controls must offer immediate 1-tap logging, large thumb-friendly increment/decrement step buttons (e.g., `+5`, `+2.5`, `+1`), and quick completion toggles.
- **NFR-2: Mobile-First, Fully Desktop-Capable**:
  - Primary design and UX prioritized for mobile viewports (phones at the gym over Tailscale).
  - Responsive layout scales seamlessly to desktop/tablet monitors for planning splits, viewing calendars, and reviewing logs at home.
- **NFR-3: Advanced Cryptography & Security**:
  - Passwords hashed with **Argon2id** (memory-hard, resistant to GPU/FPGA/ASIC cracking).
  - Network-level isolation: service binds exclusively to Tailscale (`100.x.y.z`) or local interface, never exposed directly to public ports.
- **NFR-4: Performance & Offline Resilience**:
  - Instant UI responsiveness with optimistic local state updates so set logging feels native and lag-free.
- **NFR-5: Data Portability & Long-Term Durability**:
  - Ability to export workout history (JSON/CSV) to prevent platform lock-in and safeguard years of gym progress.

---

## 6. Future Extensions & Social Features (Post-MVP Roadmap)

While the initial releases prioritize private, zero-friction individual logging, the system architecture will accommodate modular social and community extensions down the road:

- **FR-SOC-1: Routine & Template Sharing**:
  - Export and import workout routines as JSON or shareable links.
  - Ability to browse and clone routines published by other users on the instance (e.g., "Travis's PPL Split").
- **FR-SOC-2: Private Activity Feed**:
  - Opt-in social activity feed displaying completed workouts, milestones, and personal records among trusted peers on the private network.
- **FR-SOC-3: Kudos & Interaction**:
  - Lightweight social interactions on completed workout entries (fist bumps/kudos, congratulatory comments).
- **FR-SOC-4: Consistency & Volume Leaderboards**:
  - Opt-in monthly consistency tracking (e.g., total workouts completed this month, volume progression) to foster friendly accountability without vanity metrics.
- **FR-SOC-5: Interactive Progression Visualizer**:
  - Interactive flowchart/graph showing progression and flow between different workout routines across training blocks.
- **FR-AUTH-4: Password Reset & Account Recovery (Planned)**:
  - Secure password reset flow (e.g. CLI recovery token on server, email link, or emergency security key) for self-hosted account recovery.
