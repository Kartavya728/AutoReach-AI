"""
Multi-Agent War Room - Copywriter, Behavioral Psychologist, Financial Advisor.
Collaborates to generate highly persuasive campaign templates.
"""

from typing import Callable

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import GEMINI_API_KEY, GEMINI_MODEL
import json

WarRoomEmitter = Callable[[str, str, str], None]

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
        emoji_constraint: str = "some",
        meta_strategy: dict | None = None,
        emit_agent_message: WarRoomEmitter | None = None,
    ) -> dict[str, str]:
        """
        Coordinates Copywriter -> Psychologist -> Controller to produce an email template.
        Supports 1:1 personalization fields via {{name}}, {{city}}, {{occupation}}, {{income}}.

        Args:
            segment_profile: Real demographic summary of the target segment.
            past_metrics: Dict with open_rate, click_rate, previous_subject from prior round.
        """

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

            mutate = False
            if meta_strategy and "mutate_subject" in meta_strategy:
                mutate = meta_strategy["mutate_subject"]
            elif prev_open >= 20.0:
                mutate = True

            if mutate and prev_subject:
                subject_mutation_prompt = (
                    f"CRITICAL SUBJECT DIRECTIVE: The previous subject '{prev_subject}' worked well "
                    f"({prev_open}% open rate). Do NOT write a completely new subject. Instead, perform an "
                    f"EVOLUTIONARY MUTATION on it (e.g. change 1-2 words, alter the hook slightly, but keep the core angle)."
                )
            else:
                s_style = meta_strategy.get("subject_style", "new") if meta_strategy else "completely different"
                subject_mutation_prompt = (
                    f"CRITICAL SUBJECT DIRECTIVE: The previous subject '{prev_subject}' failed or needs a refresh "
                    f"({prev_open}% open rate). Write a {s_style.upper()} subject line approach."
                )

            if ctr < 20.0:
                c_str = meta_strategy.get("cta_strength", "stronger") if meta_strategy else "stronger"
                metrics_block += f"- The Click-Through-Rate (CTR) was very poor ({ctr}%). Make the body vastly more compelling, shorter, and the CTA {c_str.upper()}.\n"

        cta_directive = ""

        if meta_strategy:
            c_pos = meta_strategy.get("cta_position", "bottom")
            c_vis = meta_strategy.get("cta_visual", "none")

            if c_pos == "top_and_bottom":
                cta_directive += (
                    "CRITICAL CTA DIRECTIVE: You MUST insert the raw CTA link EXACTLY TWICE in the body. Do NOT use markdown links, square brackets, or HTML. Just output the raw URL.\n"
                    "1. Provide the first CTA link in the first 3 lines (Reduce scroll friction).\n"
                    "2. Provide the second CTA link near the very end of the email.\n"
                    "3. Both CTAs must be framed with strong ACTION VERBS immediately preceding the raw URL (e.g., 'Start earning today: https://...').\n"
                )
            else:
                cta_directive += "CRITICAL CTA DIRECTIVE: Insert the raw CTA link exactly ONCE at the bottom. Do NOT use markdown links, square brackets, or HTML. Just output the raw URL.\n"

            if c_vis != "none":
                cta_directive += f"VISUAL ANCHOR DIRECTIVE: You MUST place this exact visual anchor immediately before the CTA link: '{c_vis}' (e.g. {c_vis} https://...)\n"

        if emit_agent_message:
            emit_agent_message(
                "War Room - Copywriter",
                f"Drafting a {length_constraint} email for the {tier} tier using the {angle} angle.",
                "action",
            )
        prompt_cw = f"""You are the Lead Copywriter for a high-stakes BFSI email campaign.
Campaign Brief: {brief}
Target Audience Tier: {tier}
Psychological Angle to Exploit: {angle}
{profile_block}{metrics_block}
RULES:
- Length: {length_constraint.upper()} (If 'short', strict maximum 3 sentences. If 'medium', max 6 sentences).
- Structure: Enforce strict format: Hook -> Benefit -> Proof -> CTA.
- Emojis: {emoji_constraint.upper()} (If 'none', use 0. If 'some', use 1-2 max).
- Use { name} , { city} , and { occupation}  placeholders for 1:1 dynamic insertion if it fits the flow naturally. Do not force it.
- {subject_mutation_prompt}
- {cta_directive}
- Return ONLY JSON format with keys: "subject", "body"

Write the absolute best, most click-worthy copy for THIS specific audience!
"""
        resp_cw = await self.llm.ainvoke([HumanMessage(content=prompt_cw)])
        draft_copy = str(resp_cw.content)

        if emit_agent_message:
            emit_agent_message(
                "War Room - Psychologist",
                "Stress-testing the draft for click-through friction, urgency, and trust signals.",
                "observation",
            )
        prompt_psy = f"""You are a Behavioral Psychologist optimizing a marketing email for maximum click-through.
Target Tier: {tier} (determines financial capacity and trust).
Angle: {angle}
{profile_block}{metrics_block}
Draft received from Copywriter:
{draft_copy}

YOUR MISSION: Maximize click rate while strictly obeying constraints.
1. Length: {length_constraint.upper()}
2. Emojis: {emoji_constraint.upper()}
3. Apply psychological triggers: Loss aversion, Social proof, Specificity, Urgency.
4. Retain { name} , { city} , { occupation}  placeholders if present.
5. {cta_directive}

Return ONLY JSON with "subject" and "body".
"""
        resp_psy = await self.llm.ainvoke([HumanMessage(content=prompt_psy)])
        optimized_copy = str(resp_psy.content)

        try:
            start = optimized_copy.find("{")
            end = optimized_copy.rfind("}")
            parsed = json.loads(optimized_copy[start:end+1])
            if emit_agent_message:
                emit_agent_message(
                    "War Room - Controller",
                    "Finalized the draft after copywriting and behavioral review.",
                    "summary",
                )
            return parsed
        except Exception:
            if emit_agent_message:
                emit_agent_message(
                    "War Room - Controller",
                    "Structured parsing failed, so the war room is falling back to a safe draft.",
                    "decision",
                )
            return {
                "subject": f"[{angle.upper()}] Exclusive for { name}  in { city} ",
                "body": f"Hi { name} ,\nWe know as a { occupation}  you value great returns...\n\nClaim your offer today."
            }

war_room = WarRoom()
