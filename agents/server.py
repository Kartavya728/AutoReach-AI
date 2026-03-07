"""
FastAPI service — Bridge between Next.js frontend and Python agent pipeline.
=============================================================================
Endpoints:
    POST /run_campaign      — Runs the full multi-agent pipeline
    POST /optimize_campaign  — Runs the optimization loop
    GET  /agent_logs/{sid}   — SSE stream of structured agent reasoning logs

Start with:
    uvicorn agents.server:app --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.log_store import create_session, stream_logs
from agents.pipeline import run_campaign_pipeline, run_optimization_pipeline


# ═══════════════════════════════════════════════════════════════
#  REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════

class RunCampaignRequest(BaseModel):
    brief: str
    campaignName: str | None = None


class OptimizeCampaignRequest(BaseModel):
    campaignId: str
    approvedSuggestions: list[dict]


class RunCampaignResponse(BaseModel):
    sessionId: str
    brief: str
    strategy: str | None = None
    strategyReasoning: str | None = None
    targetCustomerIds: list[str] = []
    contentVariants: list[dict] = []
    customerCount: int = 0
    segments: list[dict] = []
    segmentVariants: dict = {}
    banditSelections: dict = {}
    twinResults: list[dict] = []
    campaignIds: dict = {}
    campaignReady: bool = False
    elapsedSeconds: float = 0
    steps: list[dict] = []


# ═══════════════════════════════════════════════════════════════
#  APP
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title="CampaignX Agent Service",
    description="Python-based multi-agent pipeline for CampaignX",
    version="1.0.0",
)

# Allow the Next.js dev server to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "service": "campaignx-agent"}


@app.post("/run_campaign")
async def run_campaign(req: RunCampaignRequest):
    """Run the full multi-agent campaign pipeline and stream logs."""
    if not req.brief or not req.brief.strip():
        raise HTTPException(status_code=400, detail="Missing required field: brief")

    session_id = create_session()

    # 1. Run pipeline in background
    task = asyncio.create_task(run_campaign_pipeline(req.brief.strip(), session_id))

    # 2. Stream logs, then yield result
    async def event_generator():
        # Stream intermediate logs
        async for entry in stream_logs(session_id):
            payload = json.dumps(entry, default=str)
            yield f"event: step\ndata: {payload}\n\n"

        # Logs are done, so the pipeline task must be finished.
        try:
            result = await task
            # Ensure session ID is in the result
            result["sessionId"] = session_id
            yield f"event: result\ndata: {json.dumps(result, default=str)}\n\n"
            yield f"event: done\ndata: {{}}\n\n"
        except Exception as e:
            err = {"error": "Pipeline failed", "message": str(e)}
            yield f"event: error\ndata: {json.dumps(err)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/optimize_campaign")
async def optimize_campaign(req: OptimizeCampaignRequest):
    """Run the optimization loop for an existing campaign."""
    if not req.campaignId:
        raise HTTPException(status_code=400, detail="Missing required field: campaignId")
    if not req.approvedSuggestions:
        raise HTTPException(status_code=400, detail="At least one approved suggestion is required")

    session_id = create_session()

    try:
        report = await run_optimization_pipeline(
            req.campaignId,
            req.approvedSuggestions,
            session_id,
        )
        return {"sessionId": session_id, **report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agent_logs/{session_id}")
async def agent_logs(session_id: str):
    """
    SSE endpoint — streams structured agent logs in real-time.

    Event format:
        event: step
        data: {"agent": "...", "thought": "...", "action": "...", "timestamp": "..."}

    Final event:
        event: done
        data: {}
    """
    async def event_generator():
        async for entry in stream_logs(session_id):
            payload = json.dumps(entry, default=str)
            yield f"event: step\ndata: {payload}\n\n"
        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("agents.server:app", host="0.0.0.0", port=8000, reload=True)
