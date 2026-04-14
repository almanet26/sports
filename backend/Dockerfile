# ---- Stage 1: Build dependencies in a full image ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build-time headers needed to compile native wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- Stage 2: Production image ----
FROM python:3.11-slim

# System libraries required at RUNTIME by OpenCV, MediaPipe, and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libegl1 \
    libglx0 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built Python packages from builder stage
COPY --from=builder /install /usr/local

WORKDIR /app

# ---- Layer caching: requirements already installed above ----
# Copy application code (invalidates cache only when code changes)
COPY . .

# Create runtime storage directories
RUN mkdir -p storage/raw storage/trimmed storage/highlight storage/reports \
    storage/uploads storage/bowling_videos storage/batting_videos \
    storage/submissions storage/submission_videos storage/temp_frames

# ---- Cloud Run configuration ----
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Cloud Run always sends traffic to $PORT (default 8080)
EXPOSE 8080

# --workers 1 : Render free tier only has 512MB RAM — MediaPipe alone uses ~400MB
CMD exec gunicorn main:app \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 3600 \
    --graceful-timeout 30 \
    --max-requests 50 \
    --max-requests-jitter 5 \
    --access-logfile - \
    --error-logfile -
