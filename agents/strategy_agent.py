"""
Targeting / Strategy Agent — LangGraph Node
============================================
Uses Gemini to analyze the brief + CRM segments and produce
a targeting strategy. Now segment-aware.

Corresponds to: `plan_strategy` node in langgraph.js
"""

from __future__ import annotations
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from agents.state import WorkflowState
from agents.config import GEMINI_API_KEY, GEMINI_MODEL


def _get_model() -> ChatGoogleGenerativeAI:
    if not GEMINI_API_KEY:
        raise EnvironmentError("Missing GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.7,
    )


def _parse_json(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found")
    return json.loads(text[start : end + 1])


async def plan_strategy(state: WorkflowState) -> dict:
    """
    LangGraph node: Use Gemini to determine targeting strategy per segment.
    """
    print(f"[Strategy Agent] Starting — {len(state.get('segments', []))} segments available")

    llm = _get_model()
    segments = state.get("segments", [])
    crm_data = state.get("crm_data", [])

    # Build segment summary for the LLM
    segment_summary = "\n".join(
        f"  - {s['segment_name']}: {s['size']} customers ({s['criteria']})"
        for s in segments
    )

    response = await llm.ainvoke([
        SystemMessage(content=(
            "You are a BFSI AI targeting strategist. "
            "Analyze the brief and the customer segments below. "
            "For each segment, explain WHY this segment should receive this campaign "
            "and what angle would resonate most with them. "
            "Return JSON with: "
            "1. `strategy`: 4-6 bullet points covering the overall multi-segment strategy. "
            "2. `strategyReasoning`: Detailed explanation of the targeting approach. "
            "3. `segmentPriority`: array of segment IDs ordered by expected conversion (highest first)."
        )),
        HumanMessage(content=(
            f"Campaign brief:\n{state.get('brief', '')}\n\n"
            f"Customer Segments:\n{segment_summary}\n\n"
            f"Total customers: {len(crm_data)}\n"
            f"Return strict JSON."
        )),
    ])

    output = response.content if isinstance(response.content, str) else str(response.content)

    try:
        parsed = _parse_json(output)
    except Exception:
        parsed = {
            "strategy": "* Target all segments with personalized content\n* Prioritize high-value professionals\n* Use segment-specific tones\n* Monitor per-segment engagement",
            "strategyReasoning": "Multi-segment targeting with personalized content per group.",
            "segmentPriority": [s["segment_id"] for s in segments],
        }

    strategy = parsed.get("strategy", "")
    if isinstance(strategy, list):
        strategy = "\n".join(f"* {s}" for s in strategy)

    print(f"[Strategy Agent] Finished — strategy generated for {len(segments)} segments")

    return {
        "brief": state.get("brief", ""),
        "strategy": strategy,
        "strategy_reasoning": parsed.get("strategyReasoning", "Multi-segment targeting strategy."),
        "content_variants": state.get("content_variants", []),
        "crm_data": crm_data,
        "customer_count": state.get("customer_count", 0),
        "target_customer_ids": state.get("target_customer_ids", []),
        "segments": segments,
        "segment_variants": state.get("segment_variants", {}),
        "steps": [
            {
                "agent": "Strategy-Agent",
                "step": f"Multi-segment strategy generated for {len(segments)} audience groups.",
            }
        ],
    }
