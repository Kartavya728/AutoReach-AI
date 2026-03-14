FROM node:20-bookworm-slim AS node-deps

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app

COPY --from=node-deps /app/frontend/node_modules ./frontend/node_modules
COPY frontend ./frontend

RUN cd frontend && npm run build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PYTHON_BIN=python3
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv "$VIRTUAL_ENV"

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend ./backend
COPY frontend ./frontend
COPY docker-compose.yml ./docker-compose.yml
COPY DOCKER_DEPLOYMENT.md ./DOCKER_DEPLOYMENT.md

COPY --from=node-deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next

RUN npm prune --omit=dev --prefix frontend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python3 -c "import os,sys,urllib.request; port=os.getenv('PORT', '3000'); urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health', timeout=3); sys.exit(0)"

CMD ["npm", "run", "start", "--prefix", "frontend"]
