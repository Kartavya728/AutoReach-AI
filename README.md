# 🚀 AutoReach AI — Autonomous Multi-Agent Marketing Automation

> **AI-Powered Campaign Orchestration Platform**  
> Build an autonomous AI-agent system to plan, launch, monitor, and optimize email marketing campaigns for a financial services provider.

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Core Problem Statement](#core-problem-statement)
3. [System Architecture](#system-architecture)
4. [Campaign Strategy](#campaign-strategy)
5. [LLM Integration & Strategy](#llm-integration--strategy)

7. [Tech Stack Options — Pros & Cons](#tech-stack-options--pros--cons)
8. [Required APIs](#required-apis)
9. [Platform API Reference](#platform-api-reference)
10. [Deployment Strategy](#deployment-strategy)
11. [Evaluation Criteria](#evaluation-criteria)
12. [Submission Checklist](#submission-checklist)

---

## 📌 Project Overview

**AutoReach AI** is an AI-powered, fully autonomous multi-agent web application designed to manage end-to-end digital marketing campaigns. The system takes a **natural language campaign brief** from a human marketer, orchestrates a network of AI agents to:

- Segment and profile customers from a live cohort
- Generate optimized, personalized email content (subject + body)
- Schedule campaigns via API
- Collect real-time performance metrics (open rate / click rate)
- Autonomously optimize and re-launch campaigns in an iterative loop

The system includes a **Human-in-the-Loop (HiTL)** approval gate before any campaign is dispatched.

---

## 🎯 Core Problem Statement

Build an AI Agent solution for a BFSI client to launch a new **Term Deposit product**:

- Parse free-form natural language marketing briefs
- Identify best campaign strategy (optimal open rate & click rate)
- Generate personalized email content per micro-segment
- Request human approval before campaign execution
- Execute campaigns via the platform REST API
- Analyze performance, auto-optimize, and re-launch (A/B testing loop)
- **Avoid all deterministic/hardcoded API calls** — use dynamic API doc discovery for tool calling

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Web Application UI                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  Campaign Brief  │  │  Human Approval  │  │  Analytics      │  │
│  │  Input (NLP)     │  │  Gate (HiTL)     │  │  Dashboard      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘  │
└───────────│─────────────────────│────────────────────── │──────────┘
            ▼                     ▼                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Orchestrator / Supervisor Agent                │
│              (LangGraph / CrewAI / AutoGen)                        │
└──────┬────────────┬─────────────┬───────────┬──────────┬──────────┘
       ▼            ▼             ▼           ▼          ▼
  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐
  │ Cohort  │ │ Strategy │ │ Content  │ │Campaign │ │ Analyst  │
  │  Agent  │ │  Agent   │ │  Agent   │ │Executor │ │  Agent   │
  └────┬────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ └────┬─────┘
       │           │            │             │           │
       └───────────┴────────────┴─────────────┴───────────┘
                                │
                   ┌────────────┴──────────────┐
                   │   Platform REST API        │
                   │  (Marketing Automation)    │
                   └───────────────────────────┘
```

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **Cohort Agent** | Fetches & profiles customers from `/api/v1/get_customer_cohort` |
| **Strategy Agent** | Identifies micro-segments, A/B test variants, optimal send times |
| **Content Agent** | Generates personalized email subject + body (text, emoji, URLs) |
| **Executor Agent** | Submits campaigns via `/api/v1/send_campaign` after HiTL approval |
| **Analyst Agent** | Fetches reports via `/api/v1/get_report`, computes open/click rates, drives iteration |
| **Orchestrator** | Supervises agent workflow, manages state, routes between agents |

---

## 📊 Campaign Strategy

### 1. Customer Segmentation
- **Demographic segmentation**: Age group, gender, geography, income bracket
- **Behavioural segmentation**: Active vs. inactive customers, engagement history
- **Micro-segments**: Female senior citizens (extra 0.25% benefit), high-income professionals

### 2. A/B Testing Loop
```
Round 1: Send to 30% of cohort (A/B variants: tone, length, CTA placement)
   ↓
Collect metrics (opens, clicks) via /get_report
   ↓
Identify winning variant + best-performing segment
   ↓
Round 2: Send optimized version to remaining 70% + re-target non-openers
   ↓
Repeat until full cohort coverage
```

### 3. Content Strategy
- **Tone variants**: Formal (professionals), Warm (senior citizens), Urgent (deal-seekers)
- **Length variants**: Short (punchy, 100 words) vs. Long (detailed, 300 words)
- **Emoji usage**: Selective for consumer segments (✅💰📈), avoided for formal segments
- **Personalization**: Name, location, demographic-specific benefits
- **CTA**: Product landing URL embedded contextually

### 4. Optimal Send Time Strategy
- Morning (8–10 AM IST): Professionals checking emails
- Afternoon (12–1 PM IST): Lunch-hour browsing
- Evening (6–8 PM IST): Post-work engagement
- Weekdays preferred over weekends for BFSI products

---

## 🤖 LLM Integration & Strategy

### Recommended LLM Architecture

```
Campaign Brief (NLP Input)
        │
        ▼
┌───────────────────┐
│   Primary LLM     │  ← Gemini 1.5 Flash / Groq Llama-3.3-70B
│  (Orchestration + │    - Parse campaign brief
│   Content Gen)    │    - Segment strategy generation
└──────────┬────────┘    - Email content generation
           │
           ▼
┌───────────────────┐
│  Fallback LLM     │  ← Mistral / Cohere (if primary hits rate limits)
│  (Auto-switched   │
│   on 429 errors)  │
└───────────────────┘
```

### LLM Usage by Agent

| Agent | LLM Task | Recommended Model |
|-------|----------|------------------|
| Orchestrator | Intent parsing, workflow routing | Gemini 1.5 Flash |
| Strategy Agent | Segmentation logic, A/B plan | Groq Llama-3.3-70B |
| Content Agent | Email generation (subject + body) | Gemini 1.5 Pro / Mistral Large |
| Analyst Agent | Report interpretation, optimization decisions | Groq Llama-3.3-70B |

### Key LLM Best Practices
- Store all API keys in `.env` file using `python-dotenv`
- Implement **retry logic with exponential backoff** on 429 errors
- Use **multi-provider fallback**: Gemini → Groq → Mistral
- Use **structured output** (JSON mode) for agent-to-agent communication
- Implement **prompt versioning** for iterative optimization

---


---

## 🛠️ Tech Stack Options — Pros & Cons

### Option A: Python (FastAPI) + React + LangGraph ⭐ **Recommended**

| Layer | Technology | Pros | Cons |
|-------|-----------|------|------|
| **Backend** | FastAPI (Python) | Native LangChain/LangGraph support; async; fast; huge AI ecosystem | Python GIL for CPU tasks |
| **Agent Framework** | LangGraph | State machines for agents; production-grade | Steeper learning curve |
| **Frontend** | React + TypeScript | Rich UI; component reuse; excellent ecosystem | More setup than plain HTML |
| **Database** | SQLite / PostgreSQL | SQLite: zero-config; Postgres: production-grade | Postgres needs hosting |
| **LLM** | Gemini + Groq | Free tier; high rate limits; multimodal | API key management |
| **Deployment** | Render / Vercel | Free tier; simple CI/CD | Cold start on free tier |

**Verdict**: Best for serious, production-quality agentic system. LangGraph + LangSmith gives excellent observability.

---

### Option B: Python (FastAPI) + Next.js + CrewAI

| Layer | Technology | Pros | Cons |
|-------|-----------|------|------|
| **Backend** | FastAPI | Same as above | Same as above |
| **Agent Framework** | CrewAI | Intuitive role-based agents; beginner-friendly | Less control than LangGraph |
| **Frontend** | Next.js | SSR; API routes; production-ready | Overkill for hackathon MVP |
| **Database** | MongoDB | Flexible schema; great for agent logs | More complex queries |
| **Deployment** | Vercel + Render | Excellent free tier | Split frontend/backend deployment |

**Verdict**: Good for rapid development. CrewAI is easier to set up but less flexible for complex loops.

---

### Option C: Python + Streamlit + AutoGen

| Layer | Technology | Pros | Cons |
|-------|-----------|------|------|
| **Backend + Frontend** | Streamlit | All-in-one; extremely fast to build | UI limitations; not production-grade |
| **Agent Framework** | AutoGen (Microsoft) | Excellent multi-agent conversations | Complex debugging; verbose |
| **Database** | SQLite | Zero-config | Not suitable for scale |
| **Deployment** | Streamlit Cloud | Free; one-click deploy | Limited customization |

**Verdict**: Fastest for proof-of-concept. Not ideal for polished UI or complex HiTL flows.

---

### Option D: Node.js + Express + LangChain.js

| Layer | Technology | Pros | Cons |
|-------|-----------|------|------|
| **Backend** | Node.js + Express | Unified JS stack; fast I/O | Weaker AI/ML ecosystem vs. Python |
| **Agent Framework** | LangChain.js | JS-native; good for web devs | Less mature than Python LangChain |
| **Frontend** | React / Vue | Native JS ecosystem | Same as backend |
| **Database** | PostgreSQL | Production-grade | Requires setup |
| **Deployment** | Railway / Vercel | Easy; free tier | Limited compute |

**Verdict**: Good if team is primarily JS-focused. AI ecosystem is inferior to Python.

---

### Deployment Platforms Comparison

| Platform | Free Tier | Cold Start | Custom Domain | Best For |
|---------|-----------|------------|--------------|----------|
| **Render** | 750 hrs/month | Yes (15s) | Yes | FastAPI backend |
| **Vercel** | Unlimited (serverless) | Minimal | Yes | Next.js / frontend |
| **Netlify** | 100 GB bandwidth | Minimal | Yes | Static frontend |
| **Appwrite** | 75K API calls/day | No | Yes | BaaS + auth + DB |
| **Streamlit Cloud** | Free | Yes | No | Python-only apps |
| **Railway** | $5 credit/month | No | Yes | Full-stack |

---

## 🔑 Required APIs

### 1. Marketing Automation Platform API (PROVIDED)
| API | Purpose | Auth |
|-----|---------|------|
| `POST /api/v1/signup` | Register team, receive API key | None |
| `GET /api/v1/get_customer_cohort` | Fetch all target customers | `X-API-Key` |
| `POST /api/v1/send_campaign` | Schedule email campaign | `X-API-Key` |
| `GET /api/v1/get_report` | Fetch campaign performance metrics | `X-API-Key` |

**Rate Limit**: 100 requests/day per team  
**Header**: `X-API-Key: <your_api_key>`

---

### 2. LLM APIs (FREE TIER — TO OBTAIN)

| Provider | Models | Get Key At | Best Use |
|---------|--------|-----------|----------|
| **Google Gemini** | gemini-1.5-flash, gemini-1.5-pro | [aistudio.google.com](https://aistudio.google.com) | Orchestration, content gen |
| **Groq** | llama-3.3-70b-versatile, mixtral-8x7b | [console.groq.com](https://console.groq.com) | Fast inference, analysis |
| **Mistral** | mistral-large-latest, codestral | [console.mistral.ai](https://console.mistral.ai) | Fallback LLM |
| **GitHub Models** | gpt-4o-mini, phi-4, llama-3.3-70b | [github.com/settings/tokens](https://github.com/settings/tokens) | Backup / diversity |
| **Ollama** | llama3.2:1b, mistral | Local (no key needed) | Offline testing |


### 4. Optional Enhancement APIs

| API | Purpose | Free Tier |
|-----|---------|-----------|
| **Tavily Search** | Web search for market research | Yes |
| **SerpAPI** | Competitor research | 100 calls/month free |
| **NewsAPI** | Market news for campaign context | 100 calls/day free |

---

## 📡 Platform API Reference

### Authentication
```
Header: X-API-Key: <your_api_key>
Content-Type: application/json (for POST)
```

### Endpoints Summary

#### `POST /api/v1/signup`
```json
Request:  { "team_name": "YourTeam", "team_email": "you@example.com" }
Response: { "api_key": "...", "team_name": "...", "team_email": "...", "created_at": "..." }
```

#### `GET /api/v1/get_customer_cohort`
```json
Response: {
  "data": [{"customer_id": "CUST001", "email": "...", "name": "..."}],
  "total_count": 5000,
  "response_code": 200
}
```

#### `POST /api/v1/send_campaign`
```json
Request: {
  "subject": "Special Offer!",
  "body": "Campaign body text with emoji 🎉 and URL",
  "list_customer_ids": ["CUST001", "CUST002"],
  "send_time": "DD:MM:YY HH:MM:SS"
}
Response: { "campaign_id": "<uuid>", "response_code": 200 }
```

#### `GET /api/v1/get_report?campaign_id=<uuid>`
```json
Response: {
  "campaign_id": "...",
  "data": [{"customer_id": "...", "EO": "Y/N", "EC": "Y/N"}],
  "total_rows": 100,
  "response_code": 200
}
```
> `EO` = Email Opened, `EC` = Email Clicked

---

## 📊 Evaluation Criteria

### Shortlisting (Step 1)
| Criterion | Weight |
|-----------|--------|
| Campaign performance metrics (click rate 70%, open rate 30%) | **50%** |
| Functionality & completeness | 30% |
| Deliverable quality | 20% |

### Live Presentation (Step 2)
| Criterion | Weight |
|-----------|--------|
| Quality of AI agent system logic | 20% |
| Campaign performance metrics | 20% |
| User experience & stable execution | 15% |
| Code modularity and readability | 15% |
| Presentation skills | 15% |
| Innovation & creativity | 15% |

### Bonus Points

- ✅ Real-time campaign metrics dashboard
- ✅ Cloud deployment

---

## ✅ Submission Checklist

- [ ] Register team via `POST /api/v1/signup` and save API key
- [ ] Build multi-agent system (orchestrator + 5 agents)
- [ ] Implement HiTL approval UI
- [ ] Implement A/B testing optimization loop

- [ ] Run full campaign during test phase
- [ ] Record screen demo (< 3 mins)
- [ ] Retrieve **new** customer cohort on launch day (cohort changes!)
- [ ] Push code to public GitHub repo
- [ ] Submit via email before deadline

---

## 📁 Recommended Project Structure

```
autoreach-ai/
├── backend/
│   ├── agents/
│   │   ├── cohort_agent.py
│   │   ├── strategy_agent.py
│   │   ├── content_agent.py
│   │   ├── executor_agent.py
│   │   └── analyst_agent.py
│   ├── orchestrator/
│   │   └── graph.py          # LangGraph workflow
│   ├── tools/
│   │   └── platform_tools.py  # Dynamic API tool discovery
│   ├── api/
│   │   └── routes.py          # FastAPI routes
│   ├── utils/

│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Campaign brief, HiTL approval, dashboard
│   │   └── App.tsx
│   └── package.json
├── test.py                    # API test script
├── .env.example
├── requirements.txt
└── README.md
```

---

## ⚙️ Environment Variables

```env
# Platform API
PLATFORM_API_KEY=your_platform_api_key
PLATFORM_BASE_URL=https://your-platform-base-url

# LLM APIs
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
MISTRAL_API_KEY=your_mistral_key
GITHUB_TOKEN=your_github_pat


```

---

*AutoReach AI — Autonomous Multi-Agent Email Campaign Orchestration*
