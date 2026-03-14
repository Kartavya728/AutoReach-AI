"""
Engagement Memory System - Stores user behavioral history, intent, and psychographics.
Acts as the memory layer for the RL Bandit and Propensity Models.
"""

import json
import os
from pathlib import Path

MEMORY_FILE = "engagement_memory.json"

class EngagementMemory:
    def __init__(self, filepath=MEMORY_FILE):
        self.filepath = filepath
        self.data = self._load()

    def _load(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save(self):
        with open(self.filepath, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=2)

    def get_user(self, customer_id: str) -> dict:
        if customer_id not in self.data:
            self.data[customer_id] = {
                "historical_metrics": {
                    "total_received": 0,
                    "opens": 0,
                    "clicks": 0
                },
                "psychographic_tags": {
                    "urgency": 0.5,
                    "curiosity": 0.5,
                    "authority": 0.5,
                    "social_proof": 0.5
                },
                "intent_declarations": [],
                "optimal_send_hour_utc": 14,
                "funnel_stage": 1 
            }
        return self.data[customer_id]

    def record_interaction(self, customer_id: str, action: str, angle: str = None):
        """
        Record an interaction (send, open, click).
        angle: The psychological angle used (urgency, curiosity, etc.)
        """
        user = self.get_user(customer_id)
        metrics = user["historical_metrics"]

        if action == "send":
            metrics["total_received"] += 1
        elif action == "open":
            metrics["opens"] += 1
            if angle and angle in user["psychographic_tags"]:

                user["psychographic_tags"][angle] = min(1.0, user["psychographic_tags"][angle] + 0.1)
        elif action == "click":
            metrics["clicks"] += 1
            if angle and angle in user["psychographic_tags"]:
                user["psychographic_tags"][angle] = min(1.0, user["psychographic_tags"][angle] + 0.25)

            user["funnel_stage"] = min(4, user["funnel_stage"] + 1)

        self._save()

memory_db = EngagementMemory()
