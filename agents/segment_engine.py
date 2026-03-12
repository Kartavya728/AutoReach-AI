"""
Segment Engine — Customer Micro-Segmentation (Data-Aware Dynamic LLM)
======================================================================
Uses Gemini to dynamically generate targeting segments based on the
campaign brief AND actual customer data statistics (ranges, distributions).
"""

from __future__ import annotations
import json
import operator
from collections import Counter
import numpy as np
import asyncio
import random
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from .state import CustomerRecord, CustomerSegment
from .config import GEMINI_API_KEY, GEMINI_MODEL


def _get_model() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.2,
    )


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _binary_flag(value) -> float:
    normalized = _normalize_text(value)
    return 1.0 if normalized in {"y", "yes", "true", "1", "installed", "active", "verified"} else 0.0


def _top_categories(crm_data: list[CustomerRecord], field: str, limit: int) -> list[str]:
    counter: Counter = Counter()
    for customer in crm_data:
        normalized = _normalize_text(customer.get(field))
        if normalized:
            counter[normalized] += 1
    return [value for value, _ in counter.most_common(limit)]


def _encode_top_category(value, vocabulary: list[str]) -> list[float]:
    normalized = _normalize_text(value)
    return [1.0 if normalized == entry else 0.0 for entry in vocabulary]


def _build_feature_matrix(
    crm_data: list[CustomerRecord],
) -> tuple[np.ndarray, list[CustomerRecord], dict[str, list[str]]]:
    category_vocab = {
        "occupation": _top_categories(crm_data, "occupation", 8),
        "occupation_type": _top_categories(crm_data, "occupation_type", 4),
        "city": _top_categories(crm_data, "city", 6),
        "marital_status": _top_categories(crm_data, "marital_status", 4),
        "gender": _top_categories(crm_data, "gender", 3),
    }

    features: list[list[float]] = []
    valid_crm: list[CustomerRecord] = []

    for customer in crm_data:
        customer_id = customer.get("id") or customer.get("customer_id")
        if not customer_id:
            continue

        age = _safe_float(customer.get("age"), 35.0)
        income = _safe_float(customer.get("income"), 50000.0)
        credit_score = _safe_float(customer.get("credit_score"), 650.0)
        family_size = _safe_float(customer.get("family_size"), 2.0)
        dependent_count = _safe_float(customer.get("dependent_count"), family_size)
        kids = _safe_float(customer.get("kids"), 0.0)
        w1 = _safe_float(customer.get("w1"), 0.5)
        w2 = _safe_float(customer.get("w2"), 0.5)
        w3 = _safe_float(customer.get("w3"), 0.5)
        propensity_score = _safe_float(customer.get("propensity_score"), 0.5)
        engagement_score = _safe_float(customer.get("engagement_score"), 0.0)
        app_installed = _binary_flag(customer.get("app_installed"))
        existing_customer = _binary_flag(customer.get("existing_customer"))
        social_media_active = _binary_flag(customer.get("social_media_active"))
        kyc_verified = _binary_flag(customer.get("kyc_status"))
        has_children = 1.0 if (kids > 0 or dependent_count > 0) else 0.0

        row = [
            age,
            income,
            credit_score,
            family_size,
            dependent_count,
            kids,
            w1,
            w2,
            w3,
            propensity_score,
            engagement_score,
            app_installed,
            existing_customer,
            social_media_active,
            kyc_verified,
            has_children,
        ]

        for field, vocabulary in category_vocab.items():
            row.extend(_encode_top_category(customer.get(field), vocabulary))

        features.append(row)
        valid_crm.append(customer)

    return np.array(features, dtype=float), valid_crm, category_vocab


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
    numeric_fields = [
        "age",
        "income",
        "credit_score",
        "family_size",
        "dependent_count",
        "kids",
        "propensity_score",
        "engagement_score",
        "w1",
        "w2",
        "w3",
    ]
    categorical_fields = [
        "gender",
        "occupation",
        "occupation_type",
        "city",
        "marital_status",
        "kyc_status",
        "app_installed",
        "existing_customer",
        "social_media_active",
    ]

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

async def segment_customers(crm_data: list[CustomerRecord], brief: str = "") -> list[CustomerSegment]:
    """Assign each customer to a dynamic, data-aware ML segment using K-Means."""
    if not crm_data:
        return []

    print("\n[Segment Engine] Running ML K-Means clustering on enriched cohort features...")

    # 1. Feature Extraction & Scaling
    X, valid_crm, category_vocab = _build_feature_matrix(crm_data)
    if not valid_crm:
        return []

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 2. KMeans Clustering (richer cohorts benefit from one extra segment when scale allows)
    target_clusters = 5 if len(valid_crm) >= 700 else 4 if len(valid_crm) >= 200 else 3
    n_clusters = min(max(2, target_clusters), len(valid_crm))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=20)
    clusters = kmeans.fit_predict(X_scaled)

    # Group customers by cluster
    clustered_groups = {i: [] for i in range(n_clusters)}
    for idx, cluster_id in enumerate(clusters):
        clustered_groups[cluster_id].append(valid_crm[idx])

    print(
        f"[Segment Engine] K-Means formed {n_clusters} clusters using {X.shape[1]} features "
        f"and category vocabularies {category_vocab}. Asking LLM to interpret and name them..."
    )
    
    # 3. Ask LLM to define the segments based on the grouped data
    segments: list[CustomerSegment] = []
    llm = _get_model()
    
    for cluster_id, group in clustered_groups.items():
        if not group: continue
        
        # Profile this specific cluster
        profile = _build_field_profile(group)
        
        sys_prompt = f"""You are a Growth AI interpreting a data cluster to name a segment.
We ran K-Means clustering. This group has {len(group)} users.
Here is the profile of THIS specific group:
{profile}

Identify who these people are and create a marketing profile for them.
Output ONLY a JSON object:
{{
  "segment_id": "cluster_{cluster_id}",
  "segment_name": "Display Name with Emoji",
  "criteria": "Explain precisely who these people are based on the data",
  "tone": "Target tone for copy",
  "focus": "Main value prop focus",
  "emoji_level": "none" | "moderate" | "heavy",
  "tier": "Diamond" | "Gold" | "Silver" | "Reactivate"
}}
"""
        async def _invoke_with_retry(prompt):
            for i in range(5):
                try:
                    return await llm.ainvoke([HumanMessage(content=prompt)])
                except Exception as e:
                    if "429" in str(e) and i < 4:
                        wait = (2 ** i) + random.random()
                        print(f"\n      [Backoff] Rate limit (429) hit. Retrying in {wait:.1f}s...")
                        await asyncio.sleep(wait)
                        continue
                    raise e
            return None

        resp = await _invoke_with_retry(sys_prompt)
        if not resp: continue
        content = str(resp.content).strip()
        try:
            start = content.find("{")
            end = content.rfind("}")
            seg_def = json.loads(content[start:end + 1])
            
            segment: CustomerSegment = {
                "segment_id": seg_def.get("segment_id", f"cluster_{cluster_id}"),
                "segment_name": seg_def.get("segment_name", f"Cluster {cluster_id}"),
                "customer_ids": [c.get("id") or c.get("customer_id") for c in group],
                "size": len(group),
                "criteria": seg_def.get("criteria", ""),
                "tone": seg_def.get("tone", ""),
                "focus": seg_def.get("focus", ""),
                "emoji_level": seg_def.get("emoji_level", "moderate"),
            }
            segment["tier"] = seg_def.get("tier", "Silver") # type: ignore
            segments.append(segment)
        except Exception as e:
            print(f"⚠️ Error parsing LLM segment for cluster {cluster_id}: {e}")
            
    # Add any un-clustered (due to missing ID etc) to a fallback
    assigned_ids = {cid for s in segments for cid in s["customer_ids"]}
    unassigned = [c for c in crm_data if (c.get("id") or c.get("customer_id")) not in assigned_ids]
    if unassigned:
        segments.append({
            "segment_id": "unassigned",
            "segment_name": "👥 General Audience",
            "customer_ids": [c.get("id") or c.get("customer_id") for c in unassigned],
            "size": len(unassigned),
            "criteria": "Catch-all for remaining customers",
            "tone": "persuasive",
            "focus": "General Product Benefits",
            "emoji_level": "moderate",
            "tier": "Reactivate", # type: ignore
        })




    total = sum(s["size"] for s in segments)
    print(f"\n[Segment Engine] Dynamically segmented {total} customers into {len(segments)} groups:")
    for s in segments:
        pct = round(s["size"] / total * 100, 1) if total > 0 else 0
        print(f"  {s['segment_name']}: {s['size']} customers ({pct}%) → Tier: {s.get('tier', '?')}")

    return segments


def get_segment_profile(segment: CustomerSegment) -> str:
    """Build a compact text profile of a segment for prompting the LLM."""
    lines = [
        f"Segment: {segment['segment_name']}",
        f"Size: {segment['size']} customers",
        f"Target Criteria: {segment['criteria']}",
        f"Recommended Tone: {segment['tone']}",
        f"Value Prop Focus: {segment['focus']}",
        f"Emoji Density: {segment['emoji_level']}",
    ]
    if segment.get("tier"):
        lines.append(f"Tier: {segment['tier']}")
    if segment.get("retarget_stage"):
        lines.append(f"Re-target Stage: {segment['retarget_stage']}")
    if segment.get("priority_score") is not None:
        lines.append(f"Priority Score: {segment['priority_score']}")
    if segment.get("send_window"):
        lines.append(f"Preferred Send Window: {segment['send_window']}")
    return "\n".join(lines)
