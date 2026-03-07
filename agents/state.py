"""
LangGraph state definition for the campaign workflow.
This is the shared state that flows between all graph nodes.
"""

from __future__ import annotations
from typing import TypedDict, Annotated


class AgentStep(TypedDict):
    """A single trace step recorded by an agent."""
    agent: str
    step: str


class EmailVariant(TypedDict):
    """A generated email variant."""
    subject: str
    body: str
    variant: str
    tone: str
    tags: list[str]


class CustomerRecord(TypedDict, total=False):
    """Condensed CRM record passed to agents."""
    id: str
    age: int | None
    gender: str | None
    occupation: str | None
    income: float | None
    city: str | None
    marital_status: str | None
    credit_score: int | None
    kyc_status: str | None
    app_installed: str | None
    existing_customer: str | None
    social_media_active: str | None
    family_size: int | None
    kids: int | None
    w1: float
    w2: float
    w3: float


class CustomerSegment(TypedDict):
    """A micro-segment of customers with tailored email content."""
    segment_id: str           # e.g. "high_value_pros"
    segment_name: str         # e.g. "High-Value Professionals"
    customer_ids: list[str]   # Customer IDs in this segment
    size: int                 # Number of customers
    criteria: str             # Human-readable criteria description
    tone: str                 # Recommended tone for this segment
    focus: str                # Key messaging focus
    emoji_level: str          # "none", "moderate", "heavy"


class SegmentResult(TypedDict):
    """Result from sending a campaign to one segment."""
    segment_id: str
    segment_name: str
    campaign_id: str | None     # External CampaignX campaign ID
    customer_ids: list[str]
    total_sent: int
    total_opened: int
    total_clicked: int
    open_rate: float
    click_rate: float
    opened_ids: list[str]       # Customer IDs that opened
    clicked_ids: list[str]      # Customer IDs that clicked
    variant_used: EmailVariant


def _merge_steps(current: list[AgentStep], update: list[AgentStep] | None) -> list[AgentStep]:
    """Reducer: append new steps to existing list (matches the JS reducer)."""
    return [*current, *(update or [])]


class WorkflowState(TypedDict):
    """
    Shared state flowing through the LangGraph.
    
    The `steps` field uses a reducer so each node *appends* to the list
    rather than overwriting it — this accumulates an audit trail.
    """
    brief: str
    crm_data: list[CustomerRecord]
    customer_count: int
    target_customer_ids: list[str]
    strategy_reasoning: str
    strategy: str
    content_variants: list[EmailVariant]
    segments: list[CustomerSegment]
    segment_variants: dict   # segment_id -> EmailVariant
    session_id: str          # For real-time SSE log streaming
    steps: Annotated[list[AgentStep], _merge_steps]
