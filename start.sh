#!/bin/sh
set -e

echo "SERVICE=$SERVICE"

if [ "$SERVICE" = "web" ]; then
  echo "Starting Next.js web..."
  cd /app/apps/web
  exec node_modules/.bin/next start -p 3000
else
  echo "Starting API..."
  exec node /app/apps/api/dist/index.js
fi
