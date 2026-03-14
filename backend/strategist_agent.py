import json
import logging
from typing import Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

class StrategistAgent:
    """
    The Meta-Agent (Campaign Strategist).
    Analyzes past round metrics and dynamic campaign memory to output
    a strict JSON strategy directive for the next round.
    """
    def __init__(self):
        if not GEMINI_API_KEY:
            raise EnvironmentError("Missing GEMINI_API_KEY for StrategistAgent")
        self.llm = ChatGoogleGenerativeAI(
            api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL or "gemini-2.5-flash",
            temperature=0.4, 
        )

    async def analyze_results(self, segment_metrics: Dict[str, Any], campaign_memory: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Input:
        segment_metrics = {
            "segment_name": "Hot Leads",
            "previous_subject": "...",
            "previous_body": "...",
            "open_rate": 14.5,
            "click_rate": 2.1,
            "ctr": 14.48, # (click / open) * 100
            "send_time": "14:00",
            "length_constraint": "medium",
            "emoji_constraint": "some"
        }

        Output:
        {
            "diagnosis": "str",
            "subject_style": "curiosity | urgency | benefit | personalization | ...",
            "body_length": "short | medium",
            "emoji_usage": "none | moderate | some",
            "send_time": "HH:00",
            "cta_strength": "direct | soft | urgency",
            "cta_position": "bottom | top_and_bottom",
            "cta_visual": "none | 👉 | ➡",
            "mutate_subject": True/False # Indicates if we should evolve the previous subject or rewrite
        }
        """
        system_prompt = """You are an elite BFSI Marketing Strategist (The Meta-Agent).
Your goal is to maximize the hackathon evaluation score:
Score = 0.7 * click_rate + 0.3 * open_rate

Analyze the results of the PREVIOUS campaign round for this specific audience segment.
Identify the bottleneck (e.g. "Good open rate but terrible click rate means the subject was strong but the body failed to convert.")

Rules:
1. If Open Rate is high (>20%), set "mutate_subject": true, meaning the Copywriter will slightly evolve the winning subject line instead of rewriting it. If low, set false (requires a totally new approach).
2. If Click-Through Rate (ctr) is low (<15%), the body failed. Recommend a SHORTER length and a MORE DIRECT cta_strength.
3. Choose a `send_time` in UTC (e.g., "08:00", "13:00", "18:00") that fits the psychological profile.
4. If CTR is very poor, set `cta_position` to "top_and_bottom" to reduce friction, and use a `cta_visual` arrow (e.g., "👉") to anchor the eye.
5. Output MUST BE strictly JSON format with no markdown wrappers or extra text.

Return exactly this JSON structure:
{
    "diagnosis": "A 1-sentence analysis of what went wrong or went right",
    "subject_style": "<tone choice: e.g. urgency, curiosity, credibility>",
    "body_length": "<short or medium>",
    "emoji_usage": "<none, moderate, or some>",
    "send_time": "<HH:00>",
    "cta_strength": "<direct, soft, or urgency>",
    "cta_position": "<bottom or top_and_bottom>",
    "cta_visual": "<none, 👉, or ➡>",
    "mutate_subject": <boolean>
}"""

        prompt = f"""
Segment: {segment_metrics.get('segment_name', 'Unknown')}
Open Rate: {segment_metrics.get('open_rate', 0)}%
Click Rate: {segment_metrics.get('click_rate', 0)}%
CTR (Clicks per Open): {segment_metrics.get('ctr', 0)}%
Previous Subject: {segment_metrics.get('previous_subject', 'None')}
Previous Body Length Used: {segment_metrics.get('length_constraint', 'Unknown')}
Previous Emoji Usage: {segment_metrics.get('emoji_constraint', 'Unknown')}
Previous Send Time: {segment_metrics.get('send_time', 'Unknown')}

Read the data. Diagnose the bottleneck. Generate the JSON strategy for the next round.
"""

        try:
            response = await self.llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt)
            ])
            text = str(response.content)

            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                return json.loads(text[start:end+1])
            else:
                raise ValueError("No JSON block found in the output.")

        except Exception as e:
            logger.error(f"Strategist Agent failed: {e}")

            return {
                "diagnosis": "Fallback triggered due to analysis error.",
                "subject_style": "benefit",
                "body_length": "short",
                "emoji_usage": "none",
                "send_time": "10:00", 
                "cta_strength": "direct",
                "cta_position": "bottom",
                "cta_visual": "none",
                "mutate_subject": False
            }

strategist_agent = StrategistAgent()
