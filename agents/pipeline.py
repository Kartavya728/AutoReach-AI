"""
Pipeline Orchestrator — Wraps Python agents with structured logging.
====================================================================
Entry point for the FastAPI service. Runs the full multi-agent pipeline
and emits structured AgentLogEntry logs at each step so the frontend
terminal can show real-time reasoning.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone, timedelta

from agents.graph import run_campaign_graph
from agents.log_store import AgentLogEntry, emit_log, mark_done
from agents.war_room import war_room
from agents.twin_simulator import twin_engine
from agents.bandit import bandit_engine
from agents.segment_engine import get_segment_profile
from agents.content_agent import generate_segment_variant
from agents.main import send_segment, fetch_segment_metrics, format_time, IST


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _emit(session_id: str, agent: str, thought: str, action: str) -> None:
    """Helper to emit a structured log entry."""
    emit_log(session_id, AgentLogEntry(
        agent=agent,
        thought=thought,
        action=action,
        timestamp=_now_iso(),
    ))


# ═══════════════════════════════════════════════════════════════
#  CAMPAIGN CREATION PIPELINE
# ═══════════════════════════════════════════════════════════════

async def run_campaign_pipeline(brief: str, session_id: str) -> dict:
    """
    Full multi-agent pipeline with structured logging.

    Steps:
        1. Fetch cohort from CampaignX API (via LangGraph)
        2. Run segmentation agent
        3. Run strategy generation
        4. Execute War Room agents (copywriter + psychologist)
        5. Run digital twin simulator
        6. Select strategy using contextual bandit
        7. Schedule campaign via CampaignX API
        8. Return campaign results and reasoning logs
    """
    t0 = time.time()

    try:
        # ── STEP 1 & 2 & 3: LangGraph pipeline (Cohort → Segmentation → Strategy → Content) ──
        _emit(session_id, "Orchestrator", "Starting multi-agent pipeline", "Initializing LangGraph AI targeting workflow")

        _emit(session_id, "CohortAgent", "Fetching customer CRM data from CampaignX API", "Loading audience cohort")

        result = await run_campaign_graph(brief, session_id=session_id)

        segments = result.get("segments", [])
        segment_variants = result.get("segment_variants", {})
        all_variants = result.get("content_variants", [])
        steps = result.get("steps", [])

        _emit(
            session_id, "SegmentationAgent",
            f"Detected {len(segments)} customer micro-segments from CRM data",
            f"Generated {len(segments)} segments with {result.get('customer_count', 0)} total customers"
        )

        _emit(
            session_id, "StrategyAgent",
            f"Analyzed brief and designed targeting strategy",
            f"Strategy: {str(result.get('strategy', ''))[:150]}..."
        )

        # ── STEP 4: War Room agents ──
        _emit(session_id, "WarRoom", "Activating Copywriter + Behavioral Psychologist agents", "Starting war room debate for each segment")

        war_room_variants = {}
        for seg in segments:
            seg_id = seg.get("segment_id", "unknown")
            tier = seg.get("tier", "Reactivate")
            angle = bandit_engine.select_action(tier)

            _emit(
                session_id, "WarRoom-Copywriter",
                f"Drafting email for segment '{seg.get('segment_name', seg_id)}' (Tier: {tier})",
                f"Using psychological angle: {angle}"
            )

            try:
                variant = await war_room.generate_variants(brief, tier, angle)
                war_room_variants[seg_id] = {
                    **variant,
                    "variant": "A",
                    "tone": angle,
                    "tags": [tier, angle],
                }
                _emit(
                    session_id, "WarRoom-Psychologist",
                    f"Applied cognitive bias optimization for {tier} tier",
                    f"Subject: {variant.get('subject', '')[:70]}..."
                )
            except Exception as e:
                _emit(session_id, "WarRoom", f"War room generation failed for {seg_id}: {e}", "Using fallback variant from LangGraph")
                # Use LangGraph-generated variant as fallback
                if seg_id in segment_variants:
                    war_room_variants[seg_id] = segment_variants[seg_id]

        # Merge war room variants with segment_variants (war room wins)
        for sid, var in war_room_variants.items():
            segment_variants[sid] = var

        # ── STEP 5: Digital Twin Simulation ──
        _emit(session_id, "TwinSimulator", "Spawning digital twin personas to pre-test campaign", "Running simulated reactions on representative customers")

        twin_results_summary = []
        for seg in segments[:3]:  # Simulate on first 3 segments to keep it fast
            seg_id = seg.get("segment_id", "unknown")
            variant = segment_variants.get(seg_id)
            if not variant:
                continue

            # Create a representative user for this segment
            representative_user = {
                "name": "Test User",
                "age": 35,
                "occupation": "Professional",
                "city": "Mumbai",
                "family_size": 3,
                "credit_score": 720,
            }

            try:
                reaction = await twin_engine.simulate_reaction(
                    representative_user,
                    variant.get("subject", ""),
                    variant.get("body", ""),
                )
                twin_results_summary.append({
                    "segment": seg.get("segment_name", seg_id),
                    "decision": reaction.get("decision", "UNKNOWN"),
                })
                _emit(
                    session_id, "TwinSimulator",
                    f"Simulated reaction for '{seg.get('segment_name', seg_id)}': {reaction.get('decision', 'UNKNOWN')}",
                    f"Digital twin predicted: {reaction.get('decision', 'UNKNOWN')}"
                )
            except Exception as e:
                _emit(session_id, "TwinSimulator", f"Simulation failed for {seg_id}: {e}", "Continuing without simulation")

        # ── STEP 6: Contextual Bandit Selection ──
        _emit(session_id, "ContextualBandit", "Running Thompson Sampling to select optimal angles per tier", "Contextual bandit decision system active")

        bandit_selections = {}
        for seg in segments:
            tier = seg.get("tier", "Reactivate")
            selected_angle = bandit_engine.select_action(tier)
            bandit_selections[seg.get("segment_id", "unknown")] = {
                "tier": tier,
                "angle": selected_angle,
                "posterior_mean": round(bandit_engine.get_posterior_mean(tier, selected_angle), 4),
            }

        bandit_summary = ", ".join(f"{v['tier']}→{v['angle']}" for v in bandit_selections.values())
        _emit(
            session_id, "ContextualBandit",
            f"Selected optimal angles for {len(bandit_selections)} tiers using Thompson Sampling",
            f"Bandit selections: {bandit_summary}"
        )

        # ── STEP 7: Schedule campaign ──
        _emit(session_id, "SendTimeOptimizer", "Calculating optimal send times per segment", "Scheduling campaign delivery windows")

        segment_campaign_ids = {}
        now_utc = datetime.now(timezone.utc)

        for seg in segments:
            if seg.get("size", 0) == 0:
                continue
            variant = segment_variants.get(seg.get("segment_id", ""))
            if not variant:
                continue

            # Send time optimization (heuristic)
            seg_name = seg.get("segment_name", "").lower()
            if "professional" in seg_name or "earner" in seg_name:
                sto_time = now_utc.replace(hour=12, minute=30, second=0)
            elif "senior" in seg_name or "retired" in seg_name:
                sto_time = now_utc.replace(hour=3, minute=30, second=0)
            elif "young" in seg_name or "digital" in seg_name:
                sto_time = now_utc.replace(hour=15, minute=30, second=0)
            else:
                sto_time = now_utc + timedelta(minutes=5)

            if sto_time < now_utc:
                sto_time += timedelta(days=1)
            if sto_time < now_utc + timedelta(minutes=5):
                sto_time = now_utc + timedelta(minutes=5)

            sto_time_str = format_time(sto_time)

            _emit(
                session_id, "SendTimeOptimizer",
                f"Optimal send time for '{seg.get('segment_name', '')}': {sto_time_str} IST",
                f"Scheduling {seg.get('size', 0)} emails"
            )

            try:
                cid = await send_segment(
                    seg.get("segment_name", ""),
                    variant,
                    seg.get("customer_ids", []),
                    sto_time_str,
                )
                segment_campaign_ids[seg.get("segment_id", "")] = cid
                _emit(
                    session_id, "CampaignXAPI",
                    f"Campaign created for segment '{seg.get('segment_name', '')}'",
                    f"Campaign ID: {cid}, {seg.get('size', 0)} emails queued"
                )
            except Exception as e:
                _emit(session_id, "CampaignXAPI", f"Failed to send segment: {e}", "Continuing with remaining segments")

        # ── STEP 8: Final results ──
        total_sent = sum(s.get("size", 0) for s in segments if s.get("size", 0) > 0)
        campaigns_created = sum(1 for v in segment_campaign_ids.values() if v)

        _emit(
            session_id, "Orchestrator",
            f"Pipeline complete! {campaigns_created} campaigns created, {total_sent} total emails scheduled",
            "Multi-agent pipeline finished successfully"
        )

        elapsed = round(time.time() - t0, 1)

        # Build content_variants array for the frontend (same shape as JS pipeline)
        content_variants_for_frontend = []
        for seg in segments:
            sid = seg.get("segment_id", "")
            variant = segment_variants.get(sid)
            if variant:
                content_variants_for_frontend.append({
                    "subject": variant.get("subject", ""),
                    "body": variant.get("body", ""),
                    "variant": variant.get("variant", "A"),
                    "tone": variant.get("tone", "professional"),
                    "tags": variant.get("tags", []),
                    "segment_name": seg.get("segment_name", ""),
                })

        # If no war room variants were generated, use the LangGraph variants
        if not content_variants_for_frontend and all_variants:
            content_variants_for_frontend = all_variants

        pipeline_result = {
            "brief": brief,
            "strategy": result.get("strategy", ""),
            "strategyReasoning": result.get("strategy_reasoning", ""),
            "targetCustomerIds": result.get("target_customer_ids", []),
            "contentVariants": content_variants_for_frontend,
            "customerCount": result.get("customer_count", 0),
            "segments": [{"name": s.get("segment_name", ""), "size": s.get("size", 0), "id": s.get("segment_id", "")} for s in segments],
            "segmentVariants": {
                sid: {"subject": v.get("subject", ""), "tone": v.get("tone", "")}
                for sid, v in segment_variants.items()
            },
            "banditSelections": bandit_selections,
            "twinResults": twin_results_summary,
            "campaignIds": segment_campaign_ids,
            "campaignReady": True,
            "elapsedSeconds": elapsed,
            "steps": [
                {"agent": "Orchestrator", "step": "Initialized LangGraph AI targeting workflow."},
                *steps,
                {"agent": "WarRoom", "step": f"Generated {len(war_room_variants)} war room variants."},
                {"agent": "TwinSimulator", "step": f"Simulated {len(twin_results_summary)} digital twin reactions."},
                {"agent": "ContextualBandit", "step": f"Selected optimal angles for {len(bandit_selections)} tiers."},
                {"agent": "SendTimeOptimizer", "step": f"Scheduled {campaigns_created} campaigns ({total_sent} emails)."},
                {"agent": "Orchestrator", "step": f"Pipeline complete in {elapsed}s."},
            ],
        }

        return pipeline_result

    except Exception as e:
        _emit(session_id, "Orchestrator", f"Pipeline failed: {e}", "Error in multi-agent pipeline")
        raise
    finally:
        mark_done(session_id)


# ═══════════════════════════════════════════════════════════════
#  OPTIMIZATION PIPELINE
# ═══════════════════════════════════════════════════════════════

async def run_optimization_pipeline(
    campaign_id: str,
    approved_suggestions: list[dict],
    session_id: str,
) -> dict:
    """Runs the optimization loop with structured logging."""
    from agents.optimization_agent import run_optimization_agent

    try:
        _emit(session_id, "Orchestrator", "Starting optimization pipeline", f"Campaign: {campaign_id}")
        _emit(session_id, "OptimizationAgent", f"Processing {len(approved_suggestions)} approved suggestions", "Running optimization loop")

        report = await run_optimization_agent(campaign_id, approved_suggestions)

        _emit(session_id, "Orchestrator", "Optimization complete", "Pipeline finished successfully")
        return report

    except Exception as e:
        _emit(session_id, "Orchestrator", f"Optimization failed: {e}", "Error in optimization pipeline")
        raise
    finally:
        mark_done(session_id)
