FROM python:3.11-slim

# ป้องกันปัญหา Debconf warning
ARG DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Bangkok

WORKDIR /app

# Install System Dependencies (แบบเงียบ)
RUN apt-get update && apt-get install -y     build-essential     libpq-dev     && rm -rf /var/lib/apt/lists/*

# Install Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Application Code
COPY . .

# Run Migration & Start App
CMD bash -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
