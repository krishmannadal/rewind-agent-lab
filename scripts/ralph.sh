#!/usr/bin/env bash
# Ralph Loop runner for REWIND Agent Lab (Bash)
# Runs autonomous coding agent loop with fresh context on each iteration.

set -euo pipefail

MAX_ITERATIONS="${1:-15}"
AGENT_CMD="${2:-claude}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRD_PATH="${REPO_ROOT}/PRD.md"
PROMPT_PATH="${REPO_ROOT}/scripts/ralph/prompt.md"

if [[ ! -f "$PRD_PATH" ]]; then
    echo "Error: PRD.md not found at ${PRD_PATH}" >&2
    exit 1
fi

echo "=================================================="
echo "   Starting Ralph Loop for REWIND Agent Lab"
echo "   Target PRD: ${PRD_PATH}"
echo "   Max Iterations: ${MAX_ITERATIONS}"
echo "=================================================="

iteration=1

while [[ $iteration -le $MAX_ITERATIONS ]]; do
    echo -e "\n>>> [Iteration ${iteration} / ${MAX_ITERATIONS}] Starting fresh agent cycle..."
    
    # Check if any unchecked tasks remain
    if ! grep -q -- "- \[ \]" "$PRD_PATH"; then
        echo -e "\n🎉 All tasks in PRD.md are completed! Halting Ralph Loop."
        break
    fi

    echo "Running agent iteration with prompt: ${PROMPT_PATH}"
    # Example agent invocation:
    # cat "$PROMPT_PATH" | $AGENT_CMD -p --dangerously-skip-permissions || true

    echo "Iteration ${iteration} complete. Checking PRD progress..."
    iteration=$((iteration + 1))
done

echo -e "\nRalph Loop finished."
