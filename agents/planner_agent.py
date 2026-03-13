"""
Planning helpers for brief extraction and optimization-round planning.

These functions keep execution deterministic while moving strategy choices
into structured LLM outputs.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from agents.config import AGENTS_TEST_MODE, GEMINI_API_KEY, GEMINI_MODEL
from agents.memory import memory_db


ALLOWED_ANGLES = {"curiosity", "urgency", "social_proof", "authority"}
ALLOWED_SOURCES = {
    "clicked",
    "opened_not_clicked",
    "ignored",
    "never_opened",
    "all_opened",
    "non_clickers",
    "full_segment",
}
ALLOWED_TIERS = {"Diamond", "Gold", "Silver", "Reactivate"}
URL_RE = re.compile(r"https?://[^\s)>\]]+")


def _get_model() -> ChatGoogleGenerativeAI:
    if not GEMINI_API_KEY:
        raise EnvironmentError("Missing GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.3,
    )


def _extract_json_object(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found")
    parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Expected object")
    return parsed


def _extract_urls(text: str) -> list[str]:
    return [match.group(0) for match in URL_RE.finditer(text or "")]


def _title_case_token(token: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"[_\s-]+", token.strip()) if part)


def _heuristic_brief_context(brief: str) -> dict[str, Any]:
    urls = _extract_urls(brief)
    product_match = re.search(r"launch(?:ing)?\s+([A-Za-z0-9][A-Za-z0-9 _-]{1,40})", brief, re.IGNORECASE)
    brand_match = re.search(r"from\s+([A-Za-z][A-Za-z0-9 _-]{1,40})", brief, re.IGNORECASE)

    target_audiences: list[str] = []
    lowered = brief.lower()
    for audience in [
        "female senior citizens",
        "senior citizens",
        "high-income professionals",
        "young professionals",
        "inactive customers",
        "existing customers",
        "new customers",
    ]:
        if audience in lowered:
            target_audiences.append(_title_case_token(audience))

    tone_preferences: list[str] = []
    for tone in ["friendly", "professional", "urgent", "empathetic", "trust-building", "personalized"]:
        if tone in lowered:
            tone_preferences.append(tone)

    primary_offer = ""
    offer_sentences = re.findall(r"([^.]*?(?:higher returns|bonus|offer|percentage point)[^.]*\.)", brief, re.IGNORECASE)
    if offer_sentences:
        primary_offer = offer_sentences[0].strip()

    return {
        "product_name": product_match.group(1).strip() if product_match else "",
        "brand_name": brand_match.group(1).strip() if brand_match else "",
        "product_category": "email campaign",
        "primary_offer": primary_offer,
        "secondary_offers": [],
        "cta_url": urls[0] if urls else "",
        "campaign_goal": "Maximize open rate and click rate",
        "target_audiences": target_audiences,
        "constraints": [],
        "tone_preferences": tone_preferences,
    }


async def _invoke_json_with_repair(
    system_prompt: str,
    user_prompt: str,
    fallback: dict[str, Any],
) -> dict[str, Any]:
    model = _get_model()

    try:
        response = await model.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        return _extract_json_object(str(response.content))
    except Exception:
        pass

    repair_prompt = (
        "Your previous answer was invalid or not parseable JSON. "
        "Return only a valid JSON object matching the requested schema."
    )
    try:
        response = await model.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"{user_prompt}\n\n{repair_prompt}"),
        ])
        return _extract_json_object(str(response.content))
    except Exception:
        return fallback


async def parse_campaign_brief(brief: str) -> dict[str, Any]:
    fallback = _heuristic_brief_context(brief)
    if AGENTS_TEST_MODE:
        return fallback

    system_prompt = (
        "You are a BFSI campaign brief parser. "
        "Extract structured campaign context from the user brief. "
        "Do not invent unsupported offers. "
        "Return JSON with keys: "
        "product_name, brand_name, product_category, primary_offer, secondary_offers, "
        "cta_url, campaign_goal, target_audiences, constraints, tone_preferences."
    )
    user_prompt = (
        f"Campaign brief:\n{brief}\n\n"
        "Rules:\n"
        "- Use empty strings or empty arrays when unknown.\n"
        "- target_audiences, secondary_offers, constraints, and tone_preferences must be arrays.\n"
        "- cta_url must be a URL from the brief if present.\n"
        "- campaign_goal should summarize the optimization goal in one sentence.\n"
        "Return JSON only."
    )

    parsed = await _invoke_json_with_repair(system_prompt, user_prompt, fallback)
    parsed["secondary_offers"] = [str(x) for x in parsed.get("secondary_offers", []) if str(x).strip()]
    parsed["target_audiences"] = [str(x) for x in parsed.get("target_audiences", []) if str(x).strip()]
    parsed["constraints"] = [str(x) for x in parsed.get("constraints", []) if str(x).strip()]
    parsed["tone_preferences"] = [str(x) for x in parsed.get("tone_preferences", []) if str(x).strip()]
    parsed["cta_url"] = str(parsed.get("cta_url", "")).strip()
    return parsed


def build_brief_context(brief: str, campaign_context: dict[str, Any]) -> str:
    sections = ["Original Campaign Brief:", brief.strip()]

    structured_lines = [
        f"Product: {campaign_context.get('product_name', '')}",
        f"Brand: {campaign_context.get('brand_name', '')}",
        f"Category: {campaign_context.get('product_category', '')}",
        f"Primary Offer: {campaign_context.get('primary_offer', '')}",
        "Secondary Offers: " + ", ".join(campaign_context.get("secondary_offers", [])),
        f"CTA URL: {campaign_context.get('cta_url', '')}",
        f"Goal: {campaign_context.get('campaign_goal', '')}",
        "Target Audiences: " + ", ".join(campaign_context.get("target_audiences", [])),
        "Constraints: " + ", ".join(campaign_context.get("constraints", [])),
        "Tone Preferences: " + ", ".join(campaign_context.get("tone_preferences", [])),
    ]
    sections.append("Structured Campaign Context:")
    sections.append("\n".join(structured_lines))
    return "\n\n".join(section for section in sections if section.strip())


def _safe_pct(numerator: int, denominator: int) -> float:
    return round((numerator / denominator) * 100, 1) if denominator > 0 else 0.0


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _default_send_window() -> str:
    return "13:00"


def _tone_from_angle(angle: str) -> str:
    mapping = {
        "curiosity": "curious and concise",
        "urgency": "direct and action-oriented",
        "social_proof": "reassuring and evidence-led",
        "authority": "confident and trust-building",
    }
    return mapping.get(angle, "professional")


def _to_ist_window(hour_utc: int | None) -> str:
    if hour_utc is None:
        return _default_send_window()
    total_minutes = ((int(hour_utc) * 60) + 330) % (24 * 60)
    hour = total_minutes // 60
    minute = total_minutes % 60
    return f"{hour:02d}:{minute:02d}"


def _memory_send_window(customer_ids: list[str], memory_data: dict[str, Any]) -> str:
    hours: list[int] = []
    for customer_id in customer_ids:
        user = memory_data.get(customer_id, {})
        hour = user.get("optimal_send_hour_utc")
        if isinstance(hour, (int, float)):
            hours.append(int(hour))

    if not hours:
        return _default_send_window()
    best_hour = Counter(hours).most_common(1)[0][0]
    return _to_ist_window(best_hour)


def _behavior_ids(result: dict[str, Any]) -> dict[str, list[str]]:
    customer_ids = [str(x) for x in result.get("customer_ids", []) if str(x).strip()]
    opened_ids = [str(x) for x in result.get("opened_ids", []) if str(x).strip()]
    clicked_ids = [str(x) for x in result.get("clicked_ids", []) if str(x).strip()]
    opened_set = set(opened_ids)
    clicked_set = set(clicked_ids)
    return {
        "clicked": clicked_ids,
        "opened_not_clicked": [customer_id for customer_id in opened_ids if customer_id not in clicked_set],
        "ignored": [customer_id for customer_id in customer_ids if customer_id not in opened_set],
        "all_opened": opened_ids,
        "non_clickers": [customer_id for customer_id in customer_ids if customer_id not in clicked_set],
        "full_segment": customer_ids,
    }


def _segment_pattern(
    open_rate: float,
    click_rate: float,
    ctr: float,
    median_open: float,
    median_click: float,
    median_ctr: float,
) -> str:
    if click_rate >= median_click and ctr >= median_ctr:
        return "high-performing"
    if open_rate >= median_open and ctr < median_ctr:
        return "interest-with-conversion-friction"
    if open_rate < median_open and click_rate < median_click:
        return "low-visibility"
    return "mixed-signal"


def _build_segment_analytics(segment_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    analytics: list[dict[str, Any]] = []
    open_rates = [float(result.get("open_rate", 0.0)) for result in segment_results]
    click_rates = [float(result.get("click_rate", 0.0)) for result in segment_results]
    ctr_values = [
        _safe_pct(int(result.get("total_clicked", 0)), int(result.get("total_opened", 0)))
        for result in segment_results
    ]

    median_open = sorted(open_rates)[len(open_rates) // 2] if open_rates else 0.0
    median_click = sorted(click_rates)[len(click_rates) // 2] if click_rates else 0.0
    median_ctr = sorted(ctr_values)[len(ctr_values) // 2] if ctr_values else 0.0

    for result in segment_results:
        sent = int(result.get("total_sent", 0))
        opened = int(result.get("total_opened", 0))
        clicked = int(result.get("total_clicked", 0))
        ctr = _safe_pct(clicked, opened)
        behaviors = _behavior_ids(result)
        analytics.append(
            {
                "segment_id": str(result.get("segment_id", "")),
                "segment_name": str(result.get("segment_name", "Segment")),
                "sent": sent,
                "open_rate": float(result.get("open_rate", 0.0)),
                "click_rate": float(result.get("click_rate", 0.0)),
                "click_through_rate": ctr,
                "open_no_click_rate": _safe_pct(len(behaviors["opened_not_clicked"]), sent),
                "ignored_rate": _safe_pct(len(behaviors["ignored"]), sent),
                "pattern": _segment_pattern(
                    float(result.get("open_rate", 0.0)),
                    float(result.get("click_rate", 0.0)),
                    ctr,
                    median_open,
                    median_click,
                    median_ctr,
                ),
                "behaviors": behaviors,
            }
        )
    return analytics


def _candidate_score(
    source_type: str,
    estimated_size: int,
    total_audience: int,
    open_rate: float,
    click_rate: float,
    ctr: float,
    memory_strength: float,
) -> float:
    audience_score = min(1.0, estimated_size / max(1.0, total_audience * 0.35))
    if source_type == "opened_not_clicked":
        uplift_signal = min(1.0, max(0.0, (open_rate - click_rate) / 40.0))
    elif source_type == "ignored":
        uplift_signal = min(1.0, max(0.0, (35.0 - open_rate) / 35.0))
    elif source_type == "clicked":
        uplift_signal = min(1.0, max(click_rate / 25.0, ctr / 45.0))
    elif source_type == "all_opened":
        uplift_signal = min(1.0, max(open_rate / 60.0, ctr / 50.0))
    else:
        uplift_signal = min(1.0, max(click_rate / 20.0, open_rate / 70.0))
    return round((0.45 * audience_score) + (0.35 * uplift_signal) + (0.20 * memory_strength), 3)


def _summarize_segment_results(segment_results: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for result in _build_segment_analytics(segment_results):
        lines.append(
            json.dumps(
                {
                    "segment_id": result["segment_id"],
                    "segment_name": result["segment_name"],
                    "audience_size": result["sent"],
                    "open_rate": result["open_rate"],
                    "click_rate": result["click_rate"],
                    "click_through_rate": result["click_through_rate"],
                    "open_no_click_rate": result["open_no_click_rate"],
                    "ignored_rate": result["ignored_rate"],
                    "pattern": result["pattern"],
                    "behavior_distribution": {
                        "clicked": len(result["behaviors"]["clicked"]),
                        "opened_not_clicked": len(result["behaviors"]["opened_not_clicked"]),
                        "ignored": len(result["behaviors"]["ignored"]),
                    },
                },
                ensure_ascii=False,
            )
        )
    return "\n".join(lines)


def _build_candidate_catalog(
    round_num: int,
    segment_results: list[dict[str, Any]],
    memory_data: dict[str, Any],
) -> list[dict[str, Any]]:
    analytics = _build_segment_analytics(segment_results)
    total_audience = max(1, sum(int(item["sent"]) for item in analytics))
    min_candidate_size = max(5, int(total_audience * 0.05))
    candidates: list[dict[str, Any]] = []

    for item in analytics:
        segment_id = str(item["segment_id"])
        segment_name = str(item["segment_name"])
        open_rate = float(item["open_rate"])
        click_rate = float(item["click_rate"])
        ctr = float(item["click_through_rate"])
        behaviors = item["behaviors"]
        pattern = str(item["pattern"])

        specs = [
            {
                "source_type": "opened_not_clicked",
                "name": f"{segment_name} | Interested Non-Converters",
                "logic": f"Customers in {segment_name} who opened the previous email but did not click.",
                "reasoning": (
                    f"{segment_name} produced {open_rate}% opens but only {click_rate}% clicks "
                    f"(CTR {ctr}%), which suggests visibility without enough conversion pull."
                ),
                "default_angle": "authority",
                "default_content_action": "regenerate_variant",
                "subject_line_direction": "Sharper value proposition with a clearer conversion hook",
                "tier": "Gold",
            },
            {
                "source_type": "ignored",
                "name": f"{segment_name} | Visibility Recovery Cohort",
                "logic": f"Customers in {segment_name} who ignored the previous email.",
                "reasoning": (
                    f"{segment_name} underperformed on visibility with only {open_rate}% opens, "
                    "so the next round should test different framing and timing."
                ),
                "default_angle": "curiosity",
                "default_content_action": "regenerate_variant",
                "subject_line_direction": "Curiosity-led subject line with faster value communication",
                "tier": "Reactivate",
            },
            {
                "source_type": "clicked",
                "name": f"{segment_name} | High-Intent Responders",
                "logic": f"Customers in {segment_name} who clicked in the previous round.",
                "reasoning": (
                    f"{segment_name} generated real downstream intent with {click_rate}% clicks. "
                    "A focused follow-up can reinforce the strongest promise for conversion-ready users."
                ),
                "default_angle": "authority",
                "default_content_action": "reuse_existing",
                "subject_line_direction": "Reinforce trust and next-step clarity for high-intent responders",
                "tier": "Diamond",
            },
            {
                "source_type": "all_opened",
                "name": f"{segment_name} | Engaged Readers",
                "logic": f"Customers in {segment_name} who opened the message, regardless of click outcome.",
                "reasoning": (
                    f"{segment_name} has an engaged reader base with {open_rate}% opens and a {pattern} profile."
                ),
                "default_angle": "social_proof",
                "default_content_action": "regenerate_variant",
                "subject_line_direction": "Evidence-led subject line that converts existing interest",
                "tier": "Silver",
            },
            {
                "source_type": "full_segment",
                "name": f"{segment_name} | Full Segment Re-Optimization",
                "logic": f"Re-target the full {segment_name} segment with a revised optimization strategy.",
                "reasoning": (
                    f"{segment_name} remains strategically relevant because it represents {item['sent']} customers "
                    f"with a {pattern} engagement pattern."
                ),
                "default_angle": "authority",
                "default_content_action": "regenerate_variant",
                "subject_line_direction": "Re-position the subject line around the strongest observed benefit",
                "tier": "Gold",
            },
        ]

        for spec in specs:
            customer_ids = behaviors.get(spec["source_type"], [])
            estimated_size = len(customer_ids)
            if estimated_size < min_candidate_size:
                continue

            angle_preferences = summarize_angle_preferences(customer_ids, memory_data)
            chosen_angle = max(angle_preferences, key=angle_preferences.get) if angle_preferences else spec["default_angle"]
            if chosen_angle not in ALLOWED_ANGLES:
                chosen_angle = spec["default_angle"]

            memory_strength = float(angle_preferences.get(chosen_angle, 0.5)) if angle_preferences else 0.5
            send_window = _memory_send_window(customer_ids, memory_data)
            priority_score = _candidate_score(
                spec["source_type"],
                estimated_size,
                total_audience,
                open_rate,
                click_rate,
                ctr,
                memory_strength,
            )

            candidate_id = f"round_{round_num}_{_slug(segment_id)}_{spec['source_type']}"
            candidates.append(
                {
                    "candidate_id": candidate_id,
                    "segment_id": candidate_id,
                    "segment_name": spec["name"],
                    "source_type": spec["source_type"],
                    "source_segments": [segment_id],
                    "estimated_size": estimated_size,
                    "segment_logic": spec["logic"],
                    "performance_reasoning": spec["reasoning"],
                    "priority_score": priority_score,
                    "default_angle": chosen_angle,
                    "default_send_time": send_window,
                    "default_content_action": spec["default_content_action"],
                    "subject_line_direction": spec["subject_line_direction"],
                    "tier": spec["tier"] if spec["tier"] in ALLOWED_TIERS else "Reactivate",
                    "metrics": {
                        "audience_size": int(item["sent"]),
                        "open_rate": open_rate,
                        "click_rate": click_rate,
                        "click_through_rate": ctr,
                        "open_no_click_rate": float(item["open_no_click_rate"]),
                        "ignored_rate": float(item["ignored_rate"]),
                        "pattern": pattern,
                    },
                    "memory_angle_preferences": angle_preferences,
                }
            )

    candidates.sort(key=lambda item: (float(item["priority_score"]), int(item["estimated_size"])), reverse=True)
    return candidates[:10]


def _heuristic_plan_from_candidates(round_num: int, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    selected = candidates[: min(4, len(candidates))]
    optimization_plan: list[dict[str, Any]] = []
    for candidate in selected:
        optimization_plan.append(
            {
                "candidate_id": candidate["candidate_id"],
                "segment_name": candidate["segment_name"],
                "segment_logic": candidate["segment_logic"],
                "performance_reasoning": candidate["performance_reasoning"],
                "strategy": {
                    "messaging_angle": candidate["default_angle"],
                    "subject_line_direction": candidate["subject_line_direction"],
                    "send_time": candidate["default_send_time"],
                    "content_action": candidate["default_content_action"],
                },
            }
        )

    return {
        "round_goal": f"Round {round_num} optimization focused on the strongest observed engagement opportunities.",
        "planner_notes": "Heuristic optimization plan generated from observed segment behavior and memory signals.",
        "optimization_plan": optimization_plan,
    }


def _summarize_candidates(candidates: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for candidate in candidates:
        lines.append(
            json.dumps(
                {
                    "candidate_id": candidate["candidate_id"],
                    "segment_name": candidate["segment_name"],
                    "segment_logic": candidate["segment_logic"],
                    "source_type": candidate["source_type"],
                    "source_segments": candidate["source_segments"],
                    "estimated_size": candidate["estimated_size"],
                    "priority_score": candidate["priority_score"],
                    "performance_reasoning": candidate["performance_reasoning"],
                    "memory_angle_preferences": candidate["memory_angle_preferences"],
                    "default_strategy": {
                        "messaging_angle": candidate["default_angle"],
                        "send_time": candidate["default_send_time"],
                        "content_action": candidate["default_content_action"],
                        "subject_line_direction": candidate["subject_line_direction"],
                    },
                    "metrics": candidate["metrics"],
                },
                ensure_ascii=False,
            )
        )
    return "\n".join(lines)


def _normalize_optimization_items(parsed: dict[str, Any], candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidate_index = {str(candidate["candidate_id"]): candidate for candidate in candidates}
    normalized: list[dict[str, Any]] = []
    raw_items = parsed.get("optimization_plan", [])
    if not isinstance(raw_items, list):
        return normalized

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        candidate_id = str(item.get("candidate_id", "")).strip()
        candidate = candidate_index.get(candidate_id)
        if not candidate:
            continue

        raw_strategy = item.get("strategy", {})
        raw_strategy = raw_strategy if isinstance(raw_strategy, dict) else {}

        messaging_angle = str(raw_strategy.get("messaging_angle", candidate["default_angle"])).strip().lower()
        if messaging_angle not in ALLOWED_ANGLES:
            messaging_angle = str(candidate["default_angle"])

        send_time = str(raw_strategy.get("send_time", candidate["default_send_time"])).strip()
        if not re.fullmatch(r"\d{2}:\d{2}", send_time):
            send_time = str(candidate["default_send_time"])

        content_action = str(raw_strategy.get("content_action", candidate["default_content_action"])).strip()
        if content_action not in {"reuse_existing", "regenerate_variant"}:
            content_action = str(candidate["default_content_action"])

        normalized.append(
            {
                "candidate": candidate,
                "segment_name": str(item.get("segment_name", candidate["segment_name"])).strip() or candidate["segment_name"],
                "segment_logic": str(item.get("segment_logic", candidate["segment_logic"])).strip() or candidate["segment_logic"],
                "performance_reasoning": (
                    str(item.get("performance_reasoning", candidate["performance_reasoning"])).strip()
                    or candidate["performance_reasoning"]
                ),
                "strategy": {
                    "messaging_angle": messaging_angle,
                    "subject_line_direction": (
                        str(raw_strategy.get("subject_line_direction", candidate["subject_line_direction"])).strip()
                        or candidate["subject_line_direction"]
                    ),
                    "send_time": send_time,
                    "content_action": content_action,
                },
            }
        )
    return normalized


def _build_round_plan(round_num: int, parsed: dict[str, Any], candidates: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_items = _normalize_optimization_items(parsed, candidates)
    if not normalized_items:
        parsed = _heuristic_plan_from_candidates(round_num, candidates)
        normalized_items = _normalize_optimization_items(parsed, candidates)

    retarget_segments: list[dict[str, Any]] = []
    optimization_plan: list[dict[str, Any]] = []
    for item in normalized_items:
        candidate = item["candidate"]
        strategy = item["strategy"]
        angle = str(strategy["messaging_angle"])
        retarget_segments.append(
            {
                "segment_id": str(candidate["segment_id"]),
                "segment_name": str(item["segment_name"]),
                "source_type": str(candidate["source_type"]),
                "source_segments": [str(x) for x in candidate["source_segments"]],
                "criteria": str(item["segment_logic"]),
                "tone": _tone_from_angle(angle),
                "focus": str(strategy["subject_line_direction"]),
                "emoji_level": "moderate" if angle in {"curiosity", "social_proof"} else "none",
                "tier": str(candidate["tier"]),
                "send_window": str(strategy["send_time"]),
                "preferred_angle": angle,
                "content_action": str(strategy["content_action"]),
                "subject_line_direction": str(strategy["subject_line_direction"]),
                "performance_reasoning": str(item["performance_reasoning"]),
                "priority_score": float(candidate["priority_score"]),
                "segment_logic": str(item["segment_logic"]),
            }
        )
        optimization_plan.append(
            {
                "segment_name": str(item["segment_name"]),
                "segment_logic": str(item["segment_logic"]),
                "performance_reasoning": str(item["performance_reasoning"]),
                "strategy": {
                    "messaging_angle": angle,
                    "subject_line_direction": str(strategy["subject_line_direction"]),
                    "send_time": str(strategy["send_time"]),
                    "content_action": str(strategy["content_action"]),
                },
            }
        )

    return {
        "round_goal": str(parsed.get("round_goal", f"Round {round_num} optimization plan")),
        "planner_notes": str(parsed.get("planner_notes", "")),
        "optimization_plan": optimization_plan,
        "retarget_segments": retarget_segments,
    }


async def plan_retargeting_round(
    brief_context: str,
    strategy: str,
    round_num: int,
    segment_results: list[dict[str, Any]],
) -> dict[str, Any]:
    candidates = _build_candidate_catalog(round_num, segment_results, memory_db.data)
    if not candidates:
        return {
            "round_goal": f"Round {round_num} optimization plan",
            "planner_notes": "No meaningful micro-segments were large enough to justify another round.",
            "optimization_plan": [],
            "retarget_segments": [],
        }

    fallback = _heuristic_plan_from_candidates(round_num, candidates)
    if AGENTS_TEST_MODE:
        return _build_round_plan(round_num, fallback, candidates)

    system_prompt = (
        "You are a BFSI optimization planner. "
        "You receive report-derived segment analytics and a catalog of candidate micro-segments discovered from the latest campaign data. "
        "Select the next round follow-up plan dynamically. "
        "Do not invent candidate IDs. Choose only from the provided candidate catalog. "
        "Prioritize segments that can improve overall click rate through better targeting, better messaging, or better timing. "
        "Suppress tiny or low-impact segments. "
        "Return strict JSON with keys: round_goal, planner_notes, optimization_plan. "
        "optimization_plan must be an array of at most 4 objects with keys: "
        "candidate_id, segment_name, segment_logic, performance_reasoning, strategy. "
        "strategy must contain: messaging_angle, subject_line_direction, send_time, content_action. "
        "messaging_angle must be one of curiosity, urgency, social_proof, authority. "
        "send_time must be HH:MM in 24h format. "
        "content_action must be reuse_existing or regenerate_variant."
    )
    user_prompt = (
        f"Campaign context:\n{brief_context}\n\n"
        f"Overall strategy:\n{strategy}\n\n"
        f"Round to plan: {round_num}\n\n"
        "Observed segment performance:\n"
        f"{_summarize_segment_results(segment_results)}\n\n"
        "Candidate micro-segments discovered from observed engagement behavior and memory:\n"
        f"{_summarize_candidates(candidates)}\n\n"
        "Choose the next-round optimization plan. Explain why each selected candidate deserves another attempt and "
        "what should change in messaging or timing."
    )

    parsed = await _invoke_json_with_repair(system_prompt, user_prompt, fallback)
    return _build_round_plan(round_num, parsed, candidates)


def summarize_angle_preferences(customer_ids: list[str], memory_data: dict[str, Any]) -> dict[str, float]:
    scores = Counter()
    for customer_id in customer_ids:
        user = memory_data.get(customer_id, {})
        for angle, value in user.get("psychographic_tags", {}).items():
            try:
                scores[str(angle)] += float(value)
            except (TypeError, ValueError):
                continue

    total = float(sum(scores.values()))
    if total <= 0:
        return {}
    return {angle: round(value / total, 3) for angle, value in scores.items()}
