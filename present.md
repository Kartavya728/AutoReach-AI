# 🚀 CampaignX — Presentation Overview
> **FrostHack | XPECTO 2026 — InXiteOut × IIT Mandi**
> AI Multi-Agent Marketing Automation for **SuperBFSI XDeposit Term Deposit**

---

## 📌 TL;DR

CampaignX is a **fully autonomous, AI-powered multi-agent system** that takes a natural language marketing brief and runs an end-to-end email marketing campaign — from customer segmentation → content generation → human approval → campaign execution → performance analysis → iterative optimization — all without any manual intervention beyond initial brief entry.

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js 14 Web Interface                    │
│   Campaign Brief │  HiTL Approval Gate │  Analytics Dashboard    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API (Next.js API Routes)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Orchestrator / Supervisor Agent                     │
│               (LangGraph — State Machine)                        │
└──┬──────────┬──────────┬───────────┬────────────┬───────────────┘
   ▼          ▼          ▼           ▼            ▼
┌──────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────────┐
│Cohort│ │Strategy│ │ Content │ │Executor│ │ Analyst  │
│Agent │ │ Agent  │ │  Agent  │ │ Agent  │ │  Agent   │
└──┬───┘ └───┬────┘ └────┬────┘ └───┬────┘ └────┬─────┘
   │         │           │          │            │
   └─────────┴───────────┴──────────┴────────────┘
                          │
           ┌──────────────┴──────────────┐
           │      CampaignX REST API      │
           │  campaignx.inxiteout.ai      │
           └──────────────┬──────────────┘
                          │
           ┌──────────────┴──────────────┐
           │       Supabase (PostgREST)   │
           │   Campaigns │ Variants       │
           │   Customers │ Agent Traces   │
           │   Optimization History       │
           └──────────────┬──────────────┘
                          │
           ┌──────────────┴──────────────┐
           │     LangSmith Observability  │
           │ (Full trace of every LLM     │
           │  call & agent decision)      │
           └─────────────────────────────┘
```

---

## 🤖 AGENT ROLES & RESPONSIBILITIES

| Agent | Role | LLM | Key Actions |
|-------|------|-----|-------------|
| **Orchestrator** | Supervisor — routes state machine | Gemini 1.5 Flash | Parses brief, decides next agent, manages retry |
| **Cohort Agent** | Fetches & profiles customers | Gemini 1.5 Flash | Calls `/api/v1/get_customer_cohort`, segments by demo/behaviour |
| **Strategy Agent** | Designs A/B test plan | Groq Llama-3.3-70B | Micro-segment selection, variant count, send time, targeting weights |
| **Content Agent** | Generates email content | Gemini 1.5 Pro / Mistral Large | Subject + body per variant, emoji/CTA/tone customization |
| **Executor Agent** | Dispatches campaigns | — (API calls only) | Calls `/api/v1/send_campaign` post HiTL approval |
| **Analyst Agent** | Measures & optimizes | Groq Llama-3.3-70B | Fetches `/api/v1/get_report`, calculates EO/EC rates, drives loop |

### Agent Communication Protocol
- Agents communicate via **structured JSON** (no free-form text inter-agent)
- LangGraph **StateGraph** tracks campaign state across all agents
- Each handoff is persisted to `agent_traces` table in Supabase

---

## 🔄 CAMPAIGN OPTIMIZATION LOOP

```
[Brief Input]
     │
     ▼
Cohort Agent  ──► 5,000 customers fetched & profiled
     │
     ▼
Strategy Agent ──► Identifies top micro-segment (e.g. Female Senior Citizens)
     │              A/B variants: Tone A (Formal) vs Tone B (Warm)
     │              Optimal send time: 8 AM / 6 PM IST
     ▼
Content Agent ──► Generates subject + body per variant, stores to Supabase
     │
     ▼
HiTL Approval ──► Human marketer reviews & approves/rejects variants in UI
     │
     ▼
Executor Agent ──► Sends campaign via CampaignX API (Round 1: 30% cohort)
     │
     ▼
Analyst Agent ──► Polls /get_report, computes open rate & click rate
     │
     ├── Open Rate > 50%, Click Rate > 30%? ──► ✅ Campaign Successful
     │
     └── Below target? ──► Analyst generates optimization suggestions
                             Human approves suggestions
                             Content Agent re-generates improved content
                             Executor sends Round 2 (remaining 70%)
                             ↑ Loop repeats up to N rounds
```

---

## 🛢️ SUPABASE TABLE FEATURES

### 1. `customers` — Customer CRM
Full profile of every customer from the cohort:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Internal primary key |
| `customer_id` | varchar | External ID from CampaignX API (e.g. `CUST001`) |
| `email` | varchar | Customer email address |
| `full_name` | varchar | Full name |
| `age` | integer | Age for senior citizen targeting |
| `gender` | varchar | Gender for demographic segmentation |
| `marital_status` | varchar | Marital status |
| `family_size` | integer | Household size |
| `dependent_count` | integer | Number of dependents |
| `occupation` | varchar | Job title / role |
| `occupation_type` | varchar | e.g. Salaried, Self-Employed |
| `monthly_income` | integer | Income for high-value targeting |
| `kyc_status` | varchar | KYC compliance status |
| `city` / `region` | varchar | Geographic targeting |
| `credit_score` | integer | Financial profile |
| `social_media_active` | varchar | Social media engagement flag |
| `emails_sent` | integer | Tracking counter |
| `emails_opened` | integer | Engagement tracking |
| `emails_clicked` | integer | Conversion tracking |
| `topics_list` | text[] | Interest tags for personalisation |
| `w1`, `w2`, `w3` | numeric | AI-computed engagement weights |

---

### 2. `campaigns` — Campaign Registry
Core campaign lifecycle table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Internal campaign ID |
| `external_campaign_id` | varchar | CampaignX API-assigned UUID |
| `name` | varchar | Campaign label |
| `brief` | text | Original NLP brief from marketer |
| `status` | varchar | `draft` → `pending_approval` → `active` → `completed` |
| `subject` | varchar | Winning email subject |
| `body` | text | Winning email body |
| `target_segment` | varchar | e.g. "female_senior_professionals" |
| `total_customers` | integer | Cohort size |
| `send_time` | timestamptz | Scheduled dispatch time |
| `temperature` | numeric | LLM generation temperature |
| `use_emojis` | boolean | Emoji toggle per segment |
| `tone` | varchar | e.g. "formal", "warm", "urgent" |
| `optimization_round` | integer | Current iteration count |
| `open_rate` | numeric | Actual email open rate (%) |
| `click_rate` | numeric | Actual email click rate (%) |
| `total_opened` | integer | Absolute count of opens |
| `total_clicked` | integer | Absolute count of clicks |
| `target_customer_ids` | text[] | Array of targeted customer IDs |
| `strategy_reasoning` | text | AI reasoning for segment choice |
| `json_output` | jsonb | Full structured agent output |
| `approved_by` | varchar | Marketer who approved HiTL |
| `approved_at` | timestamptz | Approval timestamp |

---

### 3. `campaign_variants` — A/B Test Variants
Stores all LLM-generated email variants for each campaign:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Variant primary key |
| `campaign_id` | uuid → `campaigns.id` | FK to parent campaign |
| `variant_label` | varchar | e.g. "A", "B", "Control" |
| `subject` | varchar | Email subject line |
| `body` | text | Full email body |
| `tone` | varchar | Tone classification |
| `tags` | text[] | Content tags (e.g. ["emoji", "urgent"]) |
| `expected_open_rate` | varchar | AI-predicted open rate |
| `expected_click_rate` | varchar | AI-predicted click rate |
| `is_selected` | boolean | Whether marketer selected this variant |

---

### 4. `optimization_suggestions` — AI Improvement Suggestions
Generated by Analyst Agent after each campaign round:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Suggestion primary key |
| `campaign_id` | uuid → `campaigns.id` | Parent campaign |
| `title` | varchar | Short label (e.g. "Change send time to 6 PM") |
| `priority` | varchar | `high` / `medium` / `low` |
| `expected_impact` | varchar | Predicted improvement (e.g. "+8% open rate") |
| `reasoning` | text | LLM-generated justification |
| `current_value` | text | What is currently set |
| `suggested_value` | text | What the AI recommends |
| `category` | varchar | e.g. "timing", "tone", "segment" |
| `status` | varchar | `pending` → `approved` / `rejected` |
| `agent_thoughts` | text[] | Array of reasoning steps |
| `approved_by` | varchar | Human who approved |
| `approved_at` | timestamptz | Approval timestamp |

---

### 5. `campaign_optimization_history` — Round-by-Round Progress
Tracks improvement across optimization iterations:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | History entry ID |
| `campaign_id` | uuid | FK to campaign |
| `round` | integer | Iteration number (1, 2, 3…) |
| `date` | varchar | Round date |
| `previous_audience_size` | integer | Cohort size before re-targeting |
| `new_audience_size` | integer | Updated cohort size |
| `previous_open_rate` | numeric | Open rate before optimisation |
| `previous_click_rate` | numeric | Click rate before optimisation |
| `applied_optimizations` | text[] | List of applied suggestion titles |
| `expected_improvements` | text[] | What improvements were expected |

---

### 6. `agent_traces` — Agent Execution Log
Every single agent call is persisted here:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Trace primary key |
| `campaign_id` | uuid | FK to campaign |
| `run_id` | varchar | Run ID |
| `agent_name` | varchar | e.g. "StrategyAgent", "ContentAgent" |
| `input_payload` | jsonb | Full input to the agent |
| `output_payload` | jsonb | Full output from the agent |
| `status` | varchar | `success` / `error` |
| `latency_ms` | integer | Execution latency |

---

### 7. `customer_cohort` — Cohort Snapshot
Raw snapshot of customers from CampaignX API:

| Column | Type | Description |
|--------|------|-------------|
| `customer_id` | varchar | CampaignX customer ID |
| `email` | varchar | Email address |
| `name` | varchar | Display name |
| `age`, `gender`, `region`, `city` | various | Demographics |
| `is_senior_citizen` | boolean | Senior targeting flag |

---

### 8. `teams` — Team Registry
Stores team registration info from CampaignX API signup:

| Column | Type | Description |
|--------|------|-------------|
| `team_name` | varchar | Unique team name |
| `team_email` | varchar | Team contact email |
| `api_key` | varchar | CampaignX-issued API key |

**Supabase Features Used:**
- 🔒 **Service Role Key** with admin-only server-side access (no RLS needed)
- ⚡ **PostgREST** auto-generated REST API
- 🔗 **Foreign Keys** & **JOIN selects** (e.g. `campaigns → campaign_variants`)
- 📐 **JSONB columns** for flexible AI output storage
- 🕒 **Timestamptz** for all audit trails
- 🗃️ **Array columns** (text[]) for multi-value fields

---



## 🛠️ TECH STACK — FULL FUNCTIONALITY BREAKDOWN

### Frontend

| Technology | Version | Role |
|------------|---------|------|
| **Next.js** | 14 (App Router) | Full-stack React framework — SSR, API routes, file-based routing |
| **TypeScript** | 5.x | Type-safe development across all layers |
| **Tailwind CSS** | 3.x | Utility-first responsive design |
| **Recharts** | Latest | Hourly engagement charts, KPI cards, optimization history graphs |
| **React Hook Form** | Latest | Campaign brief form with validation |
| **Radix UI** | Latest | Accessible UI components (modals, dropdowns) |

### Backend (API Layer — Next.js API Routes)

| Route | Method | Function |
|-------|--------|----------|
| `/api/agent/run` | POST | Triggers full LangGraph campaign pipeline |
| `/api/agent/optimize` | POST | Runs optimization agent with approved suggestions |
| `/api/campaigns` | GET/POST | CRUD for campaign registry |
| `/api/campaigns/[id]` | GET/PATCH | Get or update a single campaign |
| `/api/analysis` | GET | Fetch computed analytics from CampaignX report |
| `/api/customers` | GET | Pull customer cohort from Supabase |

### AI / LLM Layer

| Provider | Model | Role |
|----------|-------|------|
| **Google Gemini** | `gemini-1.5-flash` / `gemini-1.5-pro` | Orchestration, strategy, content generation |
| **Groq** | `llama-3.3-70b-versatile` | Fast analysis & optimization decisions |
| **Mistral** | `mistral-large-latest` | Fallback content generation |
| **GitHub Models** | `gpt-4o-mini` | Optional backup |

**Multi-provider fallback**: Gemini → Groq → Mistral (auto-switched on rate limit errors)

### Agent Framework

| Technology | Role |
|------------|------|
| **LangGraph** (JS/TS) | State machine orchestration across 5 agents |
| **LangChain.js** | Tool binding, prompt templates, structured output |


### Database

| Technology | Role |
|------------|------|
| **Supabase** (PostgreSQL) | Primary database for campaigns, customers, traces |
| **PostgREST** | Auto-generated REST API from schema |
| **Supabase JS SDK** | Server-side admin client with service role key |

### External APIs

| API | Purpose | Rate Limit |
|-----|---------|------------|
| **CampaignX API** | Customer cohort, campaign send, reports | 100 req/day |


### Infrastructure

| Component | Technology |
|-----------|------------|
| **Runtime** | Node.js 20 |
| **Package Manager** | npm |
| **Deployment Target** | Vercel (frontend + API) |
| **Environment Secrets** | `.env.local` (Next.js) |

---

## 💡 UNIQUE FEATURES

### 1. 🧠 Observability
Every agent trace is logged to the `agent_traces` Supabase table. This means:
- Local replay and audit via SQL queries on Supabase
- Judges can inspect every single AI decision even offline

### 2. 🔁 Autonomous A/B Optimization Loop
The system doesn't just run one campaign — it **iterates automatically**:
- Round 1 → 30% cohort → collect metrics
- If below target → AI generates suggestions → Human approves → Round 2
- Tracks all rounds in `campaign_optimization_history` with before/after metrics

### 3. 👤 Human-in-the-Loop (HiTL) Approval Gate
A dedicated **approval UI** where the marketer reviews AI-generated variants before any email is sent. Each suggestion can be individually approved/rejected with reasoning captured.

### 4. 📊 Real-Time Analytics Dashboard
- Hourly engagement breakdown (opens/clicks by hour)
- Segment performance (gender, region, occupation)
- KPI cards: open rate, click rate, total reached
- Optimization history timeline with round-by-round deltas

### 5. ⚡ Multi-Provider LLM Fallback
If Gemini hits rate limits → automatically switches to Groq → then Mistral.  
Zero downtime, zero manual intervention.

### 6. 🎯 AI Micro-Segment Discovery
The Strategy Agent doesn't use hardcoded segments. It analyses the customer cohort live and autonomously discovers high-potential micro-segments (e.g. "female senior citizens in metro cities with app installed") and computes optimal send times per segment.

### 7. 📐 Structured JSON Agent Communication
All inter-agent messages use **typed JSON schemas** — no hallucination risk in agent handoffs. Each agent validates its input before acting.

### 8. 🔒 Server-Side-Only Supabase Access
All Supabase calls use the **service role key** exclusively from server-side API routes — the client never touches the database directly. This ensures data integrity and prevents key leakage.

### 9. 🗃️ JSONB Strategy Output Storage
The full LLM strategy output (including reasoning, segment weights, variant rationale) is stored as JSONB in the `campaigns.json_output` column — enabling full audit and replay of any AI decision.

### 10. 🌐 Dynamic CampaignX API Tool Discovery
Rather than hardcoding API call structure, the system uses **dynamic tool binding** — the agent reads the API spec and constructs correct API calls at runtime (avoids any deterministic/hardcoded parameters, matching the competition requirements).

---

## 📐 PROJECT FILE STRUCTURE

```
CampaignX/
├── WebInterface/                    # Next.js 14 full-stack app
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/run/           # LangGraph pipeline trigger
│   │   │   ├── agent/optimize/      # Optimization agent endpoint
│   │   │   ├── campaigns/           # CRUD API routes
│   │   │   └── analysis/            # Analytics computation
│   │   ├── campaigns/               # Campaign list & detail pages
│   │   └── dashboard/               # Analytics dashboard
│   └── src/
│       ├── lib/
│       │   ├── server/
│       │   │   ├── langgraph.js     # LangGraph agent pipeline
│       │   │   ├── optimize.ts      # Optimization agent logic
│       │   │   ├── gemini.ts        # Gemini LLM integration
│       │   │   ├── campaignx.ts     # CampaignX API client
│       │   │   ├── supabase.ts      # All Supabase CRUD operations

│       │   │   └── analysis.ts      # Report analysis computation
│       │   └── types.ts             # All TypeScript types
│       └── styles/                  # Global CSS
├── final.sql                        # Supabase schema (run in SQL Editor)
├── update.sql                       # Schema migrations
├── test.py                          # CampaignX API exploratory tests
├── test_campaign_loop.mjs           # Automated campaign loop tester
└── README.md                        # Full project documentation
```

---

## 🔑 ENVIRONMENT VARIABLES

```env
# CampaignX Competition API
CAMPAIGNX_API_KEY=<from signup>
CAMPAIGNX_BASE_URL=https://campaignx.inxiteout.ai

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your supabase project url>
SUPABASE_SERVICE_ROLE_KEY=<admin service role key>

# LLM Providers
GEMINI_API_KEY=<google ai studio key>
GROQ_API_KEY=<groq console key>
MISTRAL_API_KEY=<mistral console key>


```

---

## 📊 EVALUATION ALIGNMENT

| Judge Criterion | Our Implementation |
|----------------|-------------------|
| Campaign Performance (Open + Click Rate) | AI micro-segment targeting + A/B loop achieves >50% open, >30% click |
| Quality of AI Agent System | 6-agent LangGraph pipeline with structured handoffs |
| User Experience | Full Next.js dashboard with real-time analytics |
| Code Modularity | Clean TypeScript, separated by agent/server/UI layers |
| Innovation | Dual observability, HiTL gate, autonomous optimization loop |

| **BONUS: Real-time Metrics Dashboard** | ✅ Hourly engagement, segment breakdown, KPI cards |
| **BONUS: Cloud Deployment** | ✅ Next.js deployable to Vercel |

---

## 🗓️ KEY DATES

| Date | Milestone |
|------|-----------|
| **14 March 2026** | Live test phase begins — NEW cohort released |
| **14 March 2026** | Retrieve fresh customer cohort via API |
| **14 March 2026** | Campaign test phase (14–16 March) |
| **14 March 2026, 11:59 PM** | Final submission deadline |

---

*Built for FrostHack | XPECTO 2026 | InXiteOut × IIT Mandi*
*Team: CampaignX — Autonomous AI Marketing at Scale*
