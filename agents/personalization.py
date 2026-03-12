"""
Personalization Engine
Transforms base agent variants into 1:1 unique emails per user based on precise CRM data.
"""

from __future__ import annotations

import re

from agents.state import CustomerRecord


ALLOWED_CTA_URL = "https://superbfsi.com/xdeposit/explore/"
MAX_SUBJECT_LENGTH = 200
MAX_BODY_LENGTH = 5000
URL_RE = re.compile(r"https?://[^\s)>\]]+")
PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}", re.IGNORECASE)


class PersonalizationEngine:
    def personalize_email(self, template: dict, user: CustomerRecord, angle: str) -> dict:
        """
        Takes a base template Dict with {{name}}, {{city}}, {{occupation}}
        and injects the user's specific context.
        """
        name = user.get("name") or user.get("full_name") or "there"
        if not name or name == "None":
            name = "there"
            
        city = user.get("city") or "your area"
        if not city or city == "None":
            city = "your area"
            
        occupation = user.get("occupation") or "professional"
        if not occupation or occupation == "None":
            occupation = "professional"
            
        income = str(user.get("income") or user.get("monthly_income") or "") or ""
        
        subject = template.get("subject", "")
        body = template.get("body", "")
        
        replacements = {
            "name": name,
            "city": city,
            "occupation": occupation,
            "income": income,
        }
        subject = self._replace_placeholders(subject, replacements)
        body = self._replace_placeholders(body, replacements)
        
        # Deep demographic copy variants
        if user.get("age") and user["age"] >= 60:
            if str(user.get("gender", "")).lower() == "female":
                snippet = f"\n\n(Plus, get an extra 0.25% return right now for female senior citizens.)"
            else:
                snippet = f"\n\n(Secure your retirement income with our highest-tier deposits.)"
            body += snippet
        elif user.get("age") and user["age"] <= 35:
            body += f"\n\n(Grow your savings faster 🚀. Because a {occupation} in {city} deserves compounding wealth.)"
        else:
            # Fallback dynamic urgency/social proof snippet
            if angle == "social_proof":
                snippet = f"\n\n(P.S. 32 other {occupation}s in {city} also opened this deposit this week.)"
                body += snippet
            
        return {
            "subject": subject,
            "body": body
        }

    def compile_email(self, template: dict, recipients: list[CustomerRecord], angle: str) -> dict:
        """
        Build the final outbound subject/body for a CampaignX send.

        For one recipient, resolve placeholders with true personalization.
        For multi-recipient batches, replace placeholders with safe shared/generic values
        so the API never receives raw template variables.
        """
        if len(recipients) == 1:
            compiled = self.personalize_email(template, recipients[0], angle)
        else:
            replacements = {
                "name": "there",
                "city": self._shared_value(recipients, "city", "your area"),
                "occupation": self._shared_value(recipients, "occupation", "professional"),
                "income": self._shared_value(recipients, "income", ""),
            }
            compiled = {
                "subject": self._replace_placeholders(template.get("subject", ""), replacements),
                "body": self._replace_placeholders(template.get("body", ""), replacements),
            }

        subject, body = self.sanitize_campaign_copy(
            compiled.get("subject", ""),
            compiled.get("body", ""),
        )
        return {"subject": subject, "body": body}

    def sanitize_campaign_copy(self, subject: str, body: str) -> tuple[str, str]:
        subject = self._replace_placeholders(subject or "", {
            "name": "there",
            "city": "your area",
            "occupation": "professional",
            "income": "",
        })
        body = self._replace_placeholders(body or "", {
            "name": "there",
            "city": "your area",
            "occupation": "professional",
            "income": "",
        })

        subject = URL_RE.sub("", subject)
        body = URL_RE.sub(ALLOWED_CTA_URL, body)

        subject = self._normalize_whitespace(subject)
        body = self._normalize_whitespace(body)
        body = self._dedupe_cta_url(body)
        body = self._normalize_whitespace(body)

        if not subject:
            subject = "SuperBFSI XDeposit Update"
        if not body:
            body = f"Explore XDeposit: {ALLOWED_CTA_URL}"

        return subject[:MAX_SUBJECT_LENGTH], body[:MAX_BODY_LENGTH]

    def _replace_placeholders(self, text: str, replacements: dict[str, str]) -> str:
        def repl(match: re.Match[str]) -> str:
            key = match.group(1).strip().lower()
            return str(replacements.get(key, ""))

        return PLACEHOLDER_RE.sub(repl, text)

    def _shared_value(
        self,
        recipients: list[CustomerRecord],
        key: str,
        fallback: str,
    ) -> str:
        values = {
            str(self._field_value(recipient, key)).strip()
            for recipient in recipients
            if self._field_value(recipient, key) not in (None, "", "None")
        }
        if len(values) == 1:
            return next(iter(values))
        return fallback

    def _normalize_whitespace(self, text: str) -> str:
        text = re.sub(r"[ \t]+", " ", text or "")
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _field_value(self, recipient: CustomerRecord, key: str):
        aliases = {
            "name": ("name", "full_name"),
            "income": ("income", "monthly_income"),
        }
        for field_name in aliases.get(key, (key,)):
            value = recipient.get(field_name)
            if value not in (None, "", "None"):
                return value
        return None

    def _dedupe_cta_url(self, text: str) -> str:
        seen = False
        parts: list[str] = []
        last_index = 0
        for match in URL_RE.finditer(text):
            parts.append(text[last_index:match.start()])
            url = match.group(0)
            if url == ALLOWED_CTA_URL and not seen:
                parts.append(url)
                seen = True
            last_index = match.end()
        parts.append(text[last_index:])
        return "".join(parts)


personalization_engine = PersonalizationEngine()
