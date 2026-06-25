# ---- Stage 1: Builder ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Build-time tools: compiler headers + curl/xz for static FFmpeg download
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev curl xz-utils \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Static FFmpeg — GPL build from BtbN/FFmpeg-Builds (linux/amd64).
# Static linking means zero shared-library dependencies in the production stage.
# Pin FFMPEG_BUILD to a specific release asset to guarantee reproducible builds.
# To upgrade: change the ARG and verify the new asset name on GitHub releases.
# ---------------------------------------------------------------------------
ARG FFMPEG_BUILD=n7.1-latest-linux64-gpl-7.1
RUN curl -fsSL \
      "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-${FFMPEG_BUILD}.tar.xz" \
      -o /tmp/ffmpeg.tar.xz && \
    tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ && \
    install -m 755 "/tmp/ffmpeg-${FFMPEG_BUILD}/bin/ffmpeg"  /tmp/ff_ffmpeg  && \
    install -m 755 "/tmp/ffmpeg-${FFMPEG_BUILD}/bin/ffprobe" /tmp/ff_ffprobe && \
    rm -rf /tmp/ffmpeg.tar.xz "/tmp/ffmpeg-${FFMPEG_BUILD}"

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---- Stage 2: Production image ----
FROM python:3.11-slim

# Runtime libraries required by OpenCV headless, MediaPipe (CPU), and libgomp.
# ffmpeg is no longer installed via apt-get — the static binary is copied below.
# GUI / X11 / EGL display libraries are intentionally omitted (headless Cloud Run).
# MEDIAPIPE_DISABLE_GPU=1 (set below) prevents MediaPipe from probing EGL.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built Python packages from builder stage
COPY --from=builder /install /usr/local

# Copy static FFmpeg binaries — self-contained, no shared-lib dependencies
COPY --from=builder /tmp/ff_ffmpeg  /usr/local/bin/ffmpeg
COPY --from=builder /tmp/ff_ffprobe /usr/local/bin/ffprobe

WORKDIR /app

COPY . .

# ---- Cloud Run configuration ----
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
# Activates /tmp/ code paths throughout the app (bowling, batting, submissions, videos, storage)
ENV CLOUD_RUN=1
# Prevents MediaPipe from attempting EGL/GPU initialisation in a headless environment
ENV MEDIAPIPE_DISABLE_GPU=1

EXPOSE 8080

CMD exec gunicorn main:app \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 3600 \
    --graceful-timeout 30 \
    --max-requests 50 \
    --max-requests-jitter 5 \
    --access-logfile - \
    --error-logfile -
