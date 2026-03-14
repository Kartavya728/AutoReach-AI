"""
Segment Engine — Customer Micro-Segmentation (Data-Aware Dynamic LLM)
======================================================================
Uses Gemini to dynamically generate targeting segments based on the
campaign brief AND actual customer data statistics (ranges, distributions).
"""

from __future__ import annotations
import json
import operator
import sys
from collections import Counter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.state import CustomerRecord, CustomerSegment
from backend.config import GEMINI_API_KEY, GEMINI_MODEL


def _get_model() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.2,
    )


def _safe_print(message: str):
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    safe_message = message.encode(encoding, errors="replace").decode(encoding, errors="replace")
    print(safe_message)


# ══════════════════════════════════════════════════════════════
#  RULE EVALUATOR
# ══════════════════════════════════════════════════════════════

def _evaluate_rule(rule: dict, customer: CustomerRecord) -> bool:
    """Evaluates a single rule like {"field": "income", "op": ">", "value": 300000}"""
    field = rule.get("field")
    op = rule.get("op")
    value = rule.get("value")

    if not field or not op:
        return True

    c_val = customer.get(field)

    # Handle missing values
    if c_val is None:
        if op == "==" and value in [None, "None", ""]:
            return True
        return False

    # Cast c_val to match value type
    try:
        if isinstance(value, (int, float)):
            c_val = float(c_val)
        elif isinstance(value, str):
            c_val = str(c_val).lower()
            value = value.lower()
    except (ValueError, TypeError):
        return False

    ops = {
        "==": operator.eq,
        "!=": operator.ne,
        ">": operator.gt,
        "<": operator.lt,
        ">=": operator.ge,
        "<=": operator.le,
        "contains": lambda a, b: str(b) in str(a),
    }

    func = ops.get(op)
    if not func:
        return False

    try:
        return func(c_val, value)
    except Exception:
        return False


def _evaluate_condition(cond: dict, customer: CustomerRecord) -> bool:
    """Evaluates an OR/AND block or a single rule."""
    if "AND" in cond:
        return all(_evaluate_rule(r, customer) for r in cond["AND"])
    elif "OR" in cond:
        return any(_evaluate_rule(r, customer) for r in cond["OR"])
    else:
        return _evaluate_rule(cond, customer)


# ══════════════════════════════════════════════════════════════
#  DATA PROFILER — Builds statistical summary for the LLM
# ══════════════════════════════════════════════════════════════

def _build_field_profile(crm_data: list[CustomerRecord]) -> str:
    """Analyze actual data ranges and distributions to give the LLM real context."""
    if not crm_data:
        return "No data available."

    # Fields to profile
    numeric_fields = ["age", "income", "credit_score", "family_size", "kids", "w1", "w2", "w3"]
    categorical_fields = ["gender", "occupation", "city", "marital_status", "kyc_status",
                          "app_installed", "existing_customer", "social_media_active"]

    lines = []
    lines.append("=== CRM DATA PROFILE (from real customer records) ===")
    lines.append(f"Total customers: {len(crm_data)}")
    lines.append("")

    # Numeric summaries
    lines.append("NUMERIC FIELDS:")
    for field in numeric_fields:
        vals = []
        for c in crm_data:
            v = c.get(field)
            if v is not None:
                try:
                    vals.append(float(v))
                except (ValueError, TypeError):
                    pass
        if vals:
            lines.append(
                f"  {field}: min={min(vals):.0f}, max={max(vals):.0f}, "
                f"mean={sum(vals)/len(vals):.0f}, count={len(vals)}"
            )

    lines.append("")

    # Categorical summaries
    lines.append("CATEGORICAL FIELDS:")
    for field in categorical_fields:
        counter: Counter = Counter()
        for c in crm_data:
            v = c.get(field)
            if v is not None:
                counter[str(v)] += 1
        if counter:
            top_5 = counter.most_common(5)
            dist = ", ".join(f"{k}({v})" for k, v in top_5)
            lines.append(f"  {field}: {dist}")

    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════
#  DYNAMIC SEGMENT GENERATOR (Single LLM call)
# ══════════════════════════════════════════════════════════════

async def generate_dynamic_segments(brief: str, crm_data: list[CustomerRecord]) -> list[dict]:
    """
    Single-call approach: Gemini sees the brief + real data profile + sample records,
    then identifies key factors AND generates segments in one shot.
    """
    llm = _get_model()

    # Build the data profile from ALL records
    data_profile = _build_field_profile(crm_data)

    # Send 3 sample records as JSON (with real values)
    sample_records = []
    for c in crm_data[:3]:
        sample_records.append({k: v for k, v in c.items() if k != "id"})

    fields = list(crm_data[0].keys()) if crm_data else []

    sys_prompt = f"""You are an elite Growth AI creating customer micro-segments for a targeted email campaign.

STEP 1: Read the Campaign Brief and identify what types of customers to prioritize.
STEP 2: Study the REAL DATA PROFILE below to understand the actual distribution of customer attributes.
STEP 3: Design a dynamic number of distinct segments based on the actual data profile.
   - Prefer 4-8 segments when the dataset has enough signal.
   - Only fall back to 3 segments if the data is genuinely too sparse to justify more.
   - Never force exactly 4 segments. The count must follow the data.

{data_profile}

SAMPLE RECORDS (3 real customers):
{json.dumps(sample_records, indent=2, default=str)}

Available CRM fields for logic rules: {fields}

CRITICAL RULES:
1. SAFE SEGMENTATION FALLBACK: Look at the Data Profile. Do `age`, `income`, or `occupation` actually have data?
   - IF YES: Build targeted Demographic segments (e.g. "Senior Citizens", "Young Professionals").
   - IF NO: You MUST fallback to Behavioral or Email Domain segmentation. Group by `emails_opened`, `w1`, `w2`, `w3`, or check if their `email` contains specific domains if possible. DO NOT invent demographic fields if they are empty or missing in the profile.
2. Use ONLY field names that exist in the CRM data above.
3. Use value thresholds that are WITHIN the min/max ranges shown in the data profile.
4. Do NOT use abstract concepts as field names. Map your targeting intent to real CRM columns.
5. Ensure segments cover the ENTIRE audience (last segment must be a catch-all with empty logic).

Output a raw JSON array (no markdown). Each object:
{{
  "segment_id": "short_name",
  "segment_name": "Display Name with Emoji",
  "criteria": "Human readable criteria",
  "tone": "Target tone for the copywriter",
  "focus": "Main value proposition to focus on",
  "emoji_level": "none" | "moderate" | "heavy",
  "tier": "Diamond" | "Gold" | "Silver" | "Reactivate",
  "logic": [
     {{"AND": [{{"field": "age", "op": ">", "value": 50}}, {{"field": "income", "op": ">", "value": 200000}}]}}
  ]
}}

"tier" must be one of: Diamond (highest value), Gold (medium-high), Silver (medium), Reactivate (lowest).
"logic" is a list of condition blocks. Customer matches if ANY block evaluates to True (OR of AND/OR blocks).
Allowed ops: "==", "!=", ">", "<", ">=", "<=", "contains".
Last segment MUST have empty "logic": [] as a catch-all.
"""

    resp = await llm.ainvoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=f"Campaign Brief: {brief}\n\nAnalyze the data profile, identify key factors, and design the segments (JSON Array).")
    ])

    content = str(resp.content).strip()

    try:
        start = content.find("[")
        end = content.rfind("]")
        if start != -1 and end > start:
            segments = json.loads(content[start:end + 1])
            return segments
    except Exception as e:
        _safe_print(f"[Segment Engine] Warning: error parsing LLM segments: {e}")

    return []


# ══════════════════════════════════════════════════════════════
#  MAIN SEGMENTATION FUNCTION
# ══════════════════════════════════════════════════════════════

async def segment_customers(crm_data: list[CustomerRecord], brief: str = "") -> list[CustomerSegment]:
    """Assign each customer to a dynamic, data-aware segment."""
    assigned: set[str] = set()
    segments: list[CustomerSegment] = []

    _safe_print("\n[Segment Engine] Profiling customer data and asking LLM to generate targeting logic...")
    dynamic_defs = await generate_dynamic_segments(brief, crm_data)

    if not dynamic_defs:
        _safe_print("[Segment Engine] Warning: dynamic generation failed, falling back to all-inclusive segment.")
        dynamic_defs = [{
            "segment_id": "all",
            "segment_name": "Target Audience",
            "criteria": "All customers",
            "tone": "persuasive",
            "focus": "Campaign offer",
            "emoji_level": "moderate",
            "tier": "Reactivate",
            "logic": []
        }]

    # Print the factors the LLM identified
    for seg_def in dynamic_defs:
        tier = seg_def.get("tier", "Reactivate")
        _safe_print(
            f"    [Segment] {seg_def.get('segment_name', '?')} -> Tier: {tier} | "
            f"Logic: {len(seg_def.get('logic', []))} rules"
        )

    for seg_def in dynamic_defs:
        customer_ids = []
        logic_blocks = seg_def.get("logic", [])

        for c in crm_data:
            cid = c.get("id", "")
            if not cid and c.get("customer_id"):
                cid = c.get("customer_id")
            if not cid or cid in assigned:
                continue

            # Evaluate logic
            matched = False
            if not logic_blocks:  # Empty list = catch-all
                matched = True
            else:
                for block in logic_blocks:
                    if _evaluate_condition(block, c):
                        matched = True
                        break

            if matched:
                customer_ids.append(cid)
                assigned.add(cid)

        segment: CustomerSegment = {
            "segment_id": seg_def.get("segment_id", "seg"),
            "segment_name": seg_def.get("segment_name", "Segment"),
            "customer_ids": customer_ids,
            "size": len(customer_ids),
            "criteria": seg_def.get("criteria", ""),
            "tone": seg_def.get("tone", ""),
            "focus": seg_def.get("focus", ""),
            "emoji_level": seg_def.get("emoji_level", "moderate"),
        }
        # Stash tier for content_agent to use
        segment["tier"] = seg_def.get("tier", "Reactivate")  # type: ignore
        segments.append(segment)

    total = sum(s["size"] for s in segments)
    _safe_print(f"\n[Segment Engine] Dynamically segmented {total} customers into {len(segments)} groups:")
    for s in segments:
        pct = round(s["size"] / total * 100, 1) if total > 0 else 0
        _safe_print(f"  {s['segment_name']}: {s['size']} customers ({pct}%) -> Tier: {s.get('tier', '?')}")

    return segments


def get_segment_profile(segment: CustomerSegment) -> str:
    """Build a compact text profile of a segment for prompting the LLM."""
    return (
        f"Segment: {segment['segment_name']}\n"
        f"Size: {segment['size']} customers\n"
        f"Target Criteria: {segment['criteria']}\n"
        f"Recommended Tone: {segment['tone']}\n"
        f"Value Prop Focus: {segment['focus']}\n"
        f"Emoji Density: {segment['emoji_level']}"
    )
