"""
CampaignX External REST API client.

Endpoint paths are resolved from the local CampaignX documentation at runtime
so the client stays documentation-driven instead of hardcoding the API surface.
"""

from __future__ import annotations
import httpx
from agents.config import require_env
from .campaignx_discovery import discover_campaignx_spec, resolve_campaignx_operation


def _get_headers() -> dict[str, str]:
    api_key = require_env("CAMPAIGNX_API_KEY")
    return {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
    }


async def _campaignx_request(
    endpoint: str,
    query: dict[str, str] | None = None,
    body: dict | None = None,
    timeout: float = 30.0,
) -> dict:
    """Make a request to the CampaignX API."""
    spec = discover_campaignx_spec()
    ep = resolve_campaignx_operation(endpoint)
    url = f"{spec['base_url']}{ep['path']}"
    headers = _get_headers()

    async with httpx.AsyncClient(timeout=timeout) as client:
        if ep["method"] == "GET":
            resp = await client.get(url, headers=headers, params=query or {})
        else:
            resp = await client.post(url, headers=headers, json=body or {})

    if not 200 <= resp.status_code < 300:
        raise RuntimeError(
            f"CampaignX API error ({resp.status_code}): {resp.text}"
        )
    return resp.json()


# ── Public API ──


async def fetch_customer_cohort() -> dict:
    """Fetch the full customer cohort from CampaignX."""
    return await _campaignx_request("cohort")


async def send_campaign(
    subject: str,
    body: str,
    customer_ids: list[str],
    send_time: str,
) -> dict:
    """
    Send a campaign via CampaignX.
    
    Args:
        subject: Email subject line
        body: Email body content
        customer_ids: List of customer IDs to target
        send_time: Send time in DD:MM:YY HH:MM:SS format
    
    Returns:
        dict with campaign_id, response_code, etc.
    """
    deduped_customer_ids = list(dict.fromkeys(customer_ids))
    payload = {
        "subject": subject,
        "body": body,
        "list_customer_ids": deduped_customer_ids,
        "send_time": send_time,
    }
    return await _campaignx_request("send", body=payload)


async def fetch_campaign_report(campaign_id: str) -> dict:
    """Fetch the performance report for a given campaign ID."""
    return await _campaignx_request("report", query={"campaign_id": campaign_id})
