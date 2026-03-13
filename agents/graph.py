"""
LangGraph Orchestrator — Builds & Runs the Campaign Creation Graph
===================================================================
Graph topology (linear pipeline):
    START → load_cohort → plan_strategy → generate_content → END

Now segment-aware: cohort node segments customers, content node
generates per-segment emails.
"""

from __future__ import annotations
import uuid
import time
from langgraph.graph import StateGraph, START, END

from agents.state import WorkflowState
from agents.cohort_agent import load_cohort
from agents.strategy_agent import plan_strategy
from agents.content_agent import generate_content
from agents.supabase_client import persist_agent_trace


def build_graph() -> StateGraph:
    """
    Build the campaign creation LangGraph.
    
    Topology:
        START → load_cohort → plan_strategy → generate_content → END
    """
    graph = StateGraph(WorkflowState)

    graph.add_node("load_cohort", load_cohort)
    graph.add_node("plan_strategy", plan_strategy)
    graph.add_node("generate_content", generate_content)

    graph.add_edge(START, "load_cohort")
    graph.add_edge("load_cohort", "plan_strategy")
    graph.add_edge("plan_strategy", "generate_content")
    graph.add_edge("generate_content", END)

    return graph.compile()


async def run_campaign_graph(brief: str) -> dict:
    """
    Full orchestrator: configure tracing → build graph → invoke → persist trace.
    
    Returns dict with segments, segment_variants, and per-segment content.
    """
    started_at = time.time()
    run_id = str(uuid.uuid4())

    try:
        graph = build_graph()

        initial_state: WorkflowState = {
            "brief": brief,
            "crm_data": [],
            "customer_count": 0,
            "target_customer_ids": [],
            "strategy_reasoning": "",
            "strategy": "",
            "content_variants": [],
            "segments": [],
            "segment_variants": {},
            "steps": [
                {"agent": "Orchestrator", "step": "Initialized LangGraph AI targeting workflow."}
            ],
        }

        result = await graph.ainvoke(initial_state)

        latency_ms = int((time.time() - started_at) * 1000)
        try:
            persist_agent_trace({
                "run_id": run_id,
                "agent_name": "langgraph-orchestrator",
                "input_payload": {"brief": brief},
                "output_payload": {
                    "strategy": result.get("strategy", ""),
                    "variant_count": len(result.get("content_variants", [])),
                    "segment_count": len(result.get("segments", [])),
                    "customer_count": result.get("customer_count", 0),
                },
                "status": "success",
                "latency_ms": latency_ms,
            })
        except Exception:
            pass

        return {
            "brief": brief,
            "strategy": result.get("strategy", ""),
            "strategy_reasoning": result.get("strategy_reasoning", ""),
            "target_customer_ids": result.get("target_customer_ids", []),
            "content_variants": result.get("content_variants", []),
            "segments": result.get("segments", []),
            "segment_variants": result.get("segment_variants", {}),
            "customer_count": result.get("customer_count", 0),
            "crm_data": result.get("crm_data", []),
            "campaign_ready": True,
            "steps": result.get("steps", []),
        }

    except Exception as error:
        latency_ms = int((time.time() - started_at) * 1000)
        try:
            persist_agent_trace({
                "run_id": run_id,
                "agent_name": "langgraph-orchestrator",
                "input_payload": {"brief": brief},
                "output_payload": {"error": str(error)},
                "status": "error",
                "latency_ms": latency_ms,
            })
        except Exception:
            pass
        raise
