"""
CampaignX Agent System - ReAct Planner/Executor with Human-in-the-Loop
=======================================================================
Pipeline:
  1. Fetch and study customer data
  2. Segment into dynamic approval-ready categories
  3. Generate category-specific emails (War Room + Twin + Bandit)
  4. Human approval gate for generated emails
  5. Run 3 automatic virtual rate prediction rounds
  6. Send campaigns and stream live open/click metrics
  7. Run iterative optimization rounds with human yes/no control

Usage:
    python -m backend.main "<brief>" --rounds 3
    python -m backend.main --rounds 3 --interactive
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import statistics
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.analysis_agent import compute_analysis
from backend.campaignx_api import fetch_campaign_report, fetch_customer_cohort, send_campaign
from backend.content_agent import generate_content, generate_segment_variant
from backend.segment_engine import segment_customers
from backend.state import WorkflowState
from backend.strategy_agent import plan_strategy
from backend.config import GEMINI_API_KEY, GEMINI_MODEL
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from backend.strategist_agent import strategist_agent


DEFAULT_BRIEF = (
    "Run email campaign for launching XDeposit, a flagship term deposit product from "
    "SuperBFSI, that gives 1 percentage point higher returns than its competitors. "
    "Announce an additional 0.25 percentage point higher returns for female senior "
    "citizens. Optimise for open rate and click rate. Don't skip emails to customers "
    "marked 'inactive'. Include the call to action: "
    "https://superbfsi.com/xdeposit/explore/"
)
DEFAULT_OPTIMIZATION_ROUNDS = 10
AUTO_VIRTUAL_PREDICTION_ROUNDS = 3
OUTPUT_FILE = "agent_output.json"
CONTROL_PREFIX = "__AGENT_EVENT__"
IST = timezone(timedelta(hours=5, minutes=30))
URL_RE = re.compile(r"https?://[^\s<>\"]+")

REACT_FORMAT_PROMPT = """Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}
"""


def print_header(title: str):
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78, flush=True)


def iter_exception_chain(exc: BaseException) -> list[BaseException]:
    chain: list[BaseException] = []
    seen: set[int] = set()
    current: BaseException | None = exc
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        chain.append(current)
        next_exc = current.__cause__ or current.__context__
        current = next_exc if isinstance(next_exc, BaseException) else None
    return chain


def describe_runtime_failure(exc: BaseException) -> dict[str, Any]:
    chain = iter_exception_chain(exc)
    messages = " | ".join(str(item) for item in chain if str(item).strip())
    type_names = {type(item).__name__ for item in chain}

    if any("GEMINI_API_KEY" in str(item) for item in chain):
        return {
            "error": "Gemini API key missing",
            "message": "Gemini is not configured for this backend. Set GEMINI_API_KEY in the server environment and try again.",
            "kind": "llm_configuration",
            "provider": "google-genai",
            "model": GEMINI_MODEL,
            "retryable": False,
        }

    if (
        "ConnectError" in type_names
        or "APIConnectionError" in type_names
        or "All connection attempts failed" in messages
    ):
        return {
            "error": "Gemini connection failed",
            "message": (
                f"Gemini is configured but unreachable from this environment, so the campaign run stopped before content generation. "
                f"Check outbound internet access, DNS, firewall or proxy rules, and that model '{GEMINI_MODEL}' is allowed."
            ),
            "kind": "llm_connectivity",
            "provider": "google-genai",
            "model": GEMINI_MODEL,
            "retryable": True,
        }

    return {
        "error": type(exc).__name__ or "Pipeline failure",
        "message": str(exc) or "The campaign pipeline failed unexpectedly.",
        "kind": "pipeline_failure",
        "retryable": False,
    }


def emit_runtime_failure(exc: BaseException):
    payload = describe_runtime_failure(exc)
    envelope = {"event": "error", "data": payload}
    sys.stderr.write(f"{CONTROL_PREFIX}{json.dumps(envelope, ensure_ascii=False)}\n")
    sys.stderr.write(f"{payload['error']}: {payload['message']}\n")
    sys.stderr.flush()


def format_time(dt: datetime) -> str:
    """CampaignX API format: DD:MM:YY HH:MM:SS in IST."""
    return dt.astimezone(IST).strftime("%d:%m:%y %H:%M:%S")


def to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y", "approve", "approved", "continue"}
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def compact_json(data: Any) -> str:
    try:
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return str(data)


def extract_cta_link(brief: str) -> str:
    match = URL_RE.search(brief or "")
    return match.group(0) if match else ""


def ensure_variant_has_link(variant: dict[str, Any], cta_link: str) -> dict[str, Any]:
    if not cta_link:
        return variant

    body = str(variant.get("body", "") or "").strip()
    if cta_link not in body:
        body = f"{body}\n\nExplore now: {cta_link}".strip()
    variant["body"] = body
    variant["cta_link"] = cta_link
    return variant


def collect_target_ids(segments: list[dict[str, Any]]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for seg in segments:
        for raw_id in seg.get("customer_ids", []) or []:
            customer_id = str(raw_id)
            if not customer_id or customer_id in seen:
                continue
            seen.add(customer_id)
            ordered.append(customer_id)
    return ordered


def parse_segment_approvals(
    segments: list[dict[str, Any]],
    response: dict[str, Any],
) -> list[dict[str, Any]]:
    raw_approvals = response.get("segmentApprovals")
    approval_map: dict[str, bool] = {}
    if isinstance(raw_approvals, list):
        for item in raw_approvals:
            if not isinstance(item, dict):
                continue
            segment_id = str(item.get("segmentId", ""))
            if not segment_id:
                continue
            approval_map[segment_id] = to_bool(item.get("approved"), default=True)

    if not approval_map:
        if not to_bool(response.get("approved"), default=True):
            return []
        return segments

    approved_segments: list[dict[str, Any]] = []
    for seg in segments:
        seg_id = str(seg.get("segment_id", ""))
        if approval_map.get(seg_id, True):
            approved_segments.append(seg)
    return approved_segments


def apply_variant_approvals(
    segments: list[dict[str, Any]],
    segment_variants: dict[str, dict[str, Any]],
    response: dict[str, Any],
    cta_link: str,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], list[dict[str, Any]]]:
    raw_variant_approvals = response.get("variantApprovals")
    approval_map: dict[str, bool] = {}
    edit_map: dict[str, dict[str, Any]] = {}

    if isinstance(raw_variant_approvals, list):
        for item in raw_variant_approvals:
            if not isinstance(item, dict):
                continue
            seg_id = str(item.get("segmentId", ""))
            if not seg_id:
                continue
            approval_map[seg_id] = to_bool(item.get("approved"), default=True)
            edit_map[seg_id] = item

    edited_variants = response.get("editedVariants")
    if isinstance(edited_variants, list):
        for item in edited_variants:
            if not isinstance(item, dict):
                continue
            seg_id = str(item.get("segmentId", ""))
            if not seg_id:
                continue
            existing = edit_map.get(seg_id, {})
            existing.update(item)
            edit_map[seg_id] = existing

    approved_segments: list[dict[str, Any]] = []
    approved_variants: dict[str, dict[str, Any]] = {}
    approved_variant_list: list[dict[str, Any]] = []

    for seg in segments:
        seg_id = str(seg.get("segment_id", ""))
        if approval_map and not approval_map.get(seg_id, True):
            continue
        if not approval_map and not to_bool(response.get("approved"), default=True):
            continue

        variant = dict(segment_variants.get(seg_id) or {})
        edits = edit_map.get(seg_id, {})
        if "subject" in edits and edits.get("subject") is not None:
            variant["subject"] = str(edits.get("subject", ""))
        if "body" in edits and edits.get("body") is not None:
            variant["body"] = str(edits.get("body", ""))

        variant = ensure_variant_has_link(variant, cta_link)
        approved_segments.append(seg)
        approved_variants[seg_id] = variant
        approved_variant_list.append(variant)

    return approved_segments, approved_variants, approved_variant_list


async def predict_open_click(
    segments: list[dict[str, Any]],
    segment_variants: dict[str, dict[str, Any]],
    cta_link: str,
) -> dict[str, Any]:
    """LLM-based open/click predictor — fully agentic, no hardcoded rates."""
    total_audience = 0
    predicted_opened = 0
    predicted_clicked = 0
    by_segment: list[dict[str, Any]] = []

    try:
        from backend.config import GEMINI_API_KEY, GEMINI_MODEL
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        llm = ChatGoogleGenerativeAI(
            api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL or "gemini-2.5-flash",
            temperature=0.1,
        )

        for seg in segments:
            seg_id = str(seg.get("segment_id", ""))
            audience = int(seg.get("size", 0))
            if audience <= 0:
                continue

            variant = segment_variants.get(seg_id) or {}
            subject = str(variant.get("subject", ""))
            body = str(variant.get("body", ""))
            tone = str(variant.get("tone", seg.get("tone", "professional")))
            segment_name = str(seg.get("segment_name", ""))
            has_cta = cta_link in body if cta_link else False

            prompt = f"""You are an email marketing analytics expert predicting campaign performance.

Segment: {segment_name} ({audience} customers)
Tone: {tone}
Subject line: "{subject}"
Body length: {len(body)} chars
CTA link present: {has_cta}
Body preview: {body[:300]}

Based on the subject line quality, body persuasiveness, CTA clarity, and audience type,
predict the open rate and click rate as percentages.

Return ONLY a JSON object: {{"open_rate": <number>, "click_rate": <number>}}
"""
            try:
                resp = await llm.ainvoke([HumanMessage(content=prompt)])
                content = str(resp.content).strip()
                start = content.find("{")
                end = content.rfind("}")
                if start != -1 and end > start:
                    import json as _json
                    parsed = _json.loads(content[start:end + 1])
                    seg_open = max(1.0, min(95.0, float(parsed.get("open_rate", 25))))
                    seg_click = max(0.5, min(seg_open * 0.8, float(parsed.get("click_rate", 5))))
                else:
                    seg_open, seg_click = 25.0, 5.0
            except Exception:
                seg_open, seg_click = 25.0, 5.0

            opened = min(audience, round(audience * seg_open / 100))
            clicked = min(opened, round(audience * seg_click / 100))
            total_audience += audience
            predicted_opened += opened
            predicted_clicked += clicked
            by_segment.append(
                {
                    "segmentId": seg_id,
                    "segmentName": segment_name,
                    "audience": audience,
                    "predictedOpenRate": round(seg_open, 1),
                    "predictedClickRate": round(seg_click, 1),
                }
            )
    except Exception:
        # Graceful fallback if LLM is unavailable
        for seg in segments:
            audience = int(seg.get("size", 0))
            if audience <= 0:
                continue
            total_audience += audience
            predicted_opened += round(audience * 0.25)
            predicted_clicked += round(audience * 0.05)

    open_rate = round((predicted_opened / total_audience) * 100, 1) if total_audience else 0.0
    click_rate = round((predicted_clicked / total_audience) * 100, 1) if total_audience else 0.0
    return {
        "audience": total_audience,
        "total_opened": predicted_opened,
        "total_clicked": predicted_clicked,
        "open_rate": open_rate,
        "click_rate": click_rate,
        "by_segment": by_segment,
    }


class RuntimeChannel:
    """Prints human-readable logs and emits structured control events for websocket runtime."""

    def __init__(self, interactive: bool):
        self.interactive = interactive
        self.background_mode = False

    def set_background_mode(self, enabled: bool):
        self.background_mode = enabled

    def log(self, message: str, *, background_visible: bool | None = None):
        if self.background_mode and background_visible is not True:
            return
        encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
        safe_message = message.encode(encoding, errors="replace").decode(encoding, errors="replace")
        print(safe_message, flush=True)

    def emit_event(self, event: str, data: dict[str, Any]):
        envelope = {"event": event, "data": data}
        sys.stderr.write(f"{CONTROL_PREFIX}{json.dumps(envelope, ensure_ascii=False)}\n")
        sys.stderr.flush()

    def emit_thinking(
        self,
        step: str,
        agent: str = "ReAct-Agent",
        kind: str = "status",
        *,
        background_visible: bool | None = None,
    ):
        if self.background_mode and background_visible is not True:
            return
        self.emit_event(
            "thinking",
            {
                "agent": agent,
                "step": step,
                "kind": kind,
            },
        )

    async def wait_for_human(
        self,
        pause_type: str,
        payload: dict[str, Any],
        auto_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not self.interactive:
            response = auto_payload or {"approved": True, "continueOptimization": False}
            self.log(
                f"[HITL] Interactive mode off. Auto-response for '{pause_type}': {response}",
                background_visible=True,
            )
            return response

        self.emit_thinking(
            f"Waiting for human input on {pause_type.replace('_', ' ')}.",
            agent="Human-Gate",
            kind="pause",
            background_visible=True,
        )
        self.emit_event(
            "pause",
            {
                "pauseType": pause_type,
                **payload,
            },
        )

        self.log(f"[HITL] Waiting for human input: {pause_type}", background_visible=True)

        while True:
            line = await asyncio.to_thread(sys.stdin.readline)
            if line is None:
                await asyncio.sleep(0.05)
                continue

            text = line.strip()
            if not text:
                await asyncio.sleep(0.05)
                continue

            try:
                message = json.loads(text)
            except json.JSONDecodeError:
                self.log(f"[HITL] Ignoring non-JSON input: {text[:120]}", background_visible=True)
                continue

            if str(message.get("type", "")) != "human_input":
                continue

            if str(message.get("pauseType", "")) != pause_type:
                self.log(
                    f"[HITL] Ignoring input for pause '{message.get('pauseType')}', "
                    f"current pause is '{pause_type}'.",
                    background_visible=True,
                )
                continue

            self.log(f"[HITL] Received input for '{pause_type}'.", background_visible=True)
            self.emit_thinking(
                f"Received human response for {pause_type.replace('_', ' ')}.",
                agent="Human-Gate",
                kind="resume",
                background_visible=True,
            )
            return message


# -----------------------------------------------------------------------------
# Data/Tool Helpers
# -----------------------------------------------------------------------------


def prepare_crm_data(api_customers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for api in api_customers:
        customer_id = api.get("customer_id")
        if not customer_id:
            continue

        records.append(
            {
                "id": str(customer_id),
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
            }
        )

    return records


def build_initial_state(brief: str) -> WorkflowState:
    return {
        "brief": brief,
        "cta_link": extract_cta_link(brief),
        "crm_data": [],
        "customer_count": 0,
        "target_customer_ids": [],
        "strategy_reasoning": "",
        "strategy": "",
        "content_variants": [],
        "segments": [],
        "segment_variants": {},
        "steps": [{"agent": "Orchestrator", "step": "Initialized ReAct planner-executor workflow."}],
    }


def summarize_customers(crm_data: list[dict[str, Any]]) -> dict[str, Any]:
    ages = [float(c["age"]) for c in crm_data if c.get("age") is not None]
    incomes = [float(c["income"]) for c in crm_data if c.get("income") is not None]
    top_cities: dict[str, int] = {}
    top_occupations: dict[str, int] = {}

    for c in crm_data:
        city = str(c.get("city") or "Unknown")
        occ = str(c.get("occupation") or "Unknown")
        top_cities[city] = top_cities.get(city, 0) + 1
        top_occupations[occ] = top_occupations.get(occ, 0) + 1

    sorted_cities = sorted(top_cities.items(), key=lambda x: x[1], reverse=True)[:4]
    sorted_occ = sorted(top_occupations.items(), key=lambda x: x[1], reverse=True)[:4]

    return {
        "total": len(crm_data),
        "avg_age": round(statistics.mean(ages), 1) if ages else None,
        "avg_income": round(statistics.mean(incomes), 0) if incomes else None,
        "top_cities": sorted_cities,
        "top_occupations": sorted_occ,
    }


def determine_dynamic_category_target(
    crm_data: list[dict[str, Any]],
) -> int:
    """Choose a category floor from the richness and size of the real customer data."""
    total = len(crm_data)
    if total == 0:
        return 3

    candidate_fields = [
        "age",
        "income",
        "occupation",
        "city",
        "marital_status",
        "gender",
        "credit_score",
        "kyc_status",
        "app_installed",
        "existing_customer",
        "social_media_active",
        "family_size",
        "kids",
    ]

    informative_fields = 0
    for field in candidate_fields:
        values = [c.get(field) for c in crm_data if c.get(field) not in (None, "", "Unknown")]
        if not values:
            continue

        unique_values = {str(v).strip() for v in values if str(v).strip()}
        coverage = len(values) / total
        if coverage >= 0.2 and len(unique_values) >= 2:
            informative_fields += 1

    target = 3 if total < 40 else 4
    if total >= 250 and informative_fields >= 4:
        target += 1
    if total >= 750 and informative_fields >= 6:
        target += 1
    if total >= 1500 and informative_fields >= 8:
        target += 1

    return min(8, target)


def ensure_minimum_categories(
    segments: list[dict[str, Any]],
    min_count: int = 3,
) -> list[dict[str, Any]]:
    """Guarantee at least `min_count` categories while preserving all customers."""
    clean = [dict(seg) for seg in segments if int(seg.get("size", 0)) > 0]

    if not clean:
        return []

    # If fewer than min_count, split the largest segments until we reach min_count.
    while len(clean) < min_count:
        largest_idx = max(range(len(clean)), key=lambda i: int(clean[i].get("size", 0)))
        largest = clean[largest_idx]
        ids = [str(x) for x in largest.get("customer_ids", [])]

        if len(ids) <= 1:
            clean.append(
                {
                    "segment_id": f"category_{len(clean) + 1}_empty",
                    "segment_name": f"Category {len(clean) + 1}",
                    "customer_ids": [],
                    "size": 0,
                    "criteria": "No eligible customers in this split",
                    "tone": "neutral",
                    "focus": "n/a",
                    "emoji_level": "none",
                    "tier": "Reactivate",
                }
            )
            continue

        midpoint = len(ids) // 2
        first_half = ids[:midpoint]
        second_half = ids[midpoint:]

        largest["customer_ids"] = first_half
        largest["size"] = len(first_half)

        new_seg = {
            "segment_id": f"{largest.get('segment_id', 'segment')}_split_{len(clean) + 1}",
            "segment_name": f"{largest.get('segment_name', 'Segment')} - Split {len(clean) + 1}",
            "customer_ids": second_half,
            "size": len(second_half),
            "criteria": str(largest.get("criteria", "")),
            "tone": str(largest.get("tone", "friendly")),
            "focus": str(largest.get("focus", "")),
            "emoji_level": str(largest.get("emoji_level", "moderate")),
            "tier": str(largest.get("tier", "Reactivate")),
        }
        clean.append(new_seg)

    return clean


def category_cards(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for seg in segments:
        cards.append(
            {
                "segmentId": str(seg.get("segment_id", "")),
                "name": str(seg.get("segment_name", "Segment")),
                "size": int(seg.get("size", 0)),
                "criteria": str(seg.get("criteria", "")),
                "tone": str(seg.get("tone", "")),
                "focus": str(seg.get("focus", "")),
                "tier": str(seg.get("tier", "Reactivate")),
                "approved": True,
            }
        )
    return cards


def content_cards(
    segments: list[dict[str, Any]],
    segment_variants: dict[str, dict[str, Any]],
    cta_link: str = "",
) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for seg in segments:
        seg_id = str(seg.get("segment_id", ""))
        variant = ensure_variant_has_link(dict(segment_variants.get(seg_id) or {}), cta_link)
        cards.append(
            {
                "segmentId": seg_id,
                "segmentName": str(seg.get("segment_name", "Segment")),
                "size": int(seg.get("size", 0)),
                "subject": str(variant.get("subject", "")),
                "body": str(variant.get("body", "")),
                "tone": str(variant.get("tone", seg.get("tone", "professional"))),
                "tags": [str(x) for x in variant.get("tags", [])] if isinstance(variant.get("tags"), list) else [],
                "ctaLink": cta_link,
                "approved": True,
            }
        )
    return cards


async def predicted_send_time(segment_name: str) -> str:
    """Uses LLM to estimate the best time of day to send based on segment name."""
    now_utc = datetime.now(timezone.utc)
    
    prompt = (
        f"You are a behavioral email marketer. What is the single best hour of the day (in UTC 0-23 format) "
        f"to send an email to a customer segment named: '{segment_name}'?\n"
        f"Assume young professionals check early/late, seniors check very early, businesses check mid-day.\n"
        f"Reply ONLY with a single integer representing the hour (0-23). Nothing else."
    )
    
    try:
        llm = ChatGoogleGenerativeAI(
            api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL or "gemini-2.5-flash",
            temperature=0.1
        )
        resp = await llm.ainvoke([HumanMessage(content=prompt)])
        hour = int(resp.content.strip())
        hour = max(0, min(23, hour))
    except Exception:
        hour = (now_utc.hour + 1) % 24
        
    slot = now_utc.replace(hour=hour, minute=0, second=0, microsecond=0)
    
    if slot <= now_utc:
        slot += timedelta(days=1)
        
    return format_time(slot)


async def send_segment(
    segment_name: str,
    variant: dict[str, Any],
    customer_ids: list[str],
    send_time_str: str,
    channel: RuntimeChannel,
) -> list[str]:
    if not customer_ids:
        return []

    batch_size = 1000
    campaign_ids: list[str] = []
    total_batches = (len(customer_ids) + batch_size - 1) // batch_size

    for i in range(0, len(customer_ids), batch_size):
        batch = customer_ids[i : i + batch_size]
        batch_num = i // batch_size + 1
        channel.log(
            f"[Dispatch] {segment_name}: batch {batch_num}/{total_batches} ({len(batch)} customers)"
        )
        response = await send_campaign(
            subject=str(variant.get("subject", "Campaign")),
            body=str(variant.get("body", "")),
            customer_ids=batch,
            send_time=send_time_str,
        )
        campaign_id = response.get("campaign_id")
        if campaign_id:
            campaign_ids.append(str(campaign_id))

    return campaign_ids


async def fetch_segment_metrics(
    segment_name: str,
    segment_id: str,
    campaign_ids: list[str],
    customer_ids: list[str],
    variant: dict[str, Any],
    channel: RuntimeChannel,
) -> dict[str, Any]:
    records: list[dict[str, Any]] = []

    if campaign_ids:
        for campaign_id in campaign_ids:
            batch_records: list[dict[str, Any]] = []
            for _ in range(12):
                try:
                    response = await fetch_campaign_report(campaign_id)
                    batch_records = response.get("data", []) or []
                except Exception as exc:
                    channel.log(f"[Metrics] report fetch failed for {segment_name}: {exc}")
                    await asyncio.sleep(2)
                    continue

                if batch_records:
                    break
                await asyncio.sleep(2)

            records.extend(batch_records)

    if not records and customer_ids:
        records = [{"customer_id": cid, "EO": "N", "EC": "N"} for cid in customer_ids]

    analysis = compute_analysis(campaign_ids[0] if campaign_ids else segment_id, records)

    return {
        "segment_id": segment_id,
        "segment_name": segment_name,
        "campaign_ids": campaign_ids,
        "customer_ids": customer_ids,
        "total_sent": int(analysis.get("total_sent", 0)),
        "total_opened": int(analysis.get("total_opened", 0)),
        "total_clicked": int(analysis.get("total_clicked", 0)),
        "open_rate": float(analysis.get("open_rate", 0.0)),
        "click_rate": float(analysis.get("click_rate", 0.0)),
        "opened_ids": [str(x) for x in analysis.get("opened_ids", [])],
        "clicked_ids": [str(x) for x in analysis.get("clicked_ids", [])],
        "variant_used": variant,
    }


def aggregate_metrics(segment_results: list[dict[str, Any]]) -> dict[str, Any]:
    sent = sum(int(item.get("total_sent", 0)) for item in segment_results)
    opened = sum(int(item.get("total_opened", 0)) for item in segment_results)
    clicked = sum(int(item.get("total_clicked", 0)) for item in segment_results)

    open_rate = round((opened / sent) * 100, 1) if sent > 0 else 0.0
    click_rate = round((clicked / sent) * 100, 1) if sent > 0 else 0.0

    return {
        "sent": sent,
        "opened": opened,
        "clicked": clicked,
        "open_rate": open_rate,
        "click_rate": click_rate,
    }


# -----------------------------------------------------------------------------
# ReAct Planner / Executor
# -----------------------------------------------------------------------------


async def run_react_planner_executor(
    brief: str,
    rounds: int,
    channel: RuntimeChannel,
) -> dict[str, Any]:
    """Deterministic planner/executor that logs with ReAct Action format."""

    state = build_initial_state(brief)

    def emit_react(kind: str, text: str):
        kind_lower = kind.lower()
        agent = "ReAct-Agent"
        if kind_lower == "action":
            agent = "Tool-Executor"
        elif kind_lower == "final":
            agent = "Orchestrator"
        elif kind_lower == "observation":
            agent = "Analyzer"
        channel.emit_thinking(text, agent=agent, kind=kind_lower)

    tools = {
        "fetch_customers": "Fetch CRM cohort from CampaignX API",
        "study_customers": "Analyze distributions and top cohorts",
        "segment_customers": "Generate actionable customer categories",
        "plan_strategy": "Build strategy for segmented audience",
        "generate_emails": "Generate one email per segment using War Room + Twin + Bandit",
    }

    channel.log(REACT_FORMAT_PROMPT.format(
        tools=compact_json(tools),
        tool_names=", ".join(tools.keys()),
        input=brief,
        agent_scratchpad="",
    ).strip())

    # Action 1: fetch_customers
    emit_react("thought", "I need customer records before any planning.")
    channel.log("Thought: I need customer records before any planning.")
    emit_react("action", "Fetching customer cohort from CampaignX API.")
    channel.log("Action: fetch_customers")
    channel.log("Action Input: {\"source\": \"CampaignX API\"}")

    raw = await fetch_customer_cohort()
    api_customers = raw.get("data", []) if isinstance(raw, dict) else []
    crm_data = prepare_crm_data(api_customers)
    state["crm_data"] = crm_data
    state["customer_count"] = len(crm_data)
    state["target_customer_ids"] = [str(c.get("id", "")) for c in crm_data if c.get("id")]

    emit_react("observation", f"Fetched {len(crm_data)} customers.")
    channel.log(f"Observation: Fetched {len(crm_data)} customers.")

    # Action 2: study_customers
    emit_react("thought", "I should inspect the customer distribution before creating categories.")
    channel.log("Thought: I should inspect the customer distribution before creating categories.")
    emit_react("action", "Profiling age, income, city, and occupation distributions.")
    channel.log("Action: study_customers")
    channel.log("Action Input: {\"fields\": [\"age\", \"income\", \"city\", \"occupation\"]}")

    profile = summarize_customers(crm_data)
    state["customer_profile"] = profile  # runtime-only key

    emit_react(
        "observation",
        (
            f"Customer profile ready. Total={profile['total']}, avg age={profile.get('avg_age')}, "
            f"avg income={profile.get('avg_income')}."
        ),
    )
    channel.log(
        "Observation: "
        f"Total={profile['total']}, avg_age={profile.get('avg_age')}, "
        f"avg_income={profile.get('avg_income')}, top_cities={profile.get('top_cities')}"
    )

    # Action 3: segment_customers
    desired_category_count = determine_dynamic_category_target(crm_data)

    emit_react("thought", "I now segment customers into approval-ready categories.")
    channel.log("Thought: I now segment customers into approval-ready categories.")
    emit_react(
        "action",
        f"Generating customer categories dynamically from the data profile (target floor: {desired_category_count}).",
    )
    channel.log("Action: segment_customers")
    channel.log(f"Action Input: {compact_json({'target_floor': desired_category_count, 'mode': 'dynamic'})}")

    current_brief = brief
    while True:
        segments = await segment_customers(crm_data, current_brief)
        segments = ensure_minimum_categories(segments, min_count=desired_category_count)

        state["segments"] = segments

        emit_react(
            "observation",
            f"Built {len(segments)} categories and prepared them for human approval."
        )
        channel.log(
            "Observation: "
            f"Built {len(segments)} categories with sizes {[int(s.get('size', 0)) for s in segments]}."
        )

        # Human gate: category approval
        cards = category_cards(segments)
        category_input = await channel.wait_for_human(
            "segment_approval",
            {
                "title": "Approve customer categories",
                "message": f"Review the {len(segments)} categories. Rejected categories will be excluded from the audience and later rate calculations.",
                "segments": cards,
                "ctaLink": state.get("cta_link", ""),
            },
            auto_payload={"approved": True},
        )
        approved_segments = parse_segment_approvals(segments, category_input)
        if approved_segments:
            segments = approved_segments
            break

        channel.log("[HITL] Human rejected the categories. Retrying category generation.")
        emit_react("observation", "Human rejected the proposed categories. I must rethink and generate a new set of categories.")
        channel.emit_thinking("Categories rejected. Re-analyzing customer data to propose alternative categories.", agent="Orchestrator", kind="decision")
        
        # Append feedback to the brief to encourage different generation
        current_brief += "\n\nFeedback: The previous categories were rejected. Please generate entirely DIFFERENT categories this time."

    state["segments"] = segments
    approved_ids = collect_target_ids(segments)
    state["target_customer_ids"] = approved_ids
    state["customer_count"] = len(approved_ids)
    channel.emit_thinking(
        f"{len(segments)} categories approved for {len(approved_ids)} total customers.",
        agent="Human-Gate",
        kind="decision",
    )
    channel.log(f"[HITL] Approved {len(segments)} categories covering {len(approved_ids)} customers.")

    # Action 4: plan_strategy
    emit_react("thought", "With approved segments, I can produce the campaign strategy.")
    channel.log("Thought: With approved segments, I can produce the campaign strategy.")
    emit_react("action", "Planning segment-aware campaign strategy.")
    channel.log("Action: plan_strategy")
    channel.log("Action Input: {\"use_segment_context\": true}")

    strategy_result = await plan_strategy(state)
    state["strategy"] = str(strategy_result.get("strategy", ""))
    state["strategy_reasoning"] = str(strategy_result.get("strategy_reasoning", ""))

    emit_react("observation", "Strategy generated for all approved categories.")
    channel.log("Observation: Strategy generated for approved categories.")

    # Action 5: generate_emails
    emit_react("thought", "Next I need one optimized email for each approved category.")
    channel.log("Thought: Next I need one optimized email for each approved category.")
    emit_react("action", "Generating segment emails with War Room, Bandit, and Twin Simulator.")
    channel.log("Action: generate_emails")
    channel.log("Action Input: {\"optimizer\": [\"war_room\", \"twin_simulator\", \"bandit\"]}")

    content_state = await generate_content(
        state,
        emit_progress=lambda payload: channel.emit_event("digital_twin", payload),
        emit_agent_message=lambda agent, step, kind: channel.emit_thinking(step, agent=agent, kind=kind),
    )
    segment_variants = content_state.get("segment_variants", {}) or {}
    state["segment_variants"] = segment_variants
    state["content_variants"] = content_state.get("content_variants", []) or []

    emit_react(
        "observation",
        f"Generated {len(state['content_variants'])} optimized email drafts."
    )
    channel.log(f"Observation: Generated {len(state['content_variants'])} approved-draft emails.")

    # Human gate: content approval
    cta_link = str(state.get("cta_link", ""))
    mail_cards = content_cards(segments, segment_variants, cta_link)
    content_input = await channel.wait_for_human(
        "content_approval",
        {
            "title": "Approve generated emails",
            "message": "Review each category email, approve or reject each draft, and edit if needed. Every approved email must retain the required CTA link.",
            "variants": mail_cards,
            "ctaLink": cta_link,
        },
        auto_payload={"approved": True},
    )
    segments, segment_variants, approved_variants = apply_variant_approvals(
        segments,
        segment_variants,
        content_input,
        cta_link,
    )
    if not segments:
        raise RuntimeError("No email drafts were approved. Pipeline stopped.")
    state["segments"] = segments
    state["segment_variants"] = segment_variants
    state["content_variants"] = approved_variants
    approved_ids = collect_target_ids(segments)
    state["target_customer_ids"] = approved_ids
    state["customer_count"] = len(approved_ids)
    channel.emit_thinking(
        f"{len(approved_variants)} email drafts approved with CTA link enforcement.",
        agent="Human-Gate",
        kind="decision",
    )
    channel.log(f"[HITL] Approved {len(approved_variants)} email drafts for {len(approved_ids)} customers.")

    predictor_report = await predict_open_click(segments, segment_variants, cta_link)
    state["predicted_metrics"] = predictor_report
    channel.emit_thinking(
        (
            "Open-Click-Predictor forecast: "
            f"{predictor_report['open_rate']}% open, {predictor_report['click_rate']}% click "
            f"across {predictor_report['audience']} approved customers."
        ),
        agent="Open-Click-Predictor",
        kind="metrics",
    )
    channel.log(
        "[Predictor] "
        f"audience={predictor_report['audience']} "
        f"open={predictor_report['open_rate']}% "
        f"click={predictor_report['click_rate']}%"
    )

    emit_react("thought", "I now know the final answer.")
    channel.log("Thought: I now know the final answer")
    emit_react(
        "final",
        "Categories and emails are approved. Starting 3 automatic Virtual Rate Prediction Tool rounds."
    )
    channel.log(
        "Final Answer: Categories and emails are approved. Starting 3 automatic Virtual Rate Prediction Tool rounds."
    )

    # ------------------------------------------------------------------
    # Execute virtual testing rounds
    # ------------------------------------------------------------------
    all_round_metrics: list[dict[str, Any]] = []
    all_segment_results: list[dict[str, Any]] = []
    cumulative_sent: set[str] = set()
    cumulative_opened: set[str] = set()
    cumulative_clicked: set[str] = set()
    total_audience = len(state.get("target_customer_ids", []))
    latest_prediction = dict(state.get("predicted_metrics", {}) or {})
    max_interactive_optimization_rounds = max(0, int(rounds or 0))
    total_round_budget = AUTO_VIRTUAL_PREDICTION_ROUNDS + max_interactive_optimization_rounds

    current_groups: list[dict[str, Any]] = []
    for seg in segments:
        seg_id = str(seg.get("segment_id", ""))
        variant = segment_variants.get(seg_id)
        if not variant:
            continue
        ids = [str(x) for x in seg.get("customer_ids", [])]
        if not ids:
            continue
        current_groups.append(
            {
                "segment_id": seg_id,
                "segment_name": str(seg.get("segment_name", "Segment")),
                "customer_ids": ids,
                "variant": variant,
            }
        )

    if not current_groups:
        raise RuntimeError("No eligible segment groups to send.")

    channel.set_background_mode(True)
    for pipeline_round_num in range(1, total_round_budget + 1):
        is_auto_prediction_round = pipeline_round_num <= AUTO_VIRTUAL_PREDICTION_ROUNDS
        phase = "virtual_prediction" if is_auto_prediction_round else "optimization"
        phase_label = "Virtual Rate Prediction Tool" if is_auto_prediction_round else "Optimization"
        display_round = (
            pipeline_round_num
            if is_auto_prediction_round
            else pipeline_round_num - AUTO_VIRTUAL_PREDICTION_ROUNDS
        )

        if is_auto_prediction_round:
            if not channel.background_mode:
                print_header(f"VIRTUAL RATE PREDICTION TOOL ROUND {display_round}")
            channel.emit_thinking(
                f"Virtual Rate Prediction Tool is running automatic round {display_round} of {AUTO_VIRTUAL_PREDICTION_ROUNDS}.",
                agent="Virtual Rate Prediction Tool",
                kind="action",
            )
        else:
            if not channel.background_mode:
                print_header(f"OPTIMIZATION ROUND {display_round}")
            channel.emit_thinking(
                f"Starting optimization round {display_round}.",
                agent="Optimizer",
                kind="action",
            )

        segment_results: list[dict[str, Any]] = []

        for group in current_groups:
            send_time_str = await predicted_send_time(group["segment_name"])
            channel.emit_thinking(
                f"Sending {group['segment_name']} to {len(group['customer_ids'])} customers.",
                agent="Dispatch-Agent",
                kind="dispatch",
            )
            channel.log(
                f"[Round {pipeline_round_num}] Sending {group['segment_name']} to {len(group['customer_ids'])} customers "
                f"at {send_time_str}"
            )

            campaign_ids = await send_segment(
                group["segment_name"],
                group["variant"],
                group["customer_ids"],
                send_time_str,
                channel,
            )

            metrics = await fetch_segment_metrics(
                group["segment_name"],
                group["segment_id"],
                campaign_ids,
                group["customer_ids"],
                group["variant"],
                channel,
            )
            segment_results.append(metrics)

            cumulative_sent.update(str(cid) for cid in metrics.get("customer_ids", []))
            cumulative_opened.update(str(cid) for cid in metrics.get("opened_ids", []))
            cumulative_clicked.update(str(cid) for cid in metrics.get("clicked_ids", []))

            denom = len(cumulative_sent) if cumulative_sent else (total_audience if total_audience > 0 else 1)
            cumul_open_rate = round((len(cumulative_opened) / denom) * 100, 1)
            cumul_click_rate = round((len(cumulative_clicked) / denom) * 100, 1)

            channel.emit_thinking(
                (
                    f"{group['segment_name']} delivered. "
                    f"Cumulative open {cumul_open_rate}%, click {cumul_click_rate}%."
                ),
                agent="Metrics-Agent",
                kind="metrics",
            )

            channel.emit_event(
                "live_metrics",
                {
                    "round": pipeline_round_num,
                    "phase": phase,
                    "phaseLabel": phase_label,
                    "displayRound": display_round,
                    "optimizationRound": 0 if is_auto_prediction_round else display_round,
                    "virtualPredictionRound": display_round if is_auto_prediction_round else 0,
                    "sent": len(cumulative_sent),
                    "opened": len(cumulative_opened),
                    "clicked": len(cumulative_clicked),
                    "openRate": cumul_open_rate,
                    "clickRate": cumul_click_rate,
                    "uniqueOpened": len(cumulative_opened),
                    "uniqueClicked": len(cumulative_clicked),
                    "predictedOpenRate": float(latest_prediction.get("open_rate", 0.0)),
                    "predictedClickRate": float(latest_prediction.get("click_rate", 0.0)),
                    "bySegment": [
                        {
                            "segmentName": str(item.get("segment_name", "")),
                            "sent": int(item.get("total_sent", 0)),
                            "opened": int(item.get("total_opened", 0)),
                            "clicked": int(item.get("total_clicked", 0)),
                            "openRate": float(item.get("open_rate", 0.0)),
                            "clickRate": float(item.get("click_rate", 0.0)),
                        }
                        for item in segment_results
                    ],
                },
            )

        all_segment_results.extend(segment_results)

        denom = len(cumulative_sent) if cumulative_sent else (total_audience if total_audience > 0 else 1)
        cumul_open_rate = round((len(cumulative_opened) / denom) * 100, 1)
        cumul_click_rate = round((len(cumulative_clicked) / denom) * 100, 1)

        round_summary = {
            "round": pipeline_round_num,
            "phase": phase,
            "phase_label": phase_label,
            "display_round": display_round,
            "optimization_round": 0 if is_auto_prediction_round else display_round,
            "virtual_prediction_round": display_round if is_auto_prediction_round else 0,
            "audience": len(cumulative_sent),
            "open_rate": cumul_open_rate,
            "click_rate": cumul_click_rate,
            "segments": len(segment_results),
            "total_opened": len(cumulative_opened),
            "total_clicked": len(cumulative_clicked),
            "unique_opened": len(cumulative_opened),
            "unique_clicked": len(cumulative_clicked),
            "predicted_open_rate": float(latest_prediction.get("open_rate", 0.0)),
            "predicted_click_rate": float(latest_prediction.get("click_rate", 0.0)),
        }
        all_round_metrics.append(round_summary)
        channel.emit_thinking(
            (
                f"{phase_label} round {display_round} complete. "
                f"Cumulative open {cumul_open_rate}%, click {cumul_click_rate}%."
            ),
            agent="Virtual Rate Prediction Tool" if is_auto_prediction_round else "Optimizer",
            kind="summary",
        )

        channel.emit_event(
            "round_complete",
            {
                "round": pipeline_round_num,
                "phase": phase,
                "phaseLabel": phase_label,
                "displayRound": display_round,
                "optimizationRound": 0 if is_auto_prediction_round else display_round,
                "virtualPredictionRound": display_round if is_auto_prediction_round else 0,
                "summary": {
                    "audience": round_summary["audience"],
                    "openRate": cumul_open_rate,
                    "clickRate": cumul_click_rate,
                    "segments": round_summary["segments"],
                    "totalOpened": round_summary["total_opened"],
                    "totalClicked": round_summary["total_clicked"],
                    "uniqueOpened": round_summary["unique_opened"],
                    "uniqueClicked": round_summary["unique_clicked"],
                    "predictedOpenRate": round_summary["predicted_open_rate"],
                    "predictedClickRate": round_summary["predicted_click_rate"],
                    "phase": phase,
                    "phaseLabel": phase_label,
                    "displayRound": display_round,
                    "optimizationRound": 0 if is_auto_prediction_round else display_round,
                    "virtualPredictionRound": display_round if is_auto_prediction_round else 0,
                },
            },
        )

        # Prepare next optimization round candidates (warm + cold)
        hot_ids: list[str] = []
        warm_ids: list[str] = []
        cold_ids: list[str] = []
        for item in segment_results:
            opened = set(item.get("opened_ids", []))
            clicked = set(item.get("clicked_ids", []))
            customer_ids = set(item.get("customer_ids", []))

            hot_ids.extend(list(clicked))
            warm_ids.extend([cid for cid in opened if cid not in clicked])
            cold_ids.extend([cid for cid in customer_ids if cid not in opened])

        if not hot_ids and not warm_ids and not cold_ids:
            channel.emit_thinking(
                "No additional audience qualified for another background round. Finishing with the current results.",
                agent="Optimizer",
                kind="summary",
                background_visible=True,
            )
            break

        next_is_auto_prediction_round = pipeline_round_num < AUTO_VIRTUAL_PREDICTION_ROUNDS
        next_optimization_round = max(1, pipeline_round_num + 1 - AUTO_VIRTUAL_PREDICTION_ROUNDS)

        if is_auto_prediction_round:
            if pipeline_round_num == AUTO_VIRTUAL_PREDICTION_ROUNDS:
                if max_interactive_optimization_rounds <= 0:
                    channel.emit_thinking(
                        "The 3 automatic virtual rate prediction rounds are complete. No interactive optimization rounds were requested.",
                        agent="Virtual Rate Prediction Tool",
                        kind="decision",
                    )
                    break

                next_round_input = await channel.wait_for_human(
                    "next_round",
                    {
                        "title": f"Start optimization round {next_optimization_round}?",
                        "message": (
                            "The first 3 automatic Virtual Rate Prediction Tool rounds are complete. "
                            "Continue with the next optimization round?"
                        ),
                        "round": next_optimization_round,
                        "maxRounds": max_interactive_optimization_rounds,
                        "metrics": {
                            "audience": round_summary["audience"],
                            "openRate": cumul_open_rate,
                            "clickRate": cumul_click_rate,
                            "totalOpened": round_summary["total_opened"],
                            "totalClicked": round_summary["total_clicked"],
                            "uniqueOpened": round_summary["unique_opened"],
                            "uniqueClicked": round_summary["unique_clicked"],
                            "predictedOpenRate": round_summary["predicted_open_rate"],
                            "predictedClickRate": round_summary["predicted_click_rate"],
                        },
                    },
                    auto_payload={"continueOptimization": False},
                )
                if not to_bool(next_round_input.get("continueOptimization"), default=False):
                    channel.emit_thinking(
                        "Human chose to stop after the automatic Virtual Rate Prediction Tool rounds.",
                        agent="Human-Gate",
                        kind="decision",
                    )
                    channel.log("[Virtual Rate Prediction Tool] Human chose to stop before optimization round 1.")
                    break
            else:
                channel.emit_thinking(
                    f"Auto-continuing to Virtual Rate Prediction Tool round {pipeline_round_num + 1} without human approval.",
                    agent="Virtual Rate Prediction Tool",
                    kind="decision",
                )
        else:
            if display_round >= max_interactive_optimization_rounds:
                break

            next_round_input = await channel.wait_for_human(
                "next_round",
                {
                    "title": f"Run optimization round {display_round + 1}?",
                    "message": "Continue virtual testing with the next approved optimization round.",
                    "round": display_round + 1,
                    "maxRounds": max_interactive_optimization_rounds,
                    "metrics": {
                        "audience": round_summary["audience"],
                        "openRate": cumul_open_rate,
                        "clickRate": cumul_click_rate,
                        "totalOpened": round_summary["total_opened"],
                        "totalClicked": round_summary["total_clicked"],
                        "uniqueOpened": round_summary["unique_opened"],
                        "uniqueClicked": round_summary["unique_clicked"],
                        "predictedOpenRate": round_summary["predicted_open_rate"],
                        "predictedClickRate": round_summary["predicted_click_rate"],
                    },
                },
                auto_payload={"continueOptimization": False},
            )
            if not to_bool(next_round_input.get("continueOptimization"), default=False):
                channel.emit_thinking(
                    f"Human chose to stop after optimization round {display_round}.",
                    agent="Human-Gate",
                    kind="decision",
                )
                channel.log(f"[Optimization Round {display_round}] Human chose to stop.")
                break

        # Build groups for next optimization round.
        next_groups: list[dict[str, Any]] = []
        
        # Helper for past metrics
        if segment_results:
            avg_open = sum(float(r.get("open_rate", 0)) for r in segment_results) / len(segment_results)
            avg_click = sum(float(r.get("click_rate", 0)) for r in segment_results) / len(segment_results)
            ctr = round((avg_click / avg_open * 100), 1) if avg_open > 0 else 0
            prev_variant = segment_results[0].get("variant_used", {})
            past_metrics_base = {
                "open_rate": round(avg_open, 1),
                "click_rate": round(avg_click, 1),
                "ctr": ctr,
                "previous_subject": str(prev_variant.get("subject", "")),
                # Pull constraints from the state memory if available
                "length_constraint": state.get("campaign_memory", {}).get("last_length", "medium"),
                "emoji_constraint": state.get("campaign_memory", {}).get("last_emoji", "some"),
                "send_time": state.get("campaign_memory", {}).get("last_time", "12:00")
            }
            channel.log(
                f"[Strategist] Analyzing Round {pipeline_round_num} metrics: "
                f"{avg_open:.1f}% Open, {avg_click:.1f}% Click (CTR: {ctr}%)"
            )
            meta_strategy = await strategist_agent.analyze_results(past_metrics_base)
            channel.log(f"[Strategist] Diagnosis: {meta_strategy.get('diagnosis', '')}")
            channel.log(
                f"[Strategist] Directives: Length={meta_strategy.get('body_length')}, "
                f"Emojis={meta_strategy.get('emoji_usage')}, Time={meta_strategy.get('send_time')}"
            )
            channel.emit_thinking(
                str(meta_strategy.get("diagnosis", "Prepared the next-round diagnosis.")),
                agent="Campaign Strategist",
                kind="observation",
            )
            channel.emit_thinking(
                (
                    "Next directives: "
                    f"length={meta_strategy.get('body_length', 'medium')}, "
                    f"emojis={meta_strategy.get('emoji_usage', 'some')}, "
                    f"send_time={meta_strategy.get('send_time', '12:00')}, "
                    f"cta={meta_strategy.get('cta_strength', 'direct')}."
                ),
                agent="Campaign Strategist",
                kind="decision",
            )

            if "campaign_memory" not in state:
                state["campaign_memory"] = {}
            state["campaign_memory"]["last_length"] = meta_strategy.get('body_length', 'medium')
            state["campaign_memory"]["last_emoji"] = meta_strategy.get('emoji_usage', 'some')
            state["campaign_memory"]["last_time"] = meta_strategy.get('send_time', '12:00')
            
        else:
            past_metrics_base = None
            meta_strategy = None

        if hot_ids:
            hot_segment = {
                "segment_id": f"hot_r{pipeline_round_num + 1}",
                "segment_name": "Hot Leads Retarget",
                "customer_ids": hot_ids,
                "size": len(hot_ids),
                "criteria": "Clicked the link in previous email",
                "tone": "celebratory",
                "focus": "upsell or next steps",
                "emoji_level": "heavy",
                "tier": "Diamond",
            }
            hot_variant = await generate_segment_variant(
                brief,
                str(state.get("strategy", "")),
                hot_segment,
                cta_link=str(state.get("cta_link", "")),
                emit_progress=None,
                emit_agent_message=None,
                past_metrics=past_metrics_base,
                meta_strategy=meta_strategy,
                verbose=False,
            )
            hot_variant = ensure_variant_has_link(hot_variant, str(state.get("cta_link", "")))
            next_groups.append(
                {
                    "segment_id": hot_segment["segment_id"],
                    "segment_name": hot_segment["segment_name"],
                    "customer_ids": hot_ids,
                    "variant": hot_variant,
                    "criteria": hot_segment["criteria"],
                    "tone": hot_segment["tone"],
                    "focus": hot_segment["focus"],
                    "tier": hot_segment["tier"],
                }
            )

        if warm_ids:
            warm_segment = {
                "segment_id": f"warm_r{pipeline_round_num + 1}",
                "segment_name": "Warm Leads Retarget",
                "customer_ids": warm_ids,
                "size": len(warm_ids),
                "criteria": "Opened previous email but did not click",
                "tone": "urgent",
                "focus": "strong CTA and urgency",
                "emoji_level": "moderate",
                "tier": "Gold",
            }
            warm_past_metrics = past_metrics_base
            warm_variant = await generate_segment_variant(
                brief,
                str(state.get("strategy", "")),
                warm_segment,
                cta_link=str(state.get("cta_link", "")),
                emit_progress=None,
                emit_agent_message=None,
                past_metrics=warm_past_metrics,
                meta_strategy=meta_strategy,
                verbose=False,
            )
            warm_variant = ensure_variant_has_link(warm_variant, str(state.get("cta_link", "")))
            next_groups.append(
                {
                    "segment_id": warm_segment["segment_id"],
                    "segment_name": warm_segment["segment_name"],
                    "customer_ids": warm_ids,
                    "variant": warm_variant,
                    "criteria": warm_segment["criteria"],
                    "tone": warm_segment["tone"],
                    "focus": warm_segment["focus"],
                    "tier": warm_segment["tier"],
                }
            )

        if cold_ids:
            cold_segment = {
                "segment_id": f"cold_r{pipeline_round_num + 1}",
                "segment_name": "Cold Leads Retarget",
                "customer_ids": cold_ids,
                "size": len(cold_ids),
                "criteria": "Did not open previous email",
                "tone": "friendly",
                "focus": "fresh subject line and curiosity",
                "emoji_level": "moderate",
                "tier": "Reactivate",
            }
            # Build past metrics feedback for cold leads
            cold_past_metrics = past_metrics_base
            cold_variant = await generate_segment_variant(
                brief,
                str(state.get("strategy", "")),
                cold_segment,
                cta_link=str(state.get("cta_link", "")),
                emit_progress=None,
                emit_agent_message=None,
                past_metrics=cold_past_metrics,
                meta_strategy=meta_strategy,
                verbose=False,
            )
            cold_variant = ensure_variant_has_link(cold_variant, str(state.get("cta_link", "")))
            next_groups.append(
                {
                    "segment_id": cold_segment["segment_id"],
                    "segment_name": cold_segment["segment_name"],
                    "customer_ids": cold_ids,
                    "variant": cold_variant,
                    "criteria": cold_segment["criteria"],
                    "tone": cold_segment["tone"],
                    "focus": cold_segment["focus"],
                    "tier": cold_segment["tier"],
                }
            )

        if not next_groups:
            channel.log(f"[Round {pipeline_round_num}] No optimization groups generated.")
            break

        next_segments = [
            {
                "segment_id": str(group.get("segment_id", "")),
                "segment_name": str(group.get("segment_name", "Segment")),
                "customer_ids": [str(x) for x in group.get("customer_ids", [])],
                "size": len(group.get("customer_ids", []) or []),
                "criteria": str(group.get("criteria", "")),
                "tone": str(group.get("tone", "professional")),
                "focus": str(group.get("focus", "")),
                "tier": str(group.get("tier", "Reactivate")),
            }
            for group in next_groups
        ]
        next_segment_cards = category_cards(next_segments)
        next_variants = {
            str(group.get("segment_id", "")): dict(group.get("variant", {}) or {})
            for group in next_groups
        }
        next_content_cards = content_cards(next_segments, next_variants, str(state.get("cta_link", "")))
        if next_is_auto_prediction_round:
            review_input = {
                "approved": True,
                "segmentApprovals": [
                    {"segmentId": str(card.get("segmentId", "")), "approved": True}
                    for card in next_segment_cards
                ],
                "variantApprovals": [
                    {"segmentId": str(card.get("segmentId", "")), "approved": True}
                    for card in next_content_cards
                ],
            }
        else:
            review_input = await channel.wait_for_human(
                "optimization_review",
                {
                    "title": f"Review optimization round {next_optimization_round}",
                    "message": (
                        "Review the proposed optimization categories and revised emails together. "
                        "Approve once to continue the next round."
                    ),
                    "segments": next_segment_cards,
                    "variants": next_content_cards,
                    "ctaLink": state.get("cta_link", ""),
                },
                auto_payload={"approved": True},
            )
        next_segments = parse_segment_approvals(next_segments, review_input)
        if not next_segments:
            channel.emit_thinking(
                f"No optimization categories were approved for round {next_optimization_round}. Stopping here.",
                agent="Human-Gate",
                kind="decision",
                background_visible=True,
            )
            break

        next_segments, next_variants, approved_next_variants = apply_variant_approvals(
            next_segments,
            next_variants,
            review_input,
            str(state.get("cta_link", "")),
        )
        if not next_segments:
            channel.emit_thinking(
                f"No optimization emails remained approved for round {next_optimization_round}. Stopping here.",
                agent="Human-Gate",
                kind="decision",
                background_visible=True,
            )
            break

        state["segments"] = next_segments
        state["segment_variants"] = next_variants
        state["content_variants"] = approved_next_variants
        approved_next_ids = collect_target_ids(next_segments)
        state["target_customer_ids"] = approved_next_ids
        state["customer_count"] = len(approved_next_ids)

        latest_prediction = await predict_open_click(next_segments, next_variants, str(state.get("cta_link", "")))
        channel.emit_thinking(
            (
                "Open-Click-Predictor forecast for next round: "
                f"{latest_prediction['open_rate']}% open, {latest_prediction['click_rate']}% click."
            ),
            agent="Open-Click-Predictor",
            kind="metrics",
        )

        current_groups = [
            {
                "segment_id": str(seg.get("segment_id", "")),
                "segment_name": str(seg.get("segment_name", "Segment")),
                "customer_ids": [str(x) for x in seg.get("customer_ids", [])],
                "variant": next_variants.get(str(seg.get("segment_id", "")), {}),
                "criteria": str(seg.get("criteria", "")),
                "tone": str(seg.get("tone", "professional")),
                "focus": str(seg.get("focus", "")),
                "tier": str(seg.get("tier", "Reactivate")),
            }
            for seg in next_segments
        ]

    channel.set_background_mode(False)
    print_header("FINAL CAMPAIGN SUMMARY")
    channel.emit_thinking(
        "Compiling final campaign summary and cumulative performance.",
        agent="Orchestrator",
        kind="final",
    )
    for item in all_round_metrics:
        channel.log(
            f"{item.get('phase_label', 'Round')} {item.get('display_round', item['round'])}: audience={item['audience']}, "
            f"open={item['open_rate']}%, click={item['click_rate']}%"
        )

    unique_audience = set(str(cid) for cid in state.get("target_customer_ids", []))
    opened_unique = set()
    clicked_unique = set()

    for result in all_segment_results:
        unique_audience.update(str(cid) for cid in result.get("customer_ids", []))
        opened_unique.update(str(cid) for cid in result.get("opened_ids", []))
        clicked_unique.update(str(cid) for cid in result.get("clicked_ids", []))

    denominator = len(unique_audience) if unique_audience else max(1, len(opened_unique | clicked_unique))
    final_open = round((len(opened_unique) / denominator) * 100, 1) if denominator else 0.0
    final_click = round((len(clicked_unique) / denominator) * 100, 1) if denominator else 0.0

    final_result = {
        "brief": brief,
        "cta_link": state.get("cta_link", ""),
        "strategy": state.get("strategy", ""),
        "strategy_reasoning": state.get("strategy_reasoning", ""),
        "target_customer_ids": state.get("target_customer_ids", []),
        "customer_count": int(state.get("customer_count", 0)),
        "content_variants": state.get("content_variants", []),
        "segments": [
            {
                "name": str(seg.get("segment_name", "Segment")),
                "size": int(seg.get("size", 0)),
                "criteria": str(seg.get("criteria", "")),
                "tone": str(seg.get("tone", "")),
                "focus": str(seg.get("focus", "")),
                "approved": True,
            }
            for seg in state.get("segments", [])
        ],
        "segment_variants": {
            sid: {
                "subject": str(variant.get("subject", "")),
                "body": str(variant.get("body", "")),
                "tone": str(variant.get("tone", "professional")),
                "tags": [str(x) for x in variant.get("tags", [])]
                if isinstance(variant.get("tags"), list)
                else [],
            }
            for sid, variant in (state.get("segment_variants", {}) or {}).items()
        },
        "metrics_progression": all_round_metrics,
        "final_open_rate": final_open,
        "final_click_rate": final_click,
        "final_total_opened": len(opened_unique),
        "final_total_clicked": len(clicked_unique),
        "unique_total_opened": len(opened_unique),
        "unique_total_clicked": len(clicked_unique),
        "predicted_final_open_rate": float(latest_prediction.get("open_rate", 0.0)),
        "predicted_final_click_rate": float(latest_prediction.get("click_rate", 0.0)),
        "auto_virtual_prediction_rounds": AUTO_VIRTUAL_PREDICTION_ROUNDS,
        "optimization_rounds_completed": len(
            [item for item in all_round_metrics if str(item.get("phase", "")) == "optimization"]
        ),
        "steps": state.get("steps", []),
        "round_summaries": all_round_metrics,
    }

    return final_result


async def run_full_pipeline(brief: str, rounds: int = DEFAULT_OPTIMIZATION_ROUNDS, interactive: bool = False) -> dict[str, Any]:
    channel = RuntimeChannel(interactive=interactive)

    print_header("STEP 1: ReAct Planner + Human-in-the-Loop")
    channel.log(f"Brief: {brief}")
    channel.log(
        f"Configured interactive optimization rounds: {rounds} "
        f"(plus {AUTO_VIRTUAL_PREDICTION_ROUNDS} automatic Virtual Rate Prediction Tool rounds)"
    )

    return await run_react_planner_executor(brief=brief, rounds=rounds, channel=channel)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CampaignX ReAct agent orchestrator")
    parser.add_argument("brief", nargs="*", help="Campaign brief text")
    parser.add_argument("--rounds", type=int, default=DEFAULT_OPTIMIZATION_ROUNDS)
    parser.add_argument("--interactive", action="store_true", help="Enable human-in-the-loop pauses")
    return parser.parse_args()


async def main() -> int:
    try:
        args = parse_args()
        brief = " ".join(args.brief).strip() if args.brief else DEFAULT_BRIEF
        rounds = max(1, int(args.rounds or DEFAULT_OPTIMIZATION_ROUNDS))

        result = await run_full_pipeline(brief=brief, rounds=rounds, interactive=bool(args.interactive))

        with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2, ensure_ascii=False, default=str)

        print(f"\nSaved final output to {OUTPUT_FILE}", flush=True)
        return 0
    except Exception as exc:
        emit_runtime_failure(exc)
        return 1


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    raise SystemExit(asyncio.run(main()))
