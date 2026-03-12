"""
CampaignX API discovery from local hackathon documentation.

This keeps the execution path documentation-driven instead of baking the
CampaignX endpoint paths directly into the API client.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import re
from typing import TypedDict

from .config import CAMPAIGNX_BASE_URL


class CampaignXEndpoint(TypedDict):
    method: str
    path: str
    source: str


class CampaignXSpec(TypedDict):
    base_url: str
    endpoints: list[CampaignXEndpoint]
    source: str


ROOT_DIR = Path(__file__).resolve().parent.parent
API_DOC_PDF = ROOT_DIR / "CampaignX API v1.pdf"
README_DOC = ROOT_DIR / "README.md"

DEFAULT_BASE_URL = "https://campaignx.inxiteout.ai"
DEFAULT_ENDPOINTS: list[CampaignXEndpoint] = [
    {"method": "POST", "path": "/api/v1/signup", "source": "fallback"},
    {"method": "GET", "path": "/api/v1/get_customer_cohort", "source": "fallback"},
    {"method": "POST", "path": "/api/v1/send_campaign", "source": "fallback"},
    {"method": "GET", "path": "/api/v1/get_report", "source": "fallback"},
]

OPERATION_HINTS: dict[str, tuple[str, ...]] = {
    "signup": ("signup",),
    "cohort": ("get_customer_cohort", "customer_cohort", "customer cohort"),
    "send": ("send_campaign", "send campaign"),
    "report": ("get_report", "get report", "report"),
}


def _extract_text_from_pdf(path: Path) -> str:
    if not path.exists():
        return ""

    try:
        from PyPDF2 import PdfReader
    except Exception:
        return ""

    try:
        reader = PdfReader(str(path))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        return ""


def _extract_text_from_markdown(path: Path) -> str:
    if not path.exists():
        return ""

    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def _normalize_path(raw_path: str) -> str:
    path = raw_path.strip().rstrip(".,:;)")
    if "?" in path:
        path = path.split("?", 1)[0]
    return path


def _dedupe_endpoints(endpoints: list[CampaignXEndpoint]) -> list[CampaignXEndpoint]:
    seen: set[tuple[str, str]] = set()
    deduped: list[CampaignXEndpoint] = []
    for endpoint in endpoints:
        key = (endpoint["method"].upper(), endpoint["path"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(endpoint)
    return deduped


@lru_cache(maxsize=1)
def discover_campaignx_spec() -> CampaignXSpec:
    texts = [
        ("CampaignX API PDF", _extract_text_from_pdf(API_DOC_PDF)),
        ("README", _extract_text_from_markdown(README_DOC)),
    ]

    endpoint_pattern = re.compile(
        r"Endpoint:\s*(GET|POST)\s+(/api/v1/[A-Za-z0-9_/?=&-]+)",
        re.IGNORECASE,
    )
    base_url_pattern = re.compile(r"Base URL:\s*(https?://[^\s]+)", re.IGNORECASE)

    discovered_endpoints: list[CampaignXEndpoint] = []
    discovered_base_url = ""
    discovered_source = "fallback"

    for source_name, text in texts:
        if not text:
            continue

        if not discovered_base_url:
            base_match = base_url_pattern.search(text)
            if base_match:
                discovered_base_url = base_match.group(1).strip()
                discovered_source = source_name

        for match in endpoint_pattern.finditer(text):
            discovered_endpoints.append({
                "method": match.group(1).upper(),
                "path": _normalize_path(match.group(2)),
                "source": source_name,
            })

    endpoints = _dedupe_endpoints(discovered_endpoints) or DEFAULT_ENDPOINTS
    base_url = CAMPAIGNX_BASE_URL or discovered_base_url or DEFAULT_BASE_URL

    return {
        "base_url": base_url.rstrip("/"),
        "endpoints": endpoints,
        "source": discovered_source,
    }


@lru_cache(maxsize=None)
def resolve_campaignx_operation(operation: str) -> CampaignXEndpoint:
    spec = discover_campaignx_spec()
    hints = OPERATION_HINTS.get(operation, (operation,))

    best_match: CampaignXEndpoint | None = None
    best_score = -1

    for endpoint in spec["endpoints"]:
        score = 0
        path_lower = endpoint["path"].lower()
        for hint in hints:
            hint_lower = hint.lower()
            if hint_lower in path_lower:
                score += len(hint_lower)
        if score > best_score:
            best_score = score
            best_match = endpoint

    if best_match:
        return best_match

    for endpoint in DEFAULT_ENDPOINTS:
        if any(hint in endpoint["path"] for hint in hints):
            return endpoint

    raise KeyError(f"Unknown CampaignX operation: {operation}")
