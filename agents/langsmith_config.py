"""
LangSmith / LangChain tracing configuration.
Sets environment variables so all langchain calls are auto-traced.
"""

from __future__ import annotations
import os
from agents.config import (
    LANGCHAIN_TRACING_ENABLED,
    LANGCHAIN_ENDPOINT,
    LANGSMITH_API_KEY,
    LANGCHAIN_PROJECT,
    LANGSMITH_PROJECT,
)

def configure_tracing() -> bool:
    """
    Configure LangSmith tracing by setting environment variables.

    Returns True if tracing was enabled, False otherwise.
    Tracing failures are silenced — they should never crash the agent workflow.
    """
    try:
        if not LANGCHAIN_TRACING_ENABLED or not LANGSMITH_API_KEY:
            os.environ["LANGCHAIN_TRACING_V2"] = "false"
            return False

        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_ENDPOINT"] = LANGCHAIN_ENDPOINT or "https://api.smith.langchain.com"
        os.environ["LANGCHAIN_API_KEY"] = LANGSMITH_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = LANGCHAIN_PROJECT or "ai mailing agent"

        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ["LANGSMITH_API_KEY"] = LANGSMITH_API_KEY
        os.environ["LANGSMITH_ENDPOINT"] = LANGCHAIN_ENDPOINT or "https://api.smith.langchain.com"

        if LANGSMITH_PROJECT:
            os.environ["LANGSMITH_PROJECT"] = LANGSMITH_PROJECT

        return True

    except Exception as e:
        print(f"[LangSmith] Failed to configure tracing: {e}")
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        return False
