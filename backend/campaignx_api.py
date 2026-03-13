"""
CampaignX External REST API client.
Wraps the InXiteOut platform endpoints:
  - GET  /api/v1/get_customer_cohort
  - POST /api/v1/send_campaign
  - GET  /api/v1/get_report?campaign_id=<uuid>
"""

from __future__ import annotations
import hashlib
import os
from uuid import uuid4
import httpx
from backend.config import CAMPAIGNX_BASE_URL, require_env


ENDPOINTS = {
    "cohort": {"method": "GET",  "path": "/api/v1/get_customer_cohort"},
    "send":   {"method": "POST", "path": "/api/v1/send_campaign"},
    "report": {"method": "GET",  "path": "/api/v1/get_report"},
}

_TEST_CAMPAIGNS: dict[str, list[str]] = {}


def _in_test_mode() -> bool:
    return os.getenv("AGENTS_TEST_MODE", "").strip().lower() in {"1", "true", "yes", "on"}


def _test_customer_cohort() -> dict:
    records = [
        {
            "customer_id": f"TEST-{idx:03d}",
            "Age": age,
            "Gender": gender,
            "Occupation": occupation,
            "Monthly_Income": income,
            "City": city,
            "Marital_Status": marital_status,
            "Credit score": credit_score,
            "KYC status": "verified",
            "App_Installed": "yes",
            "Existing Customer": existing_customer,
            "Social_Media_Active": social_active,
            "Family_Size": family_size,
            "Kids_in_Household": kids,
        }
        for idx, (
            age,
            gender,
            occupation,
            income,
            city,
            marital_status,
            credit_score,
            existing_customer,
            social_active,
            family_size,
            kids,
        ) in enumerate(
            [
                (64, "Female", "Retired Teacher", 82000, "Pune", "Married", 782, "yes", "yes", 2, 0),
                (67, "Female", "Homemaker", 54000, "Mumbai", "Widowed", 741, "yes", "yes", 2, 0),
                (59, "Male", "Business Owner", 240000, "Delhi", "Married", 808, "yes", "no", 4, 1),
                (44, "Male", "Software Engineer", 185000, "Bengaluru", "Married", 771, "yes", "yes", 3, 1),
                (37, "Female", "Doctor", 210000, "Chennai", "Married", 799, "yes", "yes", 3, 1),
                (31, "Male", "Product Manager", 164000, "Gurugram", "Single", 748, "no", "yes", 1, 0),
                (29, "Female", "UX Designer", 126000, "Bengaluru", "Single", 736, "no", "yes", 1, 0),
                (26, "Male", "Analyst", 98000, "Hyderabad", "Single", 712, "no", "yes", 1, 0),
                (52, "Female", "School Principal", 154000, "Ahmedabad", "Married", 768, "yes", "no", 4, 2),
                (47, "Male", "Chartered Accountant", 194000, "Kolkata", "Married", 787, "yes", "yes", 4, 2),
                (34, "Female", "Marketing Lead", 142000, "Noida", "Married", 744, "yes", "yes", 2, 1),
                (41, "Male", "Operations Head", 172000, "Jaipur", "Married", 758, "yes", "no", 3, 2),
            ],
            start=1,
        )
    ]

    return {
        "data": records,
        "total_count": len(records),
        "response_code": 200,
        "message": "test-mode cohort",
    }


def _test_send_campaign(customer_ids: list[str]) -> dict:
    campaign_id = f"test-campaign-{uuid4()}"
    _TEST_CAMPAIGNS[campaign_id] = customer_ids
    return {
        "campaign_id": campaign_id,
        "response_code": 200,
        "invokation_time": "test-mode",
        "message": "campaign scheduled in test mode",
    }


def _test_report(campaign_id: str) -> dict:
    customer_ids = _TEST_CAMPAIGNS.get(campaign_id, [])
    records = []

    for customer_id in customer_ids:
        digest = hashlib.sha256(f"{campaign_id}:{customer_id}".encode("utf-8")).hexdigest()
        open_score = int(digest[:2], 16)
        click_score = int(digest[2:4], 16)
        opened = open_score % 100 < 62
        clicked = opened and click_score % 100 < 27
        records.append(
            {
                "campaign_id": campaign_id,
                "customer_id": customer_id,
                "EO": "Y" if opened else "N",
                "EC": "Y" if clicked else "N",
            }
        )

    return {
        "campaign_id": campaign_id,
        "data": records,
        "total_rows": len(records),
        "response_code": 200,
        "message": "test-mode report",
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
    if _in_test_mode():
        return _test_customer_cohort()
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
    if _in_test_mode():
        return _test_send_campaign(customer_ids)
    payload = {
        "subject": subject,
        "body": body,
        "list_customer_ids": customer_ids,
        "send_time": send_time,
    }
    return await _campaignx_request("send", body=payload)


async def fetch_campaign_report(campaign_id: str) -> dict:
    """Fetch the performance report for a given campaign ID."""
    if _in_test_mode():
        return _test_report(campaign_id)
    return await _campaignx_request("report", query={"campaign_id": campaign_id})
