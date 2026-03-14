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
import re
import sys
import random
from typing import Any, Callable
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

URL_RE = re.compile(r"https?://[^\s<>\"]+")
TwinProgressEmitter = Callable[[dict[str, Any]], None]
AgentMessageEmitter = Callable[[str, str, str], None]


def _extract_cta_link(brief: str) -> str:
    match = URL_RE.search(brief or "")
    return match.group(0) if match else ""


def _ensure_variant_has_cta_link(variant: EmailVariant, cta_link: str) -> EmailVariant:
    if not cta_link:
        return variant

    body = str(variant.get("body", "") or "").strip()
    if cta_link not in body:
        body = f"{body}\n\nExplore now: {cta_link}".strip()
    variant["body"] = body
    variant["cta_link"] = cta_link
    return variant


async def _build_twin_personas(segment: CustomerSegment) -> list[dict[str, Any]]:
    segment_name = segment.get("segment_name", "Unknown Segment")
    tier = segment.get("tier", "Unknown Tier")
    criteria = segment.get("criteria", "")

    prompt = f"""You are the Persona Architect for a BFSI Campaign Simulator.
The current campaign target segment is:
- Segment Name: {segment_name}
- Wealth/Value Tier: {tier}
- Qualifying Criteria: {criteria}

Your goal is to generate 5 highly realistic, distinct synthetic personas that belong EXACTLY to this segment profile.
Each persona must have the following keys:
- persona_id: ID like "persona-1"
- name: Realistic Indian Name
- age: Integer
- occupation: Realistic job title fitting the tier and criteria
- city: Indian metro or tier-2 city
- family_size: Integer
- credit_score: Integer (300 to 900)

Return ONLY a valid JSON array of 5 objects. Do not use markdown wrappers like ```json.
"""
    try:
        llm = _get_model()
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        text = str(response.content).strip()
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            json_str = text[start : end + 1]
            parsed = json.loads(json_str)
            if isinstance(parsed, list) and len(parsed) > 0:
                result_personas: list[dict[str, Any]] = []
                for i, p in enumerate(parsed):
                    if len(result_personas) >= 5:
                        break
                    if isinstance(p, dict):
                        p_dict = dict(p)
                        p_dict['persona_id'] = f"persona-{i+1}"
                        p_dict['name'] = p_dict.get('name', f"Persona {i+1}")
                        p_dict['occupation'] = p_dict.get('occupation', 'Professional')
                        p_dict['city'] = p_dict.get('city', 'Metro')
                        result_personas.append(p_dict)
                return result_personas

    except Exception as e:
        _safe_print(f"      [Simulator] Failed to dynamically generate personas: {e}. Using fallback.")

    # Fallback if the LLM fails to generate valid JSON
    base_personas = [
        {"persona_id": "persona-1", "name": "Aarav", "age": 29, "occupation": "Product Manager", "city": "Bengaluru", "family_size": 2, "credit_score": 742},
        {"persona_id": "persona-2", "name": "Meera", "age": 41, "occupation": "School Principal", "city": "Pune", "family_size": 4, "credit_score": 781},
        {"persona_id": "persona-3", "name": "Rohan", "age": 35, "occupation": "Chartered Accountant", "city": "Mumbai", "family_size": 3, "credit_score": 756},
        {"persona_id": "persona-4", "name": "Ananya", "age": 58, "occupation": "Retired Banker", "city": "Chennai", "family_size": 2, "credit_score": 804},
        {"persona_id": "persona-5", "name": "Kabir", "age": 32, "occupation": "Startup Founder", "city": "Hyderabad", "family_size": 3, "credit_score": 719},
    ]

    if tier == "Diamond":
        base_personas[0]["occupation"] = "Wealth Manager"
        base_personas[2]["occupation"] = "Investment Advisor"
    elif tier == "Gold":
        base_personas[1]["occupation"] = "Operations Head"
        base_personas[4]["occupation"] = "Business Owner"
    elif tier == "Silver":
        base_personas[0]["occupation"] = "Software Engineer"
        base_personas[4]["occupation"] = "Consultant"
    elif tier == "Reactivate":
        base_personas[3]["occupation"] = "Former Relationship Manager"
        base_personas[4]["credit_score"] = 690

    return base_personas


def _normalize_twin_decision(raw_decision: str) -> str:
    decision = str(raw_decision or "").upper()
    if decision == "CLICK":
        return "click"
    if decision == "OPEN":
        return "open"
    if decision == "IGNORE":
        return "ignore"
    return "pending"


def _emit_twin_progress(
    emit_progress: TwinProgressEmitter | None,
    *,
    segment: CustomerSegment,
    attempt: int,
    max_attempts: int,
    stage: str,
    draft_variant: EmailVariant,
    personas: list[dict[str, Any]],
    twin_results: list[dict[str, Any]],
    cta_link: str,
):
    if not emit_progress:
        return

    persona_cards: list[dict[str, Any]] = []
    for index, persona in enumerate(personas):
        result = twin_results[index] if index < len(twin_results) else None
        persona_cards.append(
            {
                "personaId": str(persona.get("persona_id", f"persona-{index + 1}")),
                "name": str(persona.get("name", f"Persona {index + 1}")),
                "occupation": str(persona.get("occupation", "")),
                "city": str(persona.get("city", "")),
                "decision": _normalize_twin_decision(result.get("decision", "")) if result else "pending",
                "monologue": str(result.get("monologue", "")) if result else "",
            }
        )

    emit_progress(
        {
            "segmentId": str(segment.get("segment_id", "")),
            "segmentName": str(segment.get("segment_name", "Segment")),
            "size": int(segment.get("size", 0)),
            "attempt": attempt,
            "maxAttempts": max_attempts,
            "stage": stage,
            "subject": str(draft_variant.get("subject", "")),
            "body": str(draft_variant.get("body", "")),
            "ctaLink": cta_link,
            "openVotes": sum(1 for item in twin_results if str(item.get("decision", "")).upper() == "OPEN"),
            "clickVotes": sum(1 for item in twin_results if str(item.get("decision", "")).upper() == "CLICK"),
            "ignoreVotes": sum(1 for item in twin_results if str(item.get("decision", "")).upper() == "IGNORE"),
            "personas": persona_cards,
        }
    )

async def generate_segment_variant(
    brief: str,
    strategy: str,
    segment: CustomerSegment,
    cta_link: str = "",
    emit_progress: TwinProgressEmitter | None = None,
    emit_agent_message: AgentMessageEmitter | None = None,
    past_metrics: dict | None = None,
    meta_strategy: dict | None = None,
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
    if emit_agent_message:
        emit_agent_message(
            "Bandit",
            f"Selected the {angle.upper()} angle for {segment.get('segment_name', 'this segment')} in the {tier} tier.",
            "decision",
        )
    
    _safe_print(f"      [Simulator] Generating dynamic synthetic personas for '{segment.get('segment_name', '')}'...")
    if emit_agent_message:
        emit_agent_message(
            "Twin Simulator",
            f"Building synthetic personas for {segment.get('segment_name', 'this segment')} before testing the draft.",
            "action",
        )
    personas = await _build_twin_personas(segment)

    # 3. War Room generates and Digital Twin tests (Loop up to 3 times)
    variant = None
    max_attempts = 3
    
    # Meta-Strategy explicit assignment (with random fallback for Round 1 exploration)
    if meta_strategy:
        length_constraint = meta_strategy.get("body_length", "medium")
        emoji_constraint = meta_strategy.get("emoji_usage", "moderate")
    else:
        # Fallback for round 1 where we have no past metrics
        length_constraint = random.choice(["short", "medium"])
        emoji_constraint = random.choice(["none", "moderate", "some"])
    
    for attempt_index in range(max_attempts):
        attempt = attempt_index + 1
        _safe_print(f"      [War Room] Generating draft {attempt} (Length: {length_constraint}, Emojis: {emoji_constraint})...")
        if emit_agent_message:
            emit_agent_message(
                "War Room",
                f"Generating attempt {attempt} for {segment.get('segment_name', 'this segment')} with {length_constraint} length and {emoji_constraint} emoji usage.",
                "action",
            )
        segment_profile = get_segment_profile(segment)
        draft_variant = await war_room.generate_variants(
            brief, tier, angle,
            segment_profile=segment_profile,
            past_metrics=past_metrics,
            length_constraint=length_constraint,
            emoji_constraint=emoji_constraint,
            meta_strategy=meta_strategy,
            emit_agent_message=emit_agent_message,
        )
        draft_variant = _ensure_variant_has_cta_link(draft_variant, cta_link)
        
        # Test draft using Digital Twin Simulation on 5 synthentic personas
        twin_results = []
        _emit_twin_progress(
            emit_progress,
            segment=segment,
            attempt=attempt,
            max_attempts=max_attempts,
            stage="testing",
            draft_variant=draft_variant,
            personas=personas,
            twin_results=twin_results,
            cta_link=cta_link,
        )
        for persona in personas:
            sim = await twin_engine.simulate_reaction(persona, draft_variant["subject"], draft_variant["body"])
            twin_results.append(sim)
            _emit_twin_progress(
                emit_progress,
                segment=segment,
                attempt=attempt,
                max_attempts=max_attempts,
                stage="testing",
                draft_variant=draft_variant,
                personas=personas,
                twin_results=twin_results,
                cta_link=cta_link,
            )
        
        clicks = sum(1 for r in twin_results if r["decision"] == "CLICK")
        opens = sum(1 for r in twin_results if r["decision"] == "OPEN")
        
        _safe_print(f"      [Simulator] Twin Test: {clicks} Clicks, {opens} Opens out of 5")
        if emit_agent_message:
            emit_agent_message(
                "Twin Simulator",
                f"Attempt {attempt} for {segment.get('segment_name', 'this segment')} scored {clicks} clicks and {opens} opens across {len(personas)} personas.",
                "observation",
            )
        
        if not twin_engine.bayesian_kill_rule(twin_results):
            # Survived the kill rule!
            bandit_engine.update_reward(tier, angle, opens, max(1, clicks), len(personas))
            variant = draft_variant
            if emit_agent_message:
                emit_agent_message(
                    "Bandit",
                    f"Rewarded the {angle.upper()} angle after the twin simulator approved attempt {attempt}.",
                    "summary",
                )
            _emit_twin_progress(
                emit_progress,
                segment=segment,
                attempt=attempt,
                max_attempts=max_attempts,
                stage="passed",
                draft_variant=draft_variant,
                personas=personas,
                twin_results=twin_results,
                cta_link=cta_link,
            )
            break
        else:
            _safe_print("      [Simulator] Kill Rule triggered. Variant failed test. Regenerating.")
            bandit_engine.update_reward(tier, angle, 0, 0, len(personas))
            if emit_agent_message:
                emit_agent_message(
                    "Twin Simulator",
                    f"Kill rule triggered for {segment.get('segment_name', 'this segment')} on attempt {attempt}; requesting a fresh draft.",
                    "decision",
                )
            _emit_twin_progress(
                emit_progress,
                segment=segment,
                attempt=attempt,
                max_attempts=max_attempts,
                stage="retrying",
                draft_variant=draft_variant,
                personas=personas,
                twin_results=twin_results,
                cta_link=cta_link,
            )
            angle = bandit_engine.select_action(tier)
            _safe_print(f"      [Bandit] Retrying with Angle: {angle.upper()}")
            if emit_agent_message:
                emit_agent_message(
                    "Bandit",
                    f"Retrying {segment.get('segment_name', 'this segment')} with the {angle.upper()} angle after the failed draft.",
                    "decision",
                )
            
    if not variant:
        # Fallback if all 3 attempts failed the simulator (unlikely)
        variant = draft_variant
        if emit_agent_message:
            emit_agent_message(
                "War Room",
                f"All twin attempts failed for {segment.get('segment_name', 'this segment')}; using the last draft as fallback.",
                "decision",
            )
        _emit_twin_progress(
            emit_progress,
            segment=segment,
            attempt=max_attempts,
            max_attempts=max_attempts,
            stage="fallback",
            draft_variant=variant,
            personas=personas,
            twin_results=twin_results,
            cta_link=cta_link,
        )

    if "tags" not in variant:
        variant["tags"] = []
    variant["tags"].extend([tier, angle])
    variant["variant"] = segment["segment_name"]
    if "tone" not in variant:
        variant["tone"] = angle
        
    return variant

async def generate_content(
    state: WorkflowState,
    emit_progress: TwinProgressEmitter | None = None,
    emit_agent_message: AgentMessageEmitter | None = None,
) -> dict:
    """
    LangGraph node: Generate one tailored email per segment using Autonomous Growth Engine.
    """
    segments = state.get("segments", [])
    brief = state.get("brief", "")
    cta_link = state.get("cta_link", "") or _extract_cta_link(brief)
    strategy = state.get("strategy", "")

    _safe_print(f"\n[Autonomous Growth Engine] Activating War Room for {len(segments)} segments")

    if not segments:
        return state

    all_variants: list[EmailVariant] = []
    segment_variant_map: dict[str, EmailVariant] = {}

    async def _process_segment(seg):
        _safe_print(f"  [Orchestrator] Processing Segment (Parallel): {seg['segment_name']} ({seg['size']} customers)")
        if emit_agent_message:
            emit_agent_message(
                "Orchestrator",
                f"Processing {seg['segment_name']} with {seg['size']} customers in parallel.",
                "action",
            )
        if emit_progress:
            emit_progress(
                {
                    "segmentId": str(seg.get("segment_id", "")),
                    "segmentName": str(seg.get("segment_name", "Segment")),
                    "size": int(seg.get("size", 0)),
                    "attempt": 0,
                    "maxAttempts": 3,
                    "stage": "queued",
                    "subject": "",
                    "body": "",
                    "ctaLink": cta_link,
                    "openVotes": 0,
                    "clickVotes": 0,
                    "ignoreVotes": 0,
                    "personas": [],
                }
            )
        variant = await generate_segment_variant(
            brief,
            strategy,
            seg,
            cta_link=cta_link,
            emit_progress=emit_progress,
            emit_agent_message=emit_agent_message,
        )
        variant = _ensure_variant_has_cta_link(variant, cta_link)
        _safe_print(f"    [OK] Final Subject ({seg['segment_name'][:20]}...): {variant['subject'][:60]}...")
        if emit_agent_message:
            emit_agent_message(
                "Content Agent",
                f"Locked the final approved draft for {seg['segment_name']}.",
                "summary",
            )
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
        "cta_link": cta_link,
        "steps": [
            {
                "agent": "Autonomous-Growth-Engine",
                "step": f"Generated {len(all_variants)} segment variants using War Room + Bandit + Twin Simulator.",
            }
        ],
    }
