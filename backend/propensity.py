"""
Propensity Scoring Model
Predicts the likelihood of open/click and computes the engagement score based on user demographics and memory.
"""

from backend.memory import memory_db

def normalize(val, min_val, max_val):
    if max_val <= min_val: return 0
    return max(0, min(1, (val - min_val) / (max_val - min_val)))

class PropensityModel:
    def __init__(self):

        self.PRIOR_ALPHA = 2.0
        self.PRIOR_BETA = 18.0 

    def compute_engagement_score(self, user: dict) -> float:
        """
        Compute continuous engagement score [0, 1] using demographics + historical data.
        """
        income = float(user.get("income") or 30000)
        family_size = int(user.get("family_size") or 1)
        capacity_score = normalize(income / max(1, family_size), 10000, 200000) * 0.4

        digital_score = 0.0
        if str(user.get("app_installed", "")).upper() == "Y": digital_score += 0.15
        if str(user.get("social_media_active", "")).upper() == "Y": digital_score += 0.15

        credit = int(user.get("credit_score") or 500)
        credit_score = normalize(credit, 300, 850) * 0.3

        prior = capacity_score + digital_score + credit_score

        customer_id = user.get("id", "")
        if not customer_id:
            customer_id = user.get("customer_id", "")

        mem = memory_db.get_user(customer_id)
        total_clicks = mem["historical_metrics"]["clicks"]
        total_sends = mem["historical_metrics"]["total_received"]

        alpha_posterior = self.PRIOR_ALPHA + total_clicks
        beta_posterior = self.PRIOR_BETA + max(0, total_sends - total_clicks)

        p_click = alpha_posterior / (alpha_posterior + beta_posterior)

        engagement_score = (0.7 * p_click) + (0.3 * prior)
        return engagement_score

    def get_user_tier(self, engagement_score: float) -> str:
        """4-tier segmentation based on propensity to engage."""
        if engagement_score >= 0.6:
            return "Diamond"
        elif engagement_score >= 0.4:
            return "Gold"
        elif engagement_score >= 0.2:
            return "Silver"
        else:
            return "Reactivate"

propensity_model = PropensityModel()
