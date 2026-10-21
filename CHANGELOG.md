# Changelog

## [0.5.0] - 2026-10-21
- Added: Weekly consistency streak tracker on Dashboard (replacing unit system readout) and Profile page with Sunday 12:00 AM week boundary
- Added: Active vs Pending streak status indicators and Sunday–Saturday 7-day visual activity log strip
- Added: All-time longest weekly streak calculation and this-week workout completion metrics
- Added: Global theme selector on Profile page featuring 8 curated gym aesthetics (Iron Emerald, OLED Stealth, Crimson Forge, OLED Crimson, Electric Cobalt, OLED Cobalt, Cyber Violet, Amber Volt)
- Added: Zero-flash theme persistence using client localStorage and dynamic root CSS variable remapping
- Added: OLED AMOLED pure black (#000000) modes for reduced gym floor glare and battery optimization
- Improved: Initial day indicator highlight on weekly streak tracker to render instantaneously before network data resolves
- Fixed: Desktop horizontal scroll navigation chevrons overlapping filter pill chips across routine, catalog, and active workout pickers

## [0.4.0] - 2026-10-21
- Added: Interactive multi-slide onboarding walkthrough tour covering core tracking pillars, offline resilience, and overload tracking
- Added: Replayable feature tour launcher accessible anytime from Dashboard greeting and Profile settings

## [0.3.0] - 2026-10-21
- Added: Desktop horizontal scroll chevrons and mouse wheel scrolling translation for category and filter chips
- Added: Color-coded modality indicators (Emerald Weight & Reps, Sky Time Duration holds, Amber Distance & Time cardio)
- Added: Non-destructive idempotent master exercise catalog sync with 17 new movements (74 total)
- Added: Application footer displaying version and copyright notice across all authenticated views and auth gateways
- Improved: Routine blueprint editor input ergonomics with larger tap targets and tactile numeric typography
- Fixed: Desktop horizontal scrolling on routine editor exercise picker and live workout modals
- Fixed: Ambiguity between isometric time duration holds and cardio distance/time across routines, logging, and catalog

## [0.2.0] - 2026-10-20
- Added: Tactile live gym logger with micro-steppers for load, reps, and minutes
- Added: Modality support for weight/reps, isometric duration, and distance/time with pace calculation
- Added: 1-tap set type cycling (Normal, Warmup, Drop, Failure)
- Added: Floating dockable gym rest timer with presets, audio chimes, and background wake sync
- Added: Celebratory confetti particle bursts and victory haptics on workout completion
- Added: Mid-session exercise hot-swapping with set retention and modality sanitization
- Added: Progressive overload target cloning ("Clone to Today")
- Added: Monthly calendar grid with daily split badges and paginated journal stream
- Added: Routine blueprint templates with 1-tap duplication and order resequencing
- Added: Master catalog with 50+ standard movements plus custom exercise creator
- Added: Offline local storage shield and multi-device background polling (3.5s)
- Added: Automated SQLite online WAL database backup script with 14-day rotation
- Added: Argon2id password hashing, constant-time verification, and magic byte avatar validation
- Fixed: Set table header column alignment in live logger
- Fixed: Horizontal filter chip scrollbars on mobile via `.scrollbar-none`
- Fixed: Set stepper state reset bug during rapid taps
- Fixed: Routine blueprint creation validation feedback

## [0.1.0] - 2026-10-15
- Initial project scaffolding, database schema, Prisma configuration, and core architecture.
