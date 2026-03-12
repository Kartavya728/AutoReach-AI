"""
Digital Twin Simulator
Provides a generative AI persona representing the user, and tests campaigns on them
to gauge predicted engagement before real-world sending.
"""

import asyncio
import random
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from .config import GEMINI_API_KEY, GEMINI_MODEL
import json

def _get_model() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        api_key=GEMINI_API_KEY,
        model=GEMINI_MODEL or "gemini-2.5-flash",
        temperature=0.3,
    )

class TwinSimulator:
    def __init__(self):
        self.llm = _get_model()
        
    async def simulate_reaction(self, user: dict, subject: str, body: str) -> dict:
        """
        Returns <CLICK>, <OPEN_ONLY>, or <IGNORE> along with reasoning.
        """
        name = user.get("name") or "User"
        age = user.get("age") or 35
        occupation = user.get("occupation") or "Professional"
        city = user.get("city") or "Mumbai"
        family_size = user.get("family_size") or 2
        credit_score = user.get("credit_score") or 700
        
        system_prompt = f"""You are {name}, a {age}-year-old {occupation} in {city}. You have a family size of {family_size} and a credit score of {credit_score}.
You are skeptical of marketing emails. You check your email on mobile during your commute.
Your task is to realistically simulate your reaction to an email.

Provide your internal monologue thinking process (briefly), and then output exactly one of these tokens:
<CLICK> (If the email is incredibly persuasive, personalized, and urgent/valuable enough to click the link)
<OPEN_ONLY> (If the subject is good enough to open, but the body is boring or generic)
<IGNORE> (If the subject is spammy, irrelevant, or boring)

Output format:
MONOLOGUE: [your thoughts]
DECISION: <TOKEN>
"""
        user_prompt = f"You received this email:\n\nSubject: {subject}\n\nBody:\n{body}\n\nWhat is your reaction?"

        async def _invoke_with_retry(messages):
            for i in range(5):
                try:
                    return await self.llm.ainvoke(messages)
                except Exception as e:
                    if "429" in str(e) and i < 4:
                        wait = (2 ** i) + random.random()
                        print(f"\n      [Backoff] Rate limit (429) hit. Retrying in {wait:.1f}s...")
                        await asyncio.sleep(wait)
                        continue
                    raise e
            return None

        response = await _invoke_with_retry([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ])
        if not response:
            return {"decision": "IGNORE", "monologue": "API Rate limit hit."}
        
        reply = str(response.content).strip()
        decision = "IGNORE"
        if "<CLICK>" in reply:
            decision = "CLICK"
        elif "<OPEN_ONLY>" in reply:
            decision = "OPEN"
            
        return {"decision": decision, "monologue": reply}

    def bayesian_kill_rule(self, simulated_results: list[dict]) -> bool:
        """
        If we simulate 10 twins and less than 2 clicked/opened, kill the variant.
        """
        clicks = sum(1 for r in simulated_results if r["decision"] == "CLICK")
        if len(simulated_results) > 0 and clicks / len(simulated_results) < 0.2:
            return True # Kill it
        return False

twin_engine = TwinSimulator()
