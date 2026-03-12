"""
Weight Optimization Agent — Background Engagement Tuner
========================================================
Adjusts customer engagement weights (w1, w2, w3) based on
which topic a campaign targeted and who engaged.

Runs asynchronously (fire-and-forget) after each optimization round.

Corresponds to: `runWeightOptimizationAgent()` in optimize.ts
"""

from __future__ import annotations
import json
import asyncio
import random
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from .config import GEMINI_API_KEY, GEMINI_MODEL
from .supabase_client import get_customers, update_customer_weights


def _get_model() -> ChatGoogleGenerativeAI:
    if not GEMINI_API_KEY:
        raise EnvironmentError("Missing GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.7,
    )


async def run_weight_optimization(
    campaign_id: str,
    analysis_report: dict,
    brief: str,
) -> dict | bool:
    """
    Ask Gemini which weight to increase/decrease for engaged users
    based on the campaign topic, then return the suggested adjustment.
    
    Returns:
        dict with {increaseWeight, decreaseWeight, adjustmentAmount}
        or False if parsing failed.
    """
    model = _get_model()

    prompt_text = "\n".join([
        "You are a BFSI AI that optimizes targeting weights.",
        "W1, W2, W3 are weights indicating customer preference for different topics "
        "(e.g. W1=Loans, W2=Deposits, W3=Cards).",
        f"Campaign Brief: {brief}",
        "Based ONLY on this brief, which weight (W1, W2, or W3) should be increased "
        "for customers who engaged with this campaign?",
        "Which weight should be slightly decreased (to normalize)?",
        "Return JSON ONLY with keys:",
        "- increaseWeight: 'w1', 'w2', or 'w3'",
        "- decreaseWeight: 'w1', 'w2', or 'w3'",
        "- adjustmentAmount: an integer between 1 and 3 "
        "(representing the maximum scale points to shift)",
        "JSON:",
    ])

    async def _invoke_with_retry(messages):
        for i in range(5):
            try:
                return await model.ainvoke(messages, config={"tags": ["Weight-Agent"]})
            except Exception as e:
                if "429" in str(e) and i < 4:
                    wait = (2 ** i) + random.random()
                    print(f"\n      [Backoff] Rate limit (429) hit. Retrying in {wait:.1f}s...")
                    await asyncio.sleep(wait)
                    continue
                raise e
        return None

    result = await _invoke_with_retry([HumanMessage(content=prompt_text)])
    if not result:
        return False

    try:
        text = str(result.content).strip()
        start = text.index("{")
        end = text.rindex("}")
        parsed = json.loads(text[start : end + 1])
    except (ValueError, json.JSONDecodeError) as e:
        print(f"[Weight Agent] Failed to parse response: {e}")
        return False

    increase_weight = parsed.get("increaseWeight")
    decrease_weight = parsed.get("decreaseWeight")
    adjustment_amount = parsed.get("adjustmentAmount")

    if not increase_weight or not decrease_weight or not adjustment_amount:
        return False

    print(
        f"[Weight Agent] Suggested: increase {increase_weight}, "
        f"decrease {decrease_weight} by {adjustment_amount}"
    )

    # In a full implementation, you would apply these weight shifts
    # to all customers who engaged (opened/clicked) in this campaign.
    # For the hackathon, we return the suggestion for logging.
    #
    # Example application:
    #   customers = get_customers()
    #   for c in engaged_customers:
    #       new_w = {
    #           "w1": c["w1"], "w2": c["w2"], "w3": c["w3"],
    #       }
    #       new_w[increase_weight] = min(10, new_w[increase_weight] + adjustment_amount)
    #       new_w[decrease_weight] = max(0, new_w[decrease_weight] - 1)
    #       update_customer_weights(c["customer_id"], **new_w)

    return parsed
