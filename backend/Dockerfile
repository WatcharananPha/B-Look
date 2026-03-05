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

# Ensure persistent static dirs exist under /home (Azure App Service persistent storage)
# SQLite DB also lives in /home so it survives container restarts.
# alembic upgrade head creates the schema on first boot; safe to re-run on restarts.
CMD ["bash", "-c", \
    "mkdir -p /home/static/slips /home/static/mockups && \
    export DATABASE_URL=${DATABASE_URL:-sqlite:////home/blook_prod.db} && \
    alembic upgrade head && \
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
