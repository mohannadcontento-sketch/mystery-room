#!/usr/bin/env bash
# Persistent runner for the Mystery Room socket.io service.
# Restarts the service if it dies.

set -u

SERVICE_DIR="/home/z/my-project/mini-services/mystery-game"
LOG_FILE="$SERVICE_DIR/service.log"
PID_FILE="$SERVICE_DIR/service.pid"

cd "$SERVICE_DIR"

# Build once
/usr/local/bin/bun build index.ts --target=node --outdir=./dist > /dev/null 2>&1

while true; do
  echo "[$(date)] starting mystery-game service (node)..." >> "$LOG_FILE"
  node --max-old-space-size=256 dist/index.js >> "$LOG_FILE" 2>&1 &
  PID=$!
  echo $PID > "$PID_FILE"
  wait $PID
  EXIT_CODE=$?
  echo "[$(date)] service exited with code $EXIT_CODE, restarting in 3s..." >> "$LOG_FILE"
  sleep 3
done
