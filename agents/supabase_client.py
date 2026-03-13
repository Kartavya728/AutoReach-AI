"""
Supabase client for database operations.
Handles:
  - Customer CRM read/write
  - Campaign CRUD
  - Variant storage
  - Optimization suggestions & history
  - Agent trace persistence
"""

from __future__ import annotations
from datetime import datetime, timezone
from supabase import create_client, Client
from agents.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


def _get_client() -> Client:
    """Create a Supabase admin client (service role)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise EnvironmentError(
            "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ── Customers ──


def get_customers() -> list[dict]:
    """Fetch all customers from Supabase, ordered by customer_id."""
    client = _get_client()
    response = (
        client.table("customers")
        .select("*")
        .order("customer_id", desc=False)
        .execute()
    )
    return response.data or []


def upsert_customers(customers: list[dict]) -> list[dict]:
    """Upsert customers by customer_id."""
    client = _get_client()
    response = (
        client.table("customers")
        .upsert(customers, on_conflict="customer_id")
        .execute()
    )
    return response.data or []


def update_customer_weights(customer_id: str, w1: float, w2: float, w3: float):
    """Update engagement weights for a single customer."""
    client = _get_client()
    client.table("customers").update({
        "w1": w1,
        "w2": w2,
        "w3": w3,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("customer_id", customer_id).execute()


def increment_customer_metrics(
    customer_id: str,
    sent: int = 0,
    opened: int = 0,
    clicked: int = 0,
    topic: str | None = None,
):
    """Increment email tracking metrics for a customer."""
    client = _get_client()
    row = (
        client.table("customers")
        .select("emails_sent, emails_opened, emails_clicked, topics_list")
        .eq("customer_id", customer_id)
        .single()
        .execute()
    )
    if not row.data:
        return

    existing = row.data
    new_topics = list(existing.get("topics_list") or [])
    if topic and topic not in new_topics:
        new_topics.append(topic)

    client.table("customers").update({
        "emails_sent": (existing.get("emails_sent") or 0) + sent,
        "emails_opened": (existing.get("emails_opened") or 0) + opened,
        "emails_clicked": (existing.get("emails_clicked") or 0) + clicked,
        "topics_list": new_topics,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("customer_id", customer_id).execute()


# ── Campaigns ──


def get_campaigns() -> list[dict]:
    """List all campaigns with variants, newest first."""
    client = _get_client()
    response = (
        client.table("campaigns")
        .select("*, campaign_variants(*)")
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def get_campaign_by_id(campaign_id: str) -> dict | None:
    """Get a single campaign with its variants."""
    client = _get_client()
    response = (
        client.table("campaigns")
        .select("*, campaign_variants(*)")
        .eq("id", campaign_id)
        .maybe_single()
        .execute()
    )
    return response.data


def create_campaign(payload: dict) -> dict:
    """Create a new campaign, optionally with variants."""
    client = _get_client()
    variants = payload.pop("variants", None)

    response = client.table("campaigns").insert(payload).execute()
    campaign = response.data[0]

    if variants:
        variant_rows = [{**v, "campaign_id": campaign["id"]} for v in variants]
        client.table("campaign_variants").insert(variant_rows).execute()

    # Re-fetch with variants
    return get_campaign_by_id(campaign["id"]) or campaign


def update_campaign(campaign_id: str, payload: dict) -> dict:
    """Update an existing campaign."""
    client = _get_client()
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = (
        client.table("campaigns")
        .update(payload)
        .eq("id", campaign_id)
        .execute()
    )
    return response.data[0] if response.data else {}


# ── Campaign Variants ──


def save_variants(campaign_id: str, variants: list[dict]) -> list[dict]:
    """Replace all variants for a campaign."""
    client = _get_client()
    # Delete existing
    client.table("campaign_variants").delete().eq("campaign_id", campaign_id).execute()
    # Insert new
    rows = [{**v, "campaign_id": campaign_id} for v in variants]
    response = client.table("campaign_variants").insert(rows).execute()
    return response.data or []


# ── Optimization Suggestions ──


def get_optimizations(campaign_id: str) -> list[dict]:
    """Get optimization suggestions for a campaign."""
    client = _get_client()
    response = (
        client.table("optimization_suggestions")
        .select("*")
        .eq("campaign_id", campaign_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


def save_optimizations(campaign_id: str, suggestions: list[dict]) -> list[dict]:
    """Save optimization suggestions."""
    client = _get_client()
    rows = [{**s, "campaign_id": campaign_id} for s in suggestions]
    response = client.table("optimization_suggestions").insert(rows).execute()
    return response.data or []


# ── Optimization History ──


def get_optimization_history(campaign_id: str) -> list[dict]:
    """Get the optimization round history for a campaign."""
    client = _get_client()
    response = (
        client.table("campaign_optimization_history")
        .select("*")
        .eq("campaign_id", campaign_id)
        .order("round", desc=False)
        .execute()
    )
    return response.data or []


def save_optimization_history(history: dict) -> dict:
    """Save a single optimization history entry."""
    client = _get_client()
    response = client.table("campaign_optimization_history").insert(history).execute()
    return response.data[0] if response.data else {}


# ── Agent Traces ──


def persist_agent_trace(trace: dict):
    """Persist an agent execution trace."""
    try:
        client = _get_client()
        client.table("agent_traces").insert(trace).execute()
    except Exception as e:
        print(f"[Supabase] Failed to persist trace: {e}")
