# Build context is the repository root: the image needs web/, LaLaHome/ (Mimi brand kit) and lalaflow/frontend/.

FROM node:20-alpine AS frontend
WORKDIR /src/lalaflow/frontend
COPY lalaflow/frontend/package.json lalaflow/frontend/package-lock.json ./
RUN npm ci
COPY LaLaHome /src/LaLaHome
COPY web /src/web
COPY lalaflow/frontend ./
# vite.config.js writes the build to ../../web/lalaflow, i.e. /src/web/lalaflow.
RUN npm run build

FROM python:3.11-slim AS models
WORKDIR /build
COPY scripts/download_models.py scripts/download_models.py
RUN python scripts/download_models.py

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY speech-service/requirements.txt speech-service/requirements.txt
RUN pip install --no-cache-dir -r speech-service/requirements.txt
# config.py resolves models/, web/ and logs/ relative to /srv (two levels above speech-service/app).
COPY --from=models /build/models models
COPY --from=frontend /src/web web
COPY speech-service/app speech-service/app
RUN useradd --system --uid 10001 app && mkdir logs && chown app logs
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
CMD ["uvicorn", "app.main:app", "--app-dir", "speech-service", "--host", "0.0.0.0", "--port", "8000"]
