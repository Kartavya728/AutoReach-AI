"""
Content Agent — LangGraph Node (Segment-Aware)
================================================
Generates a DIFFERENT email variant for EACH segment using Gemini.
Each segment gets tailored subject, body, tone, and CTA.

Instead of "3 generic variants", we now produce:
  1 variant × N segments = N hyper-personalized emails

Corresponds to: `generate_content` node in langgraph.js (upgraded)
"""

from __future__ import annotations
import asyncio
import json
import sys
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.state import WorkflowState, EmailVariant, CustomerSegment
from backend.config import GEMINI_API_KEY, GEMINI_MODEL
from backend.segment_engine import get_segment_profile


def _get_model() -> ChatGoogleGenerativeAI:
    if not GEMINI_API_KEY:
        raise EnvironmentError("Missing GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.7,
    )


def _safe_print(message: str):
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    safe_message = message.encode(encoding, errors="replace").decode(encoding, errors="replace")
    print(safe_message)


def _parse_single_variant(text: str, segment_name: str) -> EmailVariant | None:
    """Parse a single JSON email variant from LLM text."""
    trimmed = text.strip()

    # Try JSON object first
    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(trimmed[start : end + 1])
            return {
                "subject": str(obj.get("subject", f"Offer for {segment_name}")),
                "body": str(obj.get("body", "")),
                "variant": str(obj.get("variant", segment_name)),
                "tone": str(obj.get("tone", "professional")),
                "tags": [str(t) for t in obj.get("tags", [])] if isinstance(obj.get("tags"), list) else [],
            }
        except json.JSONDecodeError:
            pass

    # Try JSON array
    start = trimmed.find("[")
    end = trimmed.rfind("]")
    if start != -1 and end > start:
        try:
            arr = json.loads(trimmed[start : end + 1])
            if arr and isinstance(arr, list):
                obj = arr[0]
                return {
                    "subject": str(obj.get("subject", f"Offer for {segment_name}")),
                    "body": str(obj.get("body", "")),
                    "variant": str(obj.get("variant", segment_name)),
                    "tone": str(obj.get("tone", "professional")),
                    "tags": [str(t) for t in obj.get("tags", [])] if isinstance(obj.get("tags"), list) else [],
                }
        except json.JSONDecodeError:
            pass

    return None


from backend.twin_simulator import twin_engine
from backend.war_room import war_room
from backend.bandit import bandit_engine

async def generate_segment_variant(
    brief: str,
    strategy: str,
    segment: CustomerSegment,
) -> EmailVariant:
    """Generate a high-performing email variant using the Multi-Agent War Room, Bandit, and Sim."""
    
    # 1. Get tier from segment (set by the data-aware segment engine)
    #    Falls back to keyword heuristic if tier not present
    tier = segment.get('tier', '')
    if tier not in ('Diamond', 'Gold', 'Silver', 'Reactivate'):
        # Fallback heuristic for retarget segments that don't have a tier
        seg_name_lower = segment['segment_name'].lower()
        criteria_lower = segment.get('criteria', '').lower()
        combined = seg_name_lower + ' ' + criteria_lower
        
        if any(kw in combined for kw in ['high-value', 'diamond', 'premium', 'high income', 'high earner', 'wealthy']):
            tier = 'Diamond'
        elif any(kw in combined for kw in ['loyal', 'gold', 'existing', 'trust']):
            tier = 'Gold'
        elif any(kw in combined for kw in ['senior', 'silver', 'young', 'digital', 'native']):
            tier = 'Silver'
        else:
            tier = 'Reactivate'
        
    # 2. Contextual bandit chooses the angle for this tier.
    angle = bandit_engine.select_action(tier)
    _safe_print(f"      [Bandit] Selected Angle: {angle.upper()} for Tier: {tier}")
    
    # 3. War Room generates and Digital Twin tests (Loop up to 3 times)
    variant = None
    for attempt in range(3):
        _safe_print(f"      [War Room] Generating draft {attempt+1}...")
        draft_variant = await war_room.generate_variants(brief, tier, angle)
        
        # Test draft using Digital Twin Simulation on 5 synthentic personas
        twin_results = []
        for sim_idx in range(5):
            mock_user = {"name": f"Mock_{sim_idx}", "age": 35, "occupation": "Professional", "city": "Delhi", "family_size": 2, "credit_score": 700}
            sim = await twin_engine.simulate_reaction(mock_user, draft_variant["subject"], draft_variant["body"])
            twin_results.append(sim)
        
        clicks = sum(1 for r in twin_results if r["decision"] == "CLICK")
        opens = sum(1 for r in twin_results if r["decision"] == "OPEN")
        
        _safe_print(f"      [Simulator] Twin Test: {clicks} Clicks, {opens} Opens out of 5")
        
        if not twin_engine.bayesian_kill_rule(twin_results):
            # Survived the kill rule!
            bandit_engine.update_reward(tier, angle, max(1, clicks))
            variant = draft_variant
            break
        else:
            _safe_print("      [Simulator] Kill Rule triggered. Variant failed test. Regenerating.")
            bandit_engine.update_reward(tier, angle, 0)
            angle = bandit_engine.select_action(tier)
            _safe_print(f"      [Bandit] Retrying with Angle: {angle.upper()}")
            
    if not variant:
        # Fallback if all 3 attempts failed the simulator (unlikely)
        variant = draft_variant

    if "tags" not in variant:
        variant["tags"] = []
    variant["tags"].extend([tier, angle])
    variant["variant"] = segment["segment_name"]
    if "tone" not in variant:
        variant["tone"] = angle
        
    return variant

async def generate_content(state: WorkflowState) -> dict:
    """
    LangGraph node: Generate one tailored email per segment using Autonomous Growth Engine.
    """
    segments = state.get("segments", [])
    brief = state.get("brief", "")
    strategy = state.get("strategy", "")

    _safe_print(f"\n[Autonomous Growth Engine] Activating War Room for {len(segments)} segments")

    if not segments:
        return state

    all_variants: list[EmailVariant] = []
    segment_variant_map: dict[str, EmailVariant] = {}

    async def _process_segment(seg):
        _safe_print(f"  [Orchestrator] Processing Segment (Parallel): {seg['segment_name']} ({seg['size']} customers)")
        variant = await generate_segment_variant(brief, strategy, seg)
        _safe_print(f"    [OK] Final Subject ({seg['segment_name'][:20]}...): {variant['subject'][:60]}...")
        return seg["segment_id"], variant

    valid_segments = [seg for seg in segments if seg["size"] > 0]
    results = await asyncio.gather(*[_process_segment(seg) for seg in valid_segments])

    for seg_id, variant in results:
        all_variants.append(variant)
        segment_variant_map[seg_id] = variant

    _safe_print(f"\n[Autonomous Growth Engine] Finished - {len(all_variants)} winning variants deployed.")

    return {
        **state,
        "content_variants": all_variants,
        "segment_variants": segment_variant_map,
        "steps": [
            {
                "agent": "Autonomous-Growth-Engine",
                "step": f"Generated {len(all_variants)} segment variants using War Room + Bandit + Twin Simulator.",
            }
        ],
    }
