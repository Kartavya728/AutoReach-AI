# Docker Deployment

## What this container includes

- Next.js frontend and API routes
- The production custom server for same-port HTTP + WebSocket traffic
- Python agent runtime and backend dependencies

Everything runs inside one container and exposes a single public port through `PORT`.

## Required environment variables

Set these in your deployment platform:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
CAMPAIGNX_API_KEY=
CAMPAIGNX_BASE_URL=https://campaignx.inxiteout.ai
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3000
HOSTNAME=0.0.0.0
PYTHON_BIN=python3
```

## Local Docker

Build and run:

```bash
docker build -t campaignx .
docker run --env-file .env -p 3000:3000 campaignx
```

Or with Compose:

```bash
docker compose up --build
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Railway

Railway can deploy this project directly from the `Dockerfile`.

1. Create a new Railway service from the repo.
2. Railway will detect the `Dockerfile`.
3. Add the environment variables listed above.
4. Deploy.

Use `/api/health` as the health check path if you want an explicit readiness endpoint.

## Vercel

The full app is not a good fit for Vercel as a single deployment unit because it depends on:

- a long-running custom Node server
- same-origin WebSocket upgrades
- spawning Python subprocesses for the agent runtime

This Docker setup is ready for Railway and other container platforms. To deploy on Vercel, the app would need to be split into Vercel-compatible functions and an external long-running agent service.
