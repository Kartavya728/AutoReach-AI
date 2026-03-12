"""
Behavioral Micro-Segmenter - Optimization Agent
================================================
Splits prior campaign results into click-focused re-targeting audiences.
Warm audiences get objection-handling or conversion-focused follow-ups.
Cold audiences get subject-refresh flows instead of urgency-heavy repeats.
"""

from __future__ import annotations

from .state import SegmentResult, CustomerSegment

MIN_SEGMENT_SIZE = 120
TIER_PRIORITY = {
    "Diamond": 18.0,
    "Gold": 12.0,
    "Silver": 7.0,
    "Reactivate": 0.0,
}


def _dedupe(ids: list[str]) -> list[str]:
    return list(dict.fromkeys(cid for cid in ids if cid))


def _resolve_tier(result: SegmentResult) -> str:
    variant_used = result.get("variant_used", {})
    tags = variant_used.get("tags", []) if isinstance(variant_used, dict) else []
    if tags:
        first_tag = str(tags[0])
        if first_tag in TIER_PRIORITY:
            return first_tag
    return str(result.get("tier") or "Reactivate")


def _click_to_open_rate(result: SegmentResult) -> float:
    opened = float(result.get("total_opened", 0) or 0)
    clicked = float(result.get("total_clicked", 0) or 0)
    if opened <= 0:
        return 0.0
    return round((clicked / opened) * 100, 1)


def _pick_send_window(stage: str, segment_name: str, tier: str) -> str:
    text = f"{segment_name} {tier}".lower()

    if stage.startswith("warm"):
        if any(token in text for token in ["professional", "doctor", "engineer", "advocate", "executive", "manager"]):
            return "20:00"
        if tier in {"Diamond", "Gold"}:
            return "13:00"
        return "18:30"

    if any(token in text for token in ["senior", "retired"]):
        return "09:30"
    if any(token in text for token in ["professional", "doctor", "engineer", "advocate", "executive", "manager"]):
        return "19:30"
    return "11:30"


def _build_segment(
    *,
    stage: str,
    segment_id: str,
    segment_name: str,
    customer_ids: list[str],
    tier: str,
    criteria: str,
    tone: str,
    focus: str,
    emoji_level: str,
    priority_score: float,
    send_window: str,
) -> CustomerSegment:
    return {
        "segment_id": segment_id,
        "segment_name": segment_name,
        "customer_ids": customer_ids,
        "size": len(customer_ids),
        "criteria": criteria,
        "tone": tone,
        "focus": focus,
        "emoji_level": emoji_level,
        "tier": tier,
        "retarget_stage": stage,
        "priority_score": round(priority_score, 1),
        "send_window": send_window,
    }


def _macro_name(stage: str) -> str:
    names = {
        "warm_convert": "[Macro Warm-Convert] High-Intent Openers",
        "warm_resolve": "[Macro Warm-Resolve] Hesitant Openers",
        "cold_subject_refresh": "[Macro Cold-Refresh] Subject-Line Miss",
        "cold_benefit_reminder": "[Macro Cold-Reminder] Benefit-Led Retry",
    }
    return names.get(stage, f"[Macro] {stage}")


def generate_behavioral_segments(
    previous_results: list[SegmentResult],
    historical_results: list[SegmentResult] | None = None,
) -> list[CustomerSegment]:
    """
    Turn demographic segment results into behavior-based re-targeting segments.

    Priority is given to opened-not-clicked audiences, while customers who have
    already clicked in any prior round are suppressed from re-targeting.
    """
    behavioral_segments: list[CustomerSegment] = []
    bucket_ids: dict[str, list[str]] = {}
    bucket_templates: dict[str, CustomerSegment] = {}

    global_clicked_ids = set()
    for result in historical_results or previous_results:
        global_clicked_ids.update(_dedupe(result.get("clicked_ids", [])))

    for result in previous_results:
        segment_id_base = result["segment_id"]
        segment_name_base = result["segment_name"]
        tier = _resolve_tier(result)

        audience_ids = _dedupe(result.get("customer_ids", []))
        opened_ids = _dedupe(result.get("opened_ids", []))
        clicked_ids = set(_dedupe(result.get("clicked_ids", [])))
        opened_not_clicked_ids = [
            cid for cid in opened_ids
            if cid not in global_clicked_ids and cid not in clicked_ids
        ]
        opened_id_set = set(opened_ids)
        never_opened_ids = [
            cid for cid in audience_ids
            if cid not in opened_id_set and cid not in global_clicked_ids
        ]

        open_rate = float(result.get("open_rate", 0.0) or 0.0)
        click_rate = float(result.get("click_rate", 0.0) or 0.0)
        click_to_open = _click_to_open_rate(result)
        tier_boost = TIER_PRIORITY.get(tier, 0.0)

        staged_segments: list[CustomerSegment] = []

        if opened_not_clicked_ids:
            if click_to_open >= 28.0 or click_rate >= 8.0:
                stage = "warm_convert"
                staged_segments.append(
                    _build_segment(
                        stage=stage,
                        segment_id=f"{segment_id_base}_{stage}",
                        segment_name=f"[Warm-Convert] {segment_name_base}",
                        customer_ids=opened_not_clicked_ids,
                        tier=tier,
                        criteria=(
                            f"Customers opened the last email but did not click. The parent segment already shows "
                            f"solid click intent ({click_to_open}% click-to-open), so treat this as a near-conversion "
                            "audience. Keep the subject calm, lead with the 1 percentage point higher return, and place "
                            "one CTA in the first 2-3 lines."
                        ),
                        tone="concise, confident, and trust-building",
                        focus="Continue exploring XDeposit with one clear CTA",
                        emoji_level="none",
                        priority_score=88.0 + tier_boost + (click_to_open * 0.3),
                        send_window=_pick_send_window(stage, segment_name_base, tier),
                    )
                )
            else:
                stage = "warm_resolve"
                staged_segments.append(
                    _build_segment(
                        stage=stage,
                        segment_id=f"{segment_id_base}_{stage}",
                        segment_name=f"[Warm-Resolve] {segment_name_base}",
                        customer_ids=opened_not_clicked_ids,
                        tier=tier,
                        criteria=(
                            "Customers opened the last email but did not click. Treat this as a friction problem, not "
                            "an awareness problem. Use one concrete benefit, one trust cue, and one CTA. Avoid hype, "
                            "multiple asks, or heavy FOMO language."
                        ),
                        tone="reassuring, specific, and credible",
                        focus="Explain why XDeposit is worth the click",
                        emoji_level="none",
                        priority_score=82.0 + tier_boost + (open_rate * 0.2),
                        send_window=_pick_send_window(stage, segment_name_base, tier),
                    )
                )

        if never_opened_ids:
            if open_rate < 18.0 or result.get("total_opened", 0) == 0:
                stage = "cold_subject_refresh"
                staged_segments.append(
                    _build_segment(
                        stage=stage,
                        segment_id=f"{segment_id_base}_{stage}",
                        segment_name=f"[Cold-Refresh] {segment_name_base}",
                        customer_ids=never_opened_ids,
                        tier=tier,
                        criteria=(
                            "Customers never opened the previous email. Treat this as a subject-line problem. Change "
                            "the subject materially, keep the body short, lead with one concrete benefit, and use a "
                            "single CTA."
                        ),
                        tone="curious, crisp, and professional",
                        focus="A higher-return option they may have missed",
                        emoji_level="moderate",
                        priority_score=58.0 + tier_boost + (click_rate * 0.8),
                        send_window=_pick_send_window(stage, segment_name_base, tier),
                    )
                )
            else:
                stage = "cold_benefit_reminder"
                staged_segments.append(
                    _build_segment(
                        stage=stage,
                        segment_id=f"{segment_id_base}_{stage}",
                        segment_name=f"[Cold-Reminder] {segment_name_base}",
                        customer_ids=never_opened_ids,
                        tier=tier,
                        criteria=(
                            "Customers still did not open even though the wider segment showed some engagement. Refresh "
                            "the subject line, make the body simpler, and focus on one clear BFSI-safe reason to click."
                        ),
                        tone="benefit-led and direct",
                        focus="One specific reason to revisit XDeposit",
                        emoji_level="moderate",
                        priority_score=52.0 + tier_boost + (open_rate * 0.15),
                        send_window=_pick_send_window(stage, segment_name_base, tier),
                    )
                )

        for segment in staged_segments:
            if segment["size"] >= MIN_SEGMENT_SIZE:
                behavioral_segments.append(segment)
                continue

            stage = segment["retarget_stage"]
            bucket_ids.setdefault(stage, []).extend(segment["customer_ids"])
            existing = bucket_templates.get(stage)
            if not existing or segment.get("priority_score", 0.0) > existing.get("priority_score", 0.0):
                bucket_templates[stage] = segment

    for stage, ids in bucket_ids.items():
        unique_ids = _dedupe(ids)
        if not unique_ids:
            continue

        template = bucket_templates[stage]
        behavioral_segments.append({
            **template,
            "segment_id": f"macro_{stage}",
            "segment_name": _macro_name(stage),
            "customer_ids": unique_ids,
            "size": len(unique_ids),
        })

    behavioral_segments.sort(
        key=lambda segment: (segment.get("priority_score", 0.0), segment["size"]),
        reverse=True,
    )
    return behavioral_segments
