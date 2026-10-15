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
- 🏋️‍♂️ **Multi-Modal Exercises**: Log traditional weight & reps, isometric holds/time (e.g., 60-second planks), or distance & cardio with pace metrics.
- 🛡️ **Gym Network Resilience**: Local client storage shields in-progress sessions, ensuring zero data loss if cellular connection drops in basement gyms over Tailscale.
- 📅 **Dual Views**: Visual monthly calendar split badges alongside a detailed chronological journal stream.
- 🔒 **Private & Secure**: Standalone local SQLite database, Argon2id memory-hard password hashing, and network-level Tailscale isolation.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Node.js, Express.js (ESM), Multer, Argon2id, JWT |
| **Database** | SQLite with Prisma ORM (WAL mode enabled) |
| **Frontend** | React, Vite, Tailwind CSS (Mobile-First SPA) |
| **Networking** | Tailscale Mesh VPN (Private remote access) |
| **Host** | Ubuntu 26 LTS (*"mini-one"*) |

---

## Project Documentation

Internal agent guidelines and specifications live in the [`agents/`](./agents/) directory:
- [`agents/REQUIREMENTS.md`](./agents/REQUIREMENTS.md) — Comprehensive functional and non-functional requirements.
- [`agents/PLAN.md`](./agents/PLAN.md) — Architectural blueprints, schema models, and phased roadmap.
- [`agents/CONVENTIONS.md`](./agents/CONVENTIONS.md) — Engineering guidelines, formatting rules, and style idioms.
- [`agents/INSTRUCTIONS.md`](./agents/INSTRUCTIONS.md) — AI agent directives and scope boundaries.
