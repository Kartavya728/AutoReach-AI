"""
Multi-Agent War Room - Copywriter, Behavioral Psychologist, Financial Advisor.
Collaborates to generate highly persuasive campaign templates.
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from .config import GEMINI_API_KEY, GEMINI_MODEL
import json
import sys
import asyncio
import random

class WarRoom:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL or "gemini-2.5-flash",
            temperature=0.8
        )

    async def _invoke_with_retry(self, prompt: str) -> str:
        for i in range(5):
            try:
                res = await self.llm.ainvoke([HumanMessage(content=prompt)])
                full_text = str(res.content)
                sys.stdout.write(full_text)
                sys.stdout.flush()
                return full_text
            except Exception as e:
                # 429 is the Rate Limit Error for Gemini
                if "429" in str(e) and i < 4:
                    wait = (2 ** i) + random.random()
                    print(f"\n      [Backoff] Rate limit (429) hit. Retrying in {wait:.1f}s...")
                    await asyncio.sleep(wait)
                    continue
                raise e
        return ""

    async def generate_variants(self, brief: str, tier: str, angle: str) -> dict:
        """
        Coordinates Copywriter -> Psychologist -> Controller to produce an email template.
        Supports 1:1 personalization fields via {{name}}, {{city}}, {{occupation}}, {{income}}.
        """
        
        prompt_cw = f"""You are the Lead Copywriter.
Create an email for this Campaign Brief: {brief}
Target Audience Tier: {tier}
Psychological Angle to Exploit: {angle}

        RULES:
        - The brief may include segment-specific re-targeting instructions. Follow them exactly.
        - Prioritize click intent and clarity, not curiosity-only opens.
        - Use {{name}}, {{city}}, and {{occupation}} placeholders for 1:1 dynamic insertion.
        - Return ONLY JSON format.
        - Keys required: "subject", "body"
        - Keep the subject under 200 characters and the body under 5000 characters.
        - Use clear BFSI-safe English copy. Emojis are optional, not mandatory.
        - If you include a URL, the ONLY allowed URL is https://superbfsi.com/xdeposit/explore/
        - Use only one CTA and keep it easy to notice.
        - Do not invent unsupported offers or operational claims.

        Write the absolute best copy!
"""
        # print(f"\n      [War Room] Copywriter processing ({tier})...")
        draft_copy = await self._invoke_with_retry(prompt_cw)
        sys.stdout.write("\n")

        # Agent 2: Behavioral Psychologist
        prompt_psy = f"""You are a Behavioral Psychologist analyzing a marketing draft.
Target Tier: {tier} (determines financial capacity and trust).
Angle: {angle}

Draft received from Copywriter:
{draft_copy}

Optimize it based on Cognitive Biases. Introduce loss aversion or social proof naturally.
Ensure {{name}}, {{city}}, {{occupation}} remain.
Keep the copy concise, credible, and suitable for a BFSI campaign.
Prioritize message clarity and clicking intent over extra curiosity.
If you include a URL, the ONLY allowed URL is https://superbfsi.com/xdeposit/explore/
Return ONLY JSON with "subject" and "body".
"""
        optimized_copy = await self._invoke_with_retry(prompt_psy)
        sys.stdout.write("\n")

        # Parse final
        try:
            start = optimized_copy.find("{")
            end = optimized_copy.rfind("}")
            return json.loads(optimized_copy[start:end+1])
        except:
            return {
                "subject": f"XDeposit update for {{{{name}}}}",
                "body": (
                    f"Hi {{{{name}}}},\n"
                    f"As a {{{{occupation}}}} in {{{{city}}}}, you may want to explore XDeposit.\n\n"
                    "Learn more: https://superbfsi.com/xdeposit/explore/"
                )
            }

war_room = WarRoom()
