"""
Personalization Engine
Transforms base agent variants into 1:1 unique emails per user based on precise CRM data.
"""

from agents.state import CustomerRecord

class PersonalizationEngine:
    def personalize_email(self, template: dict, user: CustomerRecord, angle: str) -> dict:
        """
        Takes a base template Dict with {{name}}, {{city}}, {{occupation}}
        and injects the user's specific context.
        """
        name = user.get("name") or "there"
        if not name or name == "None":
            name = "there"
            
        city = user.get("city") or "your area"
        if not city or city == "None":
            city = "your area"
            
        occupation = user.get("occupation") or "professional"
        if not occupation or occupation == "None":
            occupation = "professional"
            
        income = str(user.get("income", ""))
        
        subject = template.get("subject", "")
        body = template.get("body", "")
        
        subject = subject.replace("{{name}}", name).replace("{{city}}", city).replace("{{occupation}}", occupation)
        body = body.replace("{{name}}", name).replace("{{city}}", city).replace("{{occupation}}", occupation)
        
        # Inject dynamic urgency/social proof snippet
        if angle == "social_proof":
            snippet = f"\n\n(P.S. 32 other {occupation}s in {city} also opened this deposit this week.)"
            body += snippet
            
        return {
            "subject": subject,
            "body": body
        }

personalization_engine = PersonalizationEngine()
