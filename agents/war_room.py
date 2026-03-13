"""
Multi-Agent War Room - Copywriter, Behavioral Psychologist, Financial Advisor.
Collaborates to generate highly persuasive campaign templates.
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from agents.config import GEMINI_API_KEY, GEMINI_MODEL
import json

class WarRoom:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL or "gemini-2.5-flash",
            temperature=0.8
        )

    async def generate_variants(self, brief: str, tier: str, angle: str) -> dict:
        """
        Coordinates Copywriter -> Psychologist -> Controller to produce an email template.
        Supports 1:1 personalization fields via {{name}}, {{city}}, {{occupation}}, {{income}}.
        """
        
        # Agent 1: Copywriter
        prompt_cw = f"""You are the Lead Copywriter.
Create an email for this Campaign Brief: {brief}
Target Audience Tier: {tier}
Psychological Angle to Exploit: {angle}

RULES:
- Use {{name}}, {{city}}, and {{occupation}} placeholders for 1:1 dynamic insertion.
- Return ONLY JSON format.
- Keys required: "subject", "body"

Write the absolute best copy!
"""
        resp_cw = await self.llm.ainvoke([HumanMessage(content=prompt_cw)])
        draft_copy = str(resp_cw.content)

        # Agent 2: Behavioral Psychologist
        prompt_psy = f"""You are a Behavioral Psychologist analyzing a marketing draft.
Target Tier: {tier} (determines financial capacity and trust).
Angle: {angle}

Draft received from Copywriter:
{draft_copy}

Optimize it based on Cognitive Biases. Introduce loss aversion or social proof naturally.
Ensure {{name}}, {{city}}, {{occupation}} remain.
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
