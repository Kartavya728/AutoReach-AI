"""
Contextual Bandit Engine
Implements Thompson Sampling for dynamic action (email angle) selection.
Learns which psychological angles perform best for which user tiers.
"""

import json
import math
import os
import random
from backend.memory import memory_db

BANDIT_STATE_FILE = "bandit_state.json"

class ThompsonBandit:
    def __init__(self):
        self.state_file = BANDIT_STATE_FILE

        self.actions = ["curiosity", "urgency", "social_proof", "authority"]
        self.contexts = ["Diamond", "Gold", "Silver", "Reactivate"]

        self.state = self._load_state()

    def _load_state(self):
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass

        state = {}
        for c in self.contexts:
            state[c] = {}
            for a in self.actions:
                state[c][a] = {"alpha": 1, "beta": 1}
        return state

    def _save_state(self):
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.state, f, indent=2)

    def select_action(self, context_tier: str, current_round: int = 1) -> str:
        """
        Thompson Sampling with Epsilon-Greedy exploration.
        Epsilon starts at 0.3 and decays, but never goes below 0.1.
        """
        if context_tier not in self.state:
            context_tier = "Reactivate" 

        epsilon = max(0.1, 0.3 * math.exp(-current_round + 1))

        if random.random() < epsilon:
            return str(random.choice(self.actions))

        max_sample = -1
        best_action = self.actions[0]

        for action in self.actions:
            alpha = self.state[context_tier][action]["alpha"]
            beta = self.state[context_tier][action]["beta"]

            theta = random.betavariate(alpha, beta)
            if theta > max_sample:
                max_sample = theta
                best_action = action

        return best_action

    def update_reward(self, context_tier: str, action: str, opens: int, clicks: int, sends: int):
        """
        Updates bandit state based on the hackathon score metric:
        score = 0.7 * click_rate + 0.3 * open_rate
        """
        if context_tier in self.state and action in self.state[context_tier] and sends > 0:
            open_rate = opens / sends
            click_rate = clicks / sends

            reward = 0.7 * click_rate + 0.3 * open_rate

            self.state[context_tier][action]["alpha"] += reward
            self.state[context_tier][action]["beta"] += (1.0 - reward)

            self._save_state()

    def get_posterior_mean(self, context_tier: str, action: str):
        alpha = self.state[context_tier][action]["alpha"]
        beta = self.state[context_tier][action]["beta"]
        return alpha / (alpha + beta)

bandit_engine = ThompsonBandit()
