# CampaignX Web (Next.js)

Next.js App Router migration of the CampaignX frontend with server-side API integrations for:
- CampaignX API (`CAMPAIGNX_API_KEY`)
- Gemini (`GEMINI_API_KEY`)

- Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `SUPABASE_SERVICE_ROLE_KEY`)
- LangChain.js + LangGraph workflow (JavaScript)

## 1. Install

```bash
npm install
```

## 2. Environment

Create `.env.local`:

```bash
CAMPAIGNX_BASE_URL=https://campaignx.inxiteout.ai
CAMPAIGNX_API_KEY=your_campaignx_api_key

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash



NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key


```

## 3. Run

```bash
npm run dev
```

## 4. Build

```bash
npm run build
npm run start
```

## 5. API routes (Next.js server)

- `GET /api/campaignx/cohort`
- `POST /api/campaignx/send`
- `GET /api/campaignx/report?campaign_id=...`
- `POST /api/gemini/generate`
- `POST /api/gemini/analyze`
- `POST /api/agent/run` (LangGraph + LangChain.js)

## Deployment

Deploy directly to Vercel (recommended for Next.js):
- Add all `.env.local` keys as Vercel Project Environment Variables.
- Build command: `npm run build`
- Start command: `npm run start` (for non-serverless targets)
