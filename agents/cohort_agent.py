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
from .state import WorkflowState, CustomerRecord
from .segment_engine import segment_customers



async def _fetch_from_api() -> list[dict]:
    """Fetch customer cohort from CampaignX API (richer data)."""
    try:
        from agents.campaignx_api import fetch_customer_cohort
        response = await fetch_customer_cohort()
        return response.get("data", [])
    except Exception as e:
        print(f"[Cohort Agent] CampaignX API fetch failed: {e}")
        return []


def _prepare_crm_data(api_customers: list[dict]) -> list[CustomerRecord]:
    """
    Condense API data to targeting fields, normalize keys, and compute propensity.
    """
    records: list[CustomerRecord] = []
    for api_raw in api_customers:
        # Normalize keys to lowercase for safe lookups
        api = {k.lower(): v for k, v in api_raw.items()}
        
        cid = api.get("customer_id", "")
        if not cid:
            continue

        w1 = float(api.get("w1", 0.0))
        w2 = float(api.get("w2", 0.0))
        w3 = float(api.get("w3", 0.0))

        emails_sent = float(api.get("emails_sent", 0.0) or 0.0)
        emails_opened = float(api.get("emails_opened", 0.0) or 0.0)
        emails_clicked = float(api.get("emails_clicked", 0.0) or 0.0)

        historical_open_rate = (emails_opened / emails_sent) if emails_sent > 0 else 0.0
        historical_click_rate = (emails_clicked / emails_sent) if emails_sent > 0 else 0.0
        engagement_score = min(1.0, (0.4 * historical_open_rate) + (0.6 * historical_click_rate))

        # Propensity Score
        propensity_score = 0.5 * w1 + 0.3 * w2 + 0.2 * w3
            
        records.append({
            "id": cid,
            "name": api.get("full_name") or api.get("name") or "there",
            "age": api.get("age"),
            "gender": api.get("gender"),
            "occupation": api.get("occupation"),
            "occupation_type": api.get("occupation type") or api.get("occupation_type"),
            "income": api.get("monthly_income"),
            "city": api.get("city"),
            "marital_status": api.get("marital_status"),
            "credit_score": api.get("credit score") or api.get("credit_score"),
            "kyc_status": api.get("kyc status") or api.get("kyc_status"),
            "app_installed": api.get("app_installed"),
            "existing_customer": api.get("existing customer") or api.get("existing_customer"),
            "social_media_active": api.get("social_media_active"),
            "family_size": api.get("family_size"),
            "dependent_count": api.get("dependent count") or api.get("dependent_count"),
            "kids": api.get("kids_in_household") or api.get("kids"),
            "w1": w1,
            "w2": w2,
            "w3": w3,
            "propensity_score": propensity_score,
            "engagement_score": engagement_score,
        })

    # Sort descending by propensity to target the best users naturally
    records.sort(key=lambda x: x.get("propensity_score", 0.0), reverse=True)
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

    # Fetch from API
    api_customers = await _fetch_from_api()

    print(f"[Cohort Agent] Fetched: {len(api_customers)} records from CampaignX API")

    # Condense
    crm_data = _prepare_crm_data(api_customers)
    customer_count = len(crm_data)

    if not crm_data:
        print("[Cohort Agent] WARNING: Fetched 0 customers!")

    # Run segment engine
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
