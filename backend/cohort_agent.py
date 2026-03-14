"""
Cohort Agent — LangGraph Node
=============================
Fetches the full customer CRM from Supabase AND the CampaignX API,
condenses it to targeting fields, and runs the segment engine.

This agent does NOT use an LLM — it's a pure data-fetching + segmentation node.

Corresponds to: `load_cohort` node in langgraph.js
"""

from __future__ import annotations
import asyncio
from backend.state import WorkflowState, CustomerRecord
from backend.segment_engine import segment_customers

async def _fetch_from_api() -> list[dict]:
    """Fetch customer cohort from CampaignX API (richer data)."""
    try:
        from backend.campaignx_api import fetch_customer_cohort
        response = await fetch_customer_cohort()
        return response.get("data", [])
    except Exception as e:
        print(f"[Cohort Agent] CampaignX API fetch failed: {e}")
        return []

def _prepare_crm_data(api_customers: list[dict]) -> list[CustomerRecord]:
    """
    Condense API data to targeting fields.
    """
    records: list[CustomerRecord] = []
    for api in api_customers:
        cid = api.get("customer_id", "")
        if not cid:
            continue

        records.append({
            "id": cid,
            "age": api.get("Age"),
            "gender": api.get("Gender"),
            "occupation": api.get("Occupation"),
            "income": api.get("Monthly_Income"),
            "city": api.get("City"),
            "marital_status": api.get("Marital_Status"),
            "credit_score": api.get("Credit score"),
            "kyc_status": api.get("KYC status"),
            "app_installed": api.get("App_Installed"),
            "existing_customer": api.get("Existing Customer"),
            "social_media_active": api.get("Social_Media_Active"),
            "family_size": api.get("Family_Size"),
            "kids": api.get("Kids_in_Household"),
            "w1": 0.0,
            "w2": 0.0,
            "w3": 0.0,
        })

    return records

async def load_cohort(state: WorkflowState) -> dict:
    """
    LangGraph node: Fetch CRM from both sources, merge, condense, and segment.

    - Fetches from Supabase (weights) + CampaignX API (demographics)
    - Merges and condenses to essential targeting fields
    - Runs segment engine to create 5 micro-segments
    - Sets crm_data, customer_count, segments
    """
    print(f"[Cohort Agent] Starting — brief: {state.get('brief', '')[:80]}...")

    api_customers = await _fetch_from_api()

    print(f"[Cohort Agent] Fetched: {len(api_customers)} records from CampaignX API")

    crm_data = _prepare_crm_data(api_customers)
    customer_count = len(crm_data)

    if not crm_data:
        print("[Cohort Agent] WARNING: Fetched 0 customers!")

    segments = await segment_customers(crm_data, state.get('brief', ''))

    print(f"[Cohort Agent] Finished — {customer_count} customers, {len(segments)} segments")

    return {
        "brief": state.get("brief", ""),
        "strategy": state.get("strategy", ""),
        "strategy_reasoning": state.get("strategy_reasoning", ""),
        "content_variants": state.get("content_variants", []),
        "crm_data": crm_data,
        "customer_count": customer_count,
        "target_customer_ids": [c["id"] for c in crm_data],
        "segments": segments,
        "segment_variants": state.get("segment_variants", {}),
        "steps": [
            {
                "agent": "Cohort-Agent",
                "step": f"Fetched {customer_count} customers (API), created {len(segments)} segments.",
            }
        ],
    }
