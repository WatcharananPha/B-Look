#!/bin/sh
set -e

# Run Alembic migrations then start the app
echo "Running database migrations..."
alembic upgrade head

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
