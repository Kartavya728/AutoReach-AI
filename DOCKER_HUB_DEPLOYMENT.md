# CampaignX Docker Hub Deployment Guide

## What this app needs

This repo runs as a single container:

- Next.js frontend
- custom Node server
- Python backend/agent runtime
- WebSocket traffic on the same public port

The image exposes port `3000` inside the container and uses `/api/health` for health checks.

Important: Docker Hub is only an image registry. It stores the image, but it does not host the running site. The usual flow is:

1. Build the image
2. Push the image to Docker Hub
3. Pull and run the image on a VPS, VM, EC2 instance, or another container host

## Required environment variables

Create a production env file such as `campaignx.env` with these values:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

CAMPAIGNX_API_KEY=your_campaignx_api_key
CAMPAIGNX_BASE_URL=https://campaignx.inxiteout.ai

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

PORT=3000
HOSTNAME=0.0.0.0
PYTHON_BIN=python3
LANGCHAIN_TRACING_V2=false
LANGSMITH_TRACING=false
```

Notes:

- `GEMINI_API_KEY` is required for the agent pipeline.
- `CAMPAIGNX_API_KEY` is required for CampaignX API calls.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it in the browser outside the container/runtime.
- Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` in production.

## Step 1: Create a Docker Hub repository

Create a Docker Hub repo, for example:

- repo name: `campaignx`
- full image name: `<dockerhub-username>/campaignx:latest`

## Step 2: Build the image locally

From the project root:

```bash
docker build -t campaignx .
```

If you want to test locally before pushing:

```bash
docker run --env-file .env -p 3000:3000 campaignx
```

Health check:

```bash
curl http://localhost:3000/api/health
```

If port `3000` is already busy on your machine, map a different host port:

```bash
docker run --env-file .env -p 3001:3000 campaignx
```

Then open:

```text
http://localhost:3001
```

## Step 3: Log in to Docker Hub

```bash
docker login
```

Enter your Docker Hub username and password or access token.

## Step 4: Tag the image for Docker Hub

Replace `<dockerhub-username>` with your Docker Hub username:

```bash
docker tag campaignx <dockerhub-username>/campaignx:latest
```

Optional versioned tag:

```bash
docker tag campaignx <dockerhub-username>/campaignx:v1
```

## Step 5: Push the image to Docker Hub

```bash
docker push <dockerhub-username>/campaignx:latest
```

Optional versioned push:

```bash
docker push <dockerhub-username>/campaignx:v1
```

## Step 6: Deploy from Docker Hub on a server

On your Linux server:

```bash
docker login
docker pull <dockerhub-username>/campaignx:latest
```

Copy your production env file to the server as `campaignx.env`, then run:

```bash
docker run -d \
  --name campaignx \
  --restart unless-stopped \
  --env-file campaignx.env \
  -p 3000:3000 \
  <dockerhub-username>/campaignx:latest
```

Check status:

```bash
docker ps
docker logs -f campaignx
```

Health check:

```bash
curl http://127.0.0.1:3000/api/health
```

## Step 7: Open the site

If the server public IP is `12.34.56.78`, the site will be available at:

```text
http://12.34.56.78:3000
```

If you use a reverse proxy and domain, point the proxy to container port `3000`.

## Recommended production setup

Use a reverse proxy such as Nginx or Caddy in front of the container for:

- HTTPS
- domain routing
- WebSocket upgrade support
- optional rate limiting

Because this app uses a custom WebSocket endpoint, your proxy must allow WebSocket upgrades on the same app origin.

## Optional: Deploy with Docker Compose on the server

Create `docker-compose.yml` on the server:

```yaml
services:
  campaignx:
    image: <dockerhub-username>/campaignx:latest
    container_name: campaignx
    restart: unless-stopped
    env_file:
      - campaignx.env
    ports:
      - "3000:3000"
```

Then run:

```bash
docker compose up -d
docker compose logs -f
```

## Updating to a new version

On your local machine:

```bash
docker build -t campaignx .
docker tag campaignx <dockerhub-username>/campaignx:latest
docker push <dockerhub-username>/campaignx:latest
```

On the server:

```bash
docker pull <dockerhub-username>/campaignx:latest
docker stop campaignx
docker rm campaignx
docker run -d \
  --name campaignx \
  --restart unless-stopped \
  --env-file campaignx.env \
  -p 3000:3000 \
  <dockerhub-username>/campaignx:latest
```

## Quick command summary

Local build and push:

```bash
docker build -t campaignx .
docker tag campaignx <dockerhub-username>/campaignx:latest
docker login
docker push <dockerhub-username>/campaignx:latest
```

Server deploy:

```bash
docker login
docker pull <dockerhub-username>/campaignx:latest
docker run -d --name campaignx --restart unless-stopped --env-file campaignx.env -p 3000:3000 <dockerhub-username>/campaignx:latest
```

## Troubleshooting

- If `localhost:3000` does not open locally, try `-p 3001:3000` and browse `http://localhost:3001`.
- If the app loads but agent runs fail, verify `GEMINI_API_KEY`, `CAMPAIGNX_API_KEY`, and Supabase keys.
- If you put the app behind Nginx, make sure WebSocket upgrades are enabled.
- If `/api/health` is healthy but the domain fails, check firewall rules and proxy configuration.
