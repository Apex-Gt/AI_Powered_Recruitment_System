FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV HF_HOME=/app/.cache/huggingface

# tesseract: OCR for scanned PDFs. curl: the health check.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Embeddings and chat come from Ollama by default, so torch is not needed (saves ~4 GB).
# Build with --build-arg WITH_LOCAL_EMBEDDINGS=true to run BGE-M3 and the reranker inside this container instead.
ARG WITH_LOCAL_EMBEDDINGS=false
RUN if [ "$WITH_LOCAL_EMBEDDINGS" = "true" ]; then pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu; fi

COPY pyproject.toml ./
COPY app ./app
RUN if [ "$WITH_LOCAL_EMBEDDINGS" = "true" ]; then pip install --no-cache-dir -e ".[local-embeddings]"; else pip install --no-cache-dir -e .; fi

COPY . .

# Run as an unprivileged user; it only needs to read the shared uploads volume.
RUN useradd --system --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

CMD ["python", "main.py"]
