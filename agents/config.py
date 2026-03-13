"""
Environment configuration for all agents.
Reads from .env file or environment variables.
"""

import os
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def get_env(name: str, fallback: str | None = None) -> str | None:
    """Get an environment variable, returning fallback if empty."""
    value = os.environ.get(name, "")
    if value and value.strip():
        return value.strip()
    return fallback


def require_env(name: str) -> str:
    """Get a required environment variable, raising if missing."""
    value = get_env(name)
    if not value:
        raise EnvironmentError(f"Missing required environment variable: {name}")
    return value


# ── CampaignX API ──
CAMPAIGNX_BASE_URL = get_env("CAMPAIGNX_BASE_URL", "https://campaignx.inxiteout.ai")
CAMPAIGNX_API_KEY = get_env("CAMPAIGNX_API_KEY")

# ── Gemini LLM ──
GEMINI_API_KEY = get_env("GEMINI_API_KEY")
GEMINI_MODEL = get_env("GEMINI_MODEL", "gemini-2.5-flash")

# ── LangSmith / LangChain Observability ──
LANGSMITH_API_KEY = get_env("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = get_env("LANGSMITH_PROJECT")
LANGCHAIN_PROJECT = get_env("LANGCHAIN_PROJECT", "ai mailing agent")
LANGCHAIN_ENDPOINT = get_env("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
LANGCHAIN_TRACING_ENABLED = get_env("LANGCHAIN_TRACING_V2", "true") == "true"

# ── Supabase ──
SUPABASE_URL = get_env("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = get_env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = get_env("SUPABASE_SERVICE_ROLE_KEY")

# ── Available Gemini Models ──
AVAILABLE_MODELS = [
    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "is_default": True},
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "is_default": False},
    {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "is_default": False},
    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "is_default": False},
    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "is_default": False},
]
