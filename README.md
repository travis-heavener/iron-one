# IronOne

> **A self-hosted, frictionless workout tracking SPA built for progressive overload.**  
> *Authored by Travis Heavener*

---

## About

After tracking lifts for over three years in unstructured Samsung Notes, workout logging had become tedious and prone to friction. **IronOne** is the solution: a mobile-first, tactile web application hosted on a home Ubuntu 26 server (*"mini-one"*) and accessed securely anywhere via **Tailscale**.

This project is also an experiment in pure agentic pair programming—designed and developed using the **Antigravity CLI** while maintaining strict software conventions and architectural integrity.

---

## Core Features

- ⚡ **Frictionless Gym UI**: Large thumb targets, quick incremental step chips (`+5lb`, `+2.5lb`, `+1 rep`), and 1-tap completion toggles designed for rapid logging between sets.
- 📋 **Routines vs. Daily Journal**:
  - **Routines (Templates)**: Reusable split templates (e.g., *Push Day A*) that can be copied, customized, or started in one click. Editing a template never alters past workout logs.
  - **Workout Entries (Logs)**: Daily session logs supporting multiple entries per day or spontaneous freeform tracking without a routine.
- 🔄 **Progressive Overload Tracking**: Clone past workouts to today's date with previous weights and reps carried over as baseline targets to match or beat.
- 🏋️‍♂️ **Multi-Modal Exercises**: Log traditional weight & reps, isometric holds (e.g., planks, wall sits in seconds/minutes), or distance & cardio with automatic pace calculation (e.g., running, rowing, cycling in min/mi or min/km).
- 🛡️ **Gym Network Resilience**: Local client storage shields in-progress sessions, ensuring zero data loss if cellular connection drops in basement gyms over Tailscale.
- 📅 **Dual Views**: Visual monthly calendar split badges alongside a detailed chronological journal stream.
- 🔒 **Private & Secure**: Standalone local SQLite database, Argon2id memory-hard password hashing, and network-level Tailscale isolation.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Node.js (ESM), Express.js, Multer, Argon2id, JWT |
| **Database** | SQLite with Prisma ORM (WAL mode enabled) |
| **Frontend** | React 19, Vite, Tailwind CSS v4 (Mobile-First SPA, Client-Side Rendered) |
| **Networking** | Tailscale Mesh VPN (Private remote access) |
| **Target Host** | Linux / Ubuntu (or any Node.js host) |

---

## Quickstart: Clone, Init, Build & Run

### 1. Prerequisites
- **Node.js** >= 20.x (ESM support; Node v22+ or v25 recommended)
- **npm** >= 10.x
- **Git**
- **Tailscale** *(optional, for secure private remote access)*

### 2. Clone the Repository
```bash
git clone https://github.com/travisheavener/IronOne.git
cd IronOne
```

### 3. Install Dependencies
Install dependencies for both the backend server and the client SPA:
```bash
# Install root (backend) dependencies
npm install

# Install client (frontend) dependencies
npm run client:install
```

### 4. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```

Open `.env` and configure your settings. In particular, generate a strong random secret for `JWT_SECRET`:
```bash
# Generate a secure 64-character hex secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
JWT_SECRET=your_generated_secret_here
JWT_EXPIRES_IN=7d
DATABASE_URL="file:./ironone.db"
```

### 5. Initialize the Database
Run Prisma migrations to create the SQLite database schema with WAL mode enabled, generate the Prisma client bindings, and synchronize the master exercise catalog (74 standard movements across all modalities):
```bash
# Apply schema migrations and generate Prisma client
npm run db:migrate

# Synchronize the master exercise catalog
npm run db:seed
```

### 6. Build the Application
Compile the React 19 / Tailwind CSS frontend into static production assets:
```bash
npm run build
```
*(The backend runs natively as Node.js ES Modules and requires no compilation step).*

### 7. Run in Production
Launch the unified server (serves the REST API and the compiled client SPA from port `3000`):
```bash
npm start
```
Verify the server and database status by hitting the health check:
```bash
curl http://localhost:3000/api/health
# {"status":"ok","database":"connected","timestamp":"..."}
```

---

## Development Workflow

When actively developing or adding features:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs backend in auto-reload watch mode (`node --watch server/server.js`) |
| `npm run client:dev` | Runs Vite frontend with instant Hot Module Replacement (HMR) on port `5173` |
| `npm run client:install`| Installs frontend dependencies inside `client/` |
| `npm run build` | Compiles frontend production bundle into `client/dist/` |
| `npm run db:migrate` | Applies Prisma migrations to `ironone.db` |
| `npm run db:generate` | Regenerates Prisma client bindings if `schema.prisma` is modified |
| `npm run db:seed` | Safely synchronizes master exercise catalog (idempotent upsert; non-destructive) |
| `npm run db:studio` | Launches visual Prisma Studio GUI on port `5555` to inspect data |

---

## Remote Access & Data Management

### Remote Access via Tailscale
IronOne is engineered to run seamlessly across private Tailscale mesh networks:
1. Ensure Tailscale is running on your host machine:
   ```bash
   tailscale status
   tailscale ip -4
   ```
2. Because `HOST=0.0.0.0` is configured in `.env`, IronOne binds to all network interfaces, including your Tailscale address (`100.x.y.z`).
3. From any client device (phone, tablet, laptop) connected to the same Tailnet, open:
   ```text
   http://<tailscale-ip-or-magicdns>:3000
   ```
*(Security headers are pre-configured to allow Tailscale HTTP access without `Cross-Origin-Opener-Policy` restrictions).*

### Automated Database Backups
IronOne includes a built-in automated backup tool that creates a safe, non-blocking online WAL snapshot and rotates backups older than 14 days:
```bash
# Create an online snapshot in backups/
npm run db:backup
```
Alternatively, you can create a manual snapshot via SQLite:
```bash
sqlite3 ironone.db ".backup 'backups/ironone_$(date +%Y%m%d).db'"
```

---

## Project Documentation

Internal agent guidelines and specifications live in the [`agents/`](./agents/) directory:
- [`agents/REQUIREMENTS.md`](./agents/REQUIREMENTS.md) — Comprehensive functional and non-functional requirements.
- [`agents/PLAN.md`](./agents/PLAN.md) — Architectural blueprints, schema models, and phased roadmap.
- [`agents/CONVENTIONS.md`](./agents/CONVENTIONS.md) — Engineering guidelines, formatting rules, and style idioms.
- [`agents/INSTRUCTIONS.md`](./agents/INSTRUCTIONS.md) — AI agent directives and scope boundaries.
