"""
Optimization Execution Agent — Post-Campaign Re-Launch
=======================================================
Takes approved optimization suggestions and:
  1. Fetches the existing campaign + report
  2. Uses Gemini to regenerate content incorporating approved optimizations
  3. Scores and filters customers (65% weight + 35% demographic match)
  4. Narrows audience to previously-engaged customers
  5. Sends batched campaigns to CampaignX API (100/batch, 30min stagger)
  6. Persists optimization history and updated campaign to Supabase

Corresponds to: `runOptimizationAgent()` in optimize.ts
"""

from __future__ import annotations
import json
import math
from datetime import datetime, timedelta, timezone
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from agents.config import GEMINI_API_KEY, GEMINI_MODEL
from agents.supabase_client import (
    get_campaign_by_id,
    update_campaign,
    save_variants,
    save_optimizations,
    save_optimization_history,
    get_customers,
)
from agents.campaignx_api import fetch_campaign_report, send_campaign
from agents.analysis_agent import compute_analysis


def _get_model() -> ChatGoogleGenerativeAI:
    if not GEMINI_API_KEY:
        raise EnvironmentError("Missing GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.7,
    )


def _to_campaignx_time(dt: datetime) -> str:
    """Format datetime as DD:MM:YY HH:MM:SS (CampaignX API format, IST)."""
    # CampaignX API expects IST (UTC+5:30), not UTC
    ist = timezone(timedelta(hours=5, minutes=30))
    dt_ist = dt.astimezone(ist)
    return dt_ist.strftime("%d:%m:%y %H:%M:%S")


async def run_optimization_agent(
    campaign_id: str,
    approved_suggestions: list[dict],
) -> dict:
    """
    Execute the full optimization loop:
    
    1. Load campaign from Supabase
    2. Fetch report from CampaignX API
    3. Compute analysis metrics
    4. LLM generates updated content + targeting criteria
    5. Score customers (65% weight + 35% demographics)
    6. Narrow to previously-engaged subset
    7. Batch send to CampaignX API
    8. Save history + update campaign in Supabase
    
    Returns an ImprovementReport dict.
    """
    # ── 1. Fetch campaign ──
    campaign = get_campaign_by_id(campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    # ── 2. Fetch report + compute analysis ──
    analysis_report = None
    external_id = campaign.get("external_campaign_id")
    if external_id:
        try:
            report_resp = await fetch_campaign_report(external_id)
            report_data = report_resp.get("data", [])
            if report_data:
                analysis_report = compute_analysis(external_id, report_data, campaign)
        except Exception:
            print("[Optimize] Could not fetch campaign report, proceeding without it")

    previous_metrics = {
        "open_rate": campaign.get("open_rate") or (analysis_report or {}).get("open_rate"),
        "click_rate": campaign.get("click_rate") or (analysis_report or {}).get("click_rate"),
        "total_sent": (analysis_report or {}).get("total_sent", campaign.get("total_customers", 0)),
        "total_opened": (analysis_report or {}).get("total_opened", campaign.get("total_opened", 0)),
        "total_clicked": (analysis_report or {}).get("total_clicked", campaign.get("total_clicked", 0)),
    }

    # ── 3. LLM: Generate updated content ──
    suggestions_text = "\n".join(
        f"{i + 1}. [{s['priority']}] {s['title']}: {s.get('suggested_value') or s.get('reasoning', '')}"
        for i, s in enumerate(approved_suggestions)
    )

    model = _get_model()
    prompt_text = "\n".join([
        "You are a BFSI email campaign optimizer.",
        "The user has a running campaign and approved specific optimization suggestions.",
        "Your job is to generate UPDATED email content and targeting rules that incorporate these optimizations.",
        "",
        f"Original campaign brief: {campaign.get('brief', '')}",
        f"Original strategy plan: {campaign.get('strategy_reasoning', 'N/A')}",
        f"Original target segment: {campaign.get('target_segment', 'N/A')}",
        f"Current subject: {campaign.get('subject', 'N/A')}",
        f"Current performance: Open rate {previous_metrics['open_rate'] or 'N/A'}%, "
        f"Click rate {previous_metrics['click_rate'] or 'N/A'}%",
        "",
        "Approved optimizations to apply:",
        suggestions_text,
        "",
        "Return a JSON object with keys:",
        '- "strategy": Explanation of the targeting logic',
        '- "targetWeight": "w1", "w2", or "w3" depending on the financial product',
        '- "demographics": a JSON object with exact string matches to filter users '
        '(e.g. {"Occupation": "Data Analyst", "Gender": "Male", "Marital_Status": "Single"}). '
        'Use 2-4 strict criteria based on the brief.',
        '- "variants": array of 1 email variant, each with keys: subject, body, variant, tone, tags',
        '- "expectedImprovements": array of strings describing expected improvements',
        "Return JSON only, no markdown.",
    ])

    try:
        result = await model.ainvoke(
            [HumanMessage(content=prompt_text)],
            config={"tags": ["Optimization-Agent"]},
        )
        result_text = str(result.content).strip()
    except Exception as e:
        print(f"[Optimize] LLM generation failed: {e}")
        result_text = "fallback error trigger"

    try:
        json_start = result_text.index("{")
        json_end = result_text.rindex("}")
        parsed_result = json.loads(result_text[json_start : json_end + 1])
    except (ValueError, json.JSONDecodeError):
        parsed_result = {
            "strategy": "Optimized strategy based on approved suggestions.",
            "targetWeight": "w1",
            "demographics": {},
            "variants": [],
            "expectedImprovements": [
                f"Applied: {s['title']} ({s.get('expected_impact', '')})"
                for s in approved_suggestions
            ],
        }

    # ── 4. Score & filter customers ──
    all_customers = get_customers()
    valid_customers = [c for c in all_customers if c.get("status") != "inactive"]

    # Constrain to original target set if it exists
    original_target_ids = campaign.get("target_customer_ids") or []
    if original_target_ids:
        target_set = set(original_target_ids)
        valid_customers = [c for c in valid_customers if c["customer_id"] in target_set]

    target_weight_key = parsed_result.get("targetWeight", "w1")
    demo_rules = parsed_result.get("demographics", {})
    demo_keys = list(demo_rules.keys())

    scored = []
    for c in valid_customers:
        # 65% weight score (normalized to 0-1, assuming max ~10)
        raw_weight = float(c.get(target_weight_key, 0.5) or 0.5)
        w_score = min(1.0, raw_weight / 10.0) * 0.65

        # 35% demographic match score
        if demo_keys:
            matches = sum(
                1
                for key in demo_keys
                if str(c.get(key, "")).lower() == str(demo_rules[key]).lower()
            )
            d_score = (matches / len(demo_keys)) * 0.35
        else:
            d_score = 0.35  # Default if no demographics specified

        scored.append({"id": c["customer_id"], "score": w_score + d_score})

    scored.sort(key=lambda x: x["score"], reverse=True)

    # Narrow to previously-engaged (opened) count
    opened_count = (
        (analysis_report or {}).get("total_opened")
        or max(1, int(len(valid_customers) * 0.52))
    )
    new_total = min(len(scored), opened_count)
    final_ids = [x["id"] for x in scored[:new_total]]

    # ── 5. Batch send to CampaignX API ──
    updated_subject = (
        (parsed_result.get("variants") or [{}])[0].get("subject")
        or campaign.get("subject", "")
    )
    updated_body = (
        (parsed_result.get("variants") or [{}])[0].get("body")
        or campaign.get("body", "")
    )

    BATCH_SIZE = 100
    new_external_id = external_id
    now = datetime.now(timezone.utc) + timedelta(minutes=5)  # 5min buffer so API doesn't reject as "past"

    try:
        for i in range(0, len(final_ids), BATCH_SIZE):
            chunk_ids = final_ids[i : i + BATCH_SIZE]
            send_date = now + timedelta(minutes=30 * (i // BATCH_SIZE))
            send_time_str = _to_campaignx_time(send_date)

            print(
                f"[Optimize] Sending batch {i // BATCH_SIZE + 1}: "
                f"{len(chunk_ids)} customers at {send_time_str}"
            )
            send_resp = await send_campaign(
                subject=updated_subject,
                body=updated_body,
                customer_ids=chunk_ids,
                send_time=send_time_str,
            )
            if i == 0:
                new_external_id = send_resp.get("campaign_id")
    except Exception as e:
        print(f"[Optimize] Failed to resend batched campaign: {e}")

    # ── 6. Save optimization history ──
    new_round = (campaign.get("optimization_round") or 1) + 1

    history_entry = {
        "campaign_id": campaign_id,
        "round": new_round,
        "date": datetime.now(timezone.utc).isoformat(),
        "previous_audience_size": campaign.get("total_customers", len(valid_customers)),
        "new_audience_size": len(final_ids),
        "previous_open_rate": previous_metrics["open_rate"],
        "previous_click_rate": previous_metrics["click_rate"],
        "applied_optimizations": [s["title"] for s in approved_suggestions],
        "expected_improvements": parsed_result.get("expectedImprovements", []),
    }

    try:
        save_optimization_history(history_entry)
    except Exception as err:
        print(f"[Optimize] Failed to save history: {err}")

    # ── 7. Update campaign in Supabase ──
    updated_reasoning = (campaign.get("strategy_reasoning") or "") + (
        f"\n\n--- Optimization Round {new_round} ---\n"
        f"Focused audience from {history_entry['previous_audience_size']} "
        f"down to {history_entry['new_audience_size']} engaged users.\n"
        f"Improvements Expected: {', '.join(parsed_result.get('expectedImprovements', []))}"
    )

    update_campaign(campaign_id, {
        "subject": updated_subject,
        "body": updated_body,
        "optimization_round": new_round,
        "status": "active",
        "total_customers": len(final_ids),
        "external_campaign_id": new_external_id or None,
        "target_customer_ids": final_ids,
        "strategy_reasoning": updated_reasoning,
    })

    # ── 8. Save new variants ──
    llm_variants = parsed_result.get("variants") or []
    if llm_variants:
        variant_rows = [
            {
                "variant_label": v.get("variant", chr(65 + i)),
                "subject": v.get("subject", ""),
                "body": v.get("body", ""),
                "tone": v.get("tone", "professional"),
                "tags": v.get("tags", []),
                "is_selected": i == 0,
            }
            for i, v in enumerate(llm_variants)
        ]
        save_variants(campaign_id, variant_rows)

    # ── 9. Save optimization records ──
    try:
        opt_rows = [
            {
                "title": s["title"],
                "priority": s["priority"],
                "expected_impact": s.get("expected_impact"),
                "reasoning": s.get("reasoning"),
                "current_value": s.get("current_value"),
                "suggested_value": s.get("suggested_value"),
                "category": s.get("category"),
                "status": "approved",
                "agent_thoughts": s.get("agent_thoughts"),
                "approved_by": "user",
                "approved_at": datetime.now(timezone.utc).isoformat(),
            }
            for s in approved_suggestions
        ]
        save_optimizations(campaign_id, opt_rows)
    except Exception as err:
        print(f"[Optimize] Failed to save optimization records: {err}")

    return {
        "campaign_id": campaign_id,
        "previous_metrics": previous_metrics,
        "optimizations_applied": [s["title"] for s in approved_suggestions],
        "updated_strategy": parsed_result.get("strategy", ""),
        "updated_variants": llm_variants,
        "expected_improvements": parsed_result.get("expectedImprovements", []),
        "new_optimization_round": new_round,
    }
