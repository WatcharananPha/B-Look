FROM python:3.11-slim

ARG DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Bangkok

WORKDIR /app

# No PostgreSQL system libs needed — using SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Application Code
COPY . .

# Ensure persistent static dirs exist, run migrations, then start the server.
# PORT is injected by Railway at runtime; fall back to 8000 for local use.
CMD ["bash", "-c", \
    "mkdir -p /tmp/static/slips /tmp/static/mockups /tmp/static/artworks /tmp/static/print_files && \
    alembic upgrade head && \
    exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
