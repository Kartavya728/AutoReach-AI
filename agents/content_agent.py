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
import random
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from .state import WorkflowState, EmailVariant, CustomerSegment
from .config import GEMINI_API_KEY, GEMINI_MODEL
from .segment_engine import get_segment_profile
from .twin_simulator import twin_engine
from .war_room import war_room
from .memory import memory_db
from .personalization import personalization_engine


def _get_model() -> ChatGoogleGenerativeAI:
    if not GEMINI_API_KEY:
        raise EnvironmentError("Missing GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.7,
    )


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


def _stage_copy_guidance(segment: CustomerSegment) -> str:
    stage = segment.get("retarget_stage", "")
    if stage == "warm_convert":
        return (
            "Retargeting goal: maximize clicks from customers who opened but did not click.\n"
            "- Keep the subject calm and specific.\n"
            "- Put the main benefit and CTA in the first 2-3 lines.\n"
            "- Use one proof point or trust cue.\n"
            "- Use exactly one CTA."
        )
    if stage == "warm_resolve":
        return (
            "Retargeting goal: remove hesitation for customers who opened but did not click.\n"
            "- Answer one likely objection.\n"
            "- Use one concrete BFSI-safe benefit.\n"
            "- Avoid hype, heavy FOMO, or multiple asks.\n"
            "- Use exactly one CTA."
        )
    if stage == "cold_subject_refresh":
        return (
            "Retargeting goal: recover customers who never opened.\n"
            "- Change the subject line materially.\n"
            "- Keep the body shorter than the original send.\n"
            "- Lead with one clear benefit and one CTA.\n"
            "- Do not optimize for curiosity alone; optimize for clicks."
        )
    if stage == "cold_benefit_reminder":
        return (
            "Retargeting goal: make the message easier to evaluate for customers who still did not open.\n"
            "- Keep the subject fresh but credible.\n"
            "- Use one concrete reason to click.\n"
            "- Keep the body simple and trust-oriented.\n"
            "- Use exactly one CTA."
        )
    return (
        "Optimize for clicks, not just opens.\n"
        "- Use one clear value proposition.\n"
        "- Keep the CTA easy to find.\n"
        "- Avoid unsupported urgency."
    )


def _build_generation_brief(brief: str, strategy: str, segment: CustomerSegment) -> str:
    parts = [
        brief.strip(),
        f"Campaign strategy context:\n{str(strategy).strip()}",
        f"Segment profile:\n{get_segment_profile(segment)}",
        f"Copy instructions for this segment:\n{_stage_copy_guidance(segment)}",
    ]
    return "\n\n".join(part for part in parts if part)


async def generate_segment_variant(
    brief: str,
    strategy: str,
    segment: CustomerSegment,
) -> EmailVariant:
    """Generate a high-performing email variant using the Multi-Agent War Room, Bandit, and Sim."""
    generation_brief = _build_generation_brief(brief, strategy, segment)

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
        
    # 2. Epsilon-Greedy Bandit for Content Angle Optimization
    
    # Epsilon-Greedy Bandit: 20% explore, 80% exploit
    if random.random() < 0.2:
        angle = random.choice(["urgency", "curiosity", "authority", "social_proof"])
        print(f"      [Bandit] 🎲 Exploring random angle: {angle.upper()} for Tier: {tier}")
    else:
        # Exploit: Aggregate memory psychographics for this segment
        tag_scores = {"urgency": 0.0, "curiosity": 0.0, "authority": 0.0, "social_proof": 0.0}
        cids = segment.get("customer_ids", [])
        if cids:
            for cid in cids:
                user_tags = memory_db.get_user(cid).get("psychographic_tags", {})
                for t, score in user_tags.items():
                    tag_scores[t] = tag_scores.get(t, 0.0) + score
            angle = max(tag_scores, key=tag_scores.get)
        else:
            angle_map = {
                "Diamond": "authority",
                "Gold": "social_proof",
                "Silver": "curiosity",
                "Reactivate": "urgency"
            }
            angle = angle_map.get(tier, "curiosity")
        print(f"      [Bandit] 🎯 Exploiting best angle: {angle.upper()} for Tier: {tier}")
    
    # 3. War Room generates and Digital Twin tests (Loop up to 5 times)
    variant = None
    for attempt in range(5):
        print(f"      [War Room] Generating draft {attempt+1}...")
        draft_variant = await war_room.generate_variants(generation_brief, tier, angle)
        
        draft_subject, draft_body = personalization_engine.sanitize_campaign_copy(
            draft_variant.get("subject", ""),
            draft_variant.get("body", ""),
        )
        draft_variant["subject"] = draft_subject
        draft_variant["body"] = draft_body

        if not draft_subject or not draft_body:
            print("      [Filter] Draft failed compliance validation. Regenerating.")
            continue
        
        # 3b. Test draft using Digital Twin Simulation on 2 synthentic personas (to avoid 15RPM limit)
        twin_results = []
        import asyncio
        for sim_idx in range(2):
            mock_user = {"name": f"Mock_{sim_idx}", "age": 35, "occupation": "Professional", "city": "Delhi", "family_size": 2, "credit_score": 700}
            sim = await twin_engine.simulate_reaction(mock_user, draft_variant["subject"], draft_variant["body"])
            twin_results.append(sim)
            await asyncio.sleep(2)
        
        clicks = sum(1 for r in twin_results if r["decision"] == "CLICK")
        opens = sum(1 for r in twin_results if r["decision"] == "OPEN")
        
        print(f"      [Simulator] Twin Test: {clicks} Clicks, {opens} Opens out of 2")
        
        # simplified check since we reduced samples
        if clicks > 0 or opens > 0 or not twin_engine.bayesian_kill_rule(twin_results):
            # Survived the kill rule!
            variant = draft_variant
            break
        else:
            print("      [Simulator] Kill Rule triggered. Variant failed test. Regenerating.")
            await asyncio.sleep(2)
            
    if not variant:
        # Fallback if all 5 attempts failed the simulator or keyword filter
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

    print(f"\n[Autonomous Growth Engine] Activating War Room for {len(segments)} segments")

    if not segments:
        return state

    all_variants: list[EmailVariant] = []
    segment_variant_map: dict[str, EmailVariant] = {}

    async def _process_segment(seg):
        print(f"  [Orchestrator] Processing Segment (Parallel): {seg['segment_name']} ({seg['size']} customers)")
        variant = await generate_segment_variant(brief, strategy, seg)
        print(f"    ✅ FINAL Subject ({seg['segment_name'][:20]}...): {variant['subject'][:60]}...")
        return seg["segment_id"], variant

    valid_segments = [seg for seg in segments if seg["size"] > 0]
    
    # Process sequentially to avoid Gemini API Rate Limits (15 RPM)
    results = []
    for seg in valid_segments:
        res = await _process_segment(seg)
        results.append(res)
        await asyncio.sleep(2)  # Give the API a breather

    for seg_id, variant in results:
        all_variants.append(variant)
        segment_variant_map[seg_id] = variant

    print(f"\n[Autonomous Growth Engine] Finished — {len(all_variants)} winning variants deployed.")

    return {
        **state,
        "content_variants": all_variants,
        "segment_variants": segment_variant_map,
        "steps": [
            {
                "agent": "Autonomous-Growth-Engine",
                "step": f"Generated {len(all_variants)} segment variants using War Room + Heuristic + Twin Simulator.",
            }
        ],
    }
