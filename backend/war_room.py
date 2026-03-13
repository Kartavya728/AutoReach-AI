"""
Multi-Agent War Room - Copywriter, Behavioral Psychologist, Financial Advisor.
Collaborates to generate highly persuasive campaign templates.
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import AGENTS_TEST_MODE, GEMINI_API_KEY, GEMINI_MODEL
import json

class WarRoom:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL or "gemini-2.5-flash",
            temperature=0.8
        )

    async def generate_variants(
        self,
        brief: str,
        tier: str,
        angle: str,
        segment_profile: str = "",
        past_metrics: dict | None = None,
        length_constraint: str = "medium",
        emoji_constraint: str = "moderate",
    ) -> dict:
        """
        Coordinates Copywriter -> Psychologist -> Controller to produce an email template.
        Supports 1:1 personalization fields via {{name}}, {{city}}, {{occupation}}, {{income}}.

        Args:
            segment_profile: Real demographic summary of the target segment.
            past_metrics: Dict with open_rate, click_rate, previous_subject from prior round.
        """
        if AGENTS_TEST_MODE:
            subject_map = {
                "curiosity": "What if your next deposit earned more than the market?",
                "urgency": "Lock in higher XDeposit returns before the window shifts",
                "social_proof": "Why more savers are moving to XDeposit this quarter",
                "authority": "A smarter fixed-return move, backed by SuperBFSI",
            }
            body = (
                "Hi {name},\n\n"
                "As a {occupation} in {city}, you are likely evaluating safe ways to grow idle funds. "
                "XDeposit from SuperBFSI currently offers 1 percentage point higher returns than competing term "
                "deposit products. For eligible female senior citizens, the offer goes 0.25 percentage point higher.\n\n"
                "Why this matters:\n"
                "- Higher fixed returns versus comparable products\n"
                "- Backed by SuperBFSI\n"
                "- Simple next step to explore details and start\n\n"
                "Explore now: https://superbfsi.com/xdeposit/explore/\n"
            )
            return {
                "subject": subject_map.get(angle, "Explore the higher-return XDeposit opportunity"),
                "body": body,
            }

        # Build context blocks for the prompts
        profile_block = ""
        if segment_profile:
            profile_block = f"\n\nREAL AUDIENCE DATA (use this to make the email hyper-relevant):\n{segment_profile}\n"

        metrics_block = ""
        subject_mutation_prompt = ""
        
        if past_metrics:
            prev_subject = past_metrics.get("previous_subject", "")
            prev_open = float(past_metrics.get("open_rate", 0))
            prev_click = float(past_metrics.get("click_rate", 0))
            ctr = round((prev_click / prev_open * 100), 1) if prev_open > 0 else 0
            
            metrics_block = (
                f"\n\nPREVIOUS ROUND PERFORMANCE (learn from this):\n"
                f"- Previous subject line: \"{prev_subject}\"\n"
                f"- Open rate achieved: {prev_open}%\n"
                f"- Click rate achieved: {prev_click}% (CTR: {ctr}%)\n"
            )
            
            # Evolutionary Subject Mutation
            if prev_open >= 20.0 and prev_subject:
                subject_mutation_prompt = (
                    f"CRITICAL SUBJECT DIRECTIVE: The previous subject '{prev_subject}' worked well "
                    f"({prev_open}% open rate). Do NOT write a completely new subject. Instead, perform an "
                    f"EVOLUTIONARY MUTATION on it (e.g. change 1-2 words, alter the hook slightly, but keep the core angle)."
                )
            else:
                subject_mutation_prompt = (
                    f"CRITICAL SUBJECT DIRECTIVE: The previous subject '{prev_subject}' failed "
                    f"({prev_open}% open rate). Write a COMPLETELY DIFFERENT subject line approach."
                )
                
            if ctr < 20.0:
                metrics_block += f"- The Click-Through-Rate (CTR) was very poor ({ctr}%). Make the body vastly more compelling, shorter, and the CTA stronger.\n"

        # Agent 1: Copywriter
        prompt_cw = f"""You are the Lead Copywriter for a high-stakes BFSI email campaign.
Campaign Brief: {brief}
Target Audience Tier: {tier}
Psychological Angle to Exploit: {angle}
{profile_block}{metrics_block}
RULES:
- Length: {length_constraint.upper()} (If 'short', strict maximum 3 sentences. If 'medium', max 6 sentences).
- Structure: Enforce strict format: Hook -> Benefit -> Proof -> CTA.
- Emojis: {emoji_constraint.upper()} (If 'none', use 0. If 'some', use 1-2 max).
- Use {{name}}, {{city}}, and {{occupation}} placeholders for 1:1 dynamic insertion if it fits the flow naturally. Do not force it.
- The email body MUST include the exact CTA link provided in the brief.
- {subject_mutation_prompt}
- Return ONLY JSON format with keys: "subject", "body"

Write the absolute best, most click-worthy copy for THIS specific audience!
"""
        resp_cw = await self.llm.ainvoke([HumanMessage(content=prompt_cw)])
        draft_copy = str(resp_cw.content)

        # Agent 2: Behavioral Psychologist
        prompt_psy = f"""You are a Behavioral Psychologist optimizing a marketing email for maximum click-through.
Target Tier: {tier} (determines financial capacity and trust).
Angle: {angle}
{profile_block}{metrics_block}
Draft received from Copywriter:
{draft_copy}

YOUR MISSION: Maximize click rate while strictly obeying constraints.
1. Length: {length_constraint.upper()}
2. Emojis: {emoji_constraint.upper()}
3. Structure: Hook -> Benefit -> Proof -> CTA.
4. Apply psychological triggers: Loss aversion, Social proof, Specificity, Urgency.
5. Retain {{name}}, {{city}}, {{occupation}} placeholders if present.

Ensure the exact CTA link from the brief remains in the body exactly once.
Return ONLY JSON with "subject" and "body".
"""
        resp_psy = await self.llm.ainvoke([HumanMessage(content=prompt_psy)])
        optimized_copy = str(resp_psy.content)

        # Parse final
        try:
            start = optimized_copy.find("{")
            end = optimized_copy.rfind("}")
            return json.loads(optimized_copy[start:end+1])
        except:
            return {
                "subject": f"[{angle.upper()}] Exclusive for {{name}} in {{city}}",
                "body": f"Hi {{name}},\nWe know as a {{occupation}} you value great returns...\n\nClaim your offer today."
            }

war_room = WarRoom()
