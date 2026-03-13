"""
CampaignX External REST API client.
Wraps the InXiteOut platform endpoints:
  - GET  /api/v1/get_customer_cohort
  - POST /api/v1/send_campaign
  - GET  /api/v1/get_report?campaign_id=<uuid>
"""

from __future__ import annotations
import httpx
from agents.config import CAMPAIGNX_BASE_URL, require_env


ENDPOINTS = {
    "cohort": {"method": "GET",  "path": "/api/v1/get_customer_cohort"},
    "send":   {"method": "POST", "path": "/api/v1/send_campaign"},
    "report": {"method": "GET",  "path": "/api/v1/get_report"},
}


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
    ep = ENDPOINTS[endpoint]
    url = f"{CAMPAIGNX_BASE_URL}{ep['path']}"
    headers = _get_headers()

    async with httpx.AsyncClient(timeout=timeout) as client:
        if ep["method"] == "GET":
            resp = await client.get(url, headers=headers, params=query or {})
        else:
            resp = await client.post(url, headers=headers, json=body or {})

    if resp.status_code != 200:
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
    payload = {
        "subject": subject,
        "body": body,
        "list_customer_ids": customer_ids,
        "send_time": send_time,
    }
    return await _campaignx_request("send", body=payload)


async def fetch_campaign_report(campaign_id: str) -> dict:
    """Fetch the performance report for a given campaign ID."""
    return await _campaignx_request("report", query={"campaign_id": campaign_id})
