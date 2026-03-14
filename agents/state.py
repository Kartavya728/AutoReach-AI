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
    segment_id: str           
    segment_name: str         
    customer_ids: list[str]   
    size: int                 
    criteria: str             
    tone: str                 
    focus: str                
    emoji_level: str          

class SegmentResult(TypedDict):
    """Result from sending a campaign to one segment."""
    segment_id: str
    segment_name: str
    campaign_id: str | None     
    customer_ids: list[str]
    total_sent: int
    total_opened: int
    total_clicked: int
    open_rate: float
    click_rate: float
    opened_ids: list[str]       
    clicked_ids: list[str]      
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
    segment_variants: dict   
    steps: Annotated[list[AgentStep], _merge_steps]
