#!/usr/bin/env bash
###############################################################################
# IronOne Database Backup Runner
# Executes portable Node.js SQLite backup snapshot and rotation
###############################################################################

set -euo pipefail

# Resolve project root path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Run cross-platform Node.js backup script
exec node "${PROJECT_ROOT}/scripts/backup.js" "$@"

