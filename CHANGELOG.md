# Changelog

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
