import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { randomUUID } from "crypto";
import { fetchCustomerCohortFromCampaignX } from "@/src/lib/server/campaignx";
import { getServerConfig } from "@/src/lib/server/env";
import { configureLangSmithTracing } from "@/src/lib/server/langsmith";
import { persistAgentTrace } from "@/src/lib/server/supabase";

const WorkflowState = Annotation.Root({
  brief: Annotation(),
  customerCount: Annotation(),
  strategy: Annotation(),
  contentVariants: Annotation(),
  steps: Annotation({
    reducer: (current, update) => [...current, ...(update ?? [])],
    default: () => [],
  }),
});

function contentToText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === "string") {
          return chunk;
        }
        if (chunk && typeof chunk === "object" && "text" in chunk) {
          return String(chunk.text);
        }
        return "";
      })
      .join("\n");
  }
  return JSON.stringify(content);
}

function parseVariants(text) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.slice(0, 3).map((item, index) => ({
      subject: String(item.subject ?? `Campaign Variant ${index + 1}`),
      body: String(item.body ?? ""),
      variant: String(item.variant ?? String.fromCharCode(65 + index)),
      tone: String(item.tone ?? "professional"),
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
    }));
  } catch {
    return [];
  }
}

function getModel() {
  const config = getServerConfig();
  if (!config.geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return new ChatGoogleGenerativeAI({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    temperature: 0.7,
  });
}

async function loadCohortNode(state) {
  const cohort = await fetchCustomerCohortFromCampaignX();
  return {
    customerCount: cohort.total_count,
    steps: [
      {
        agent: "Cohort-Agent",
        step: `Fetched customer cohort from CampaignX (${cohort.total_count} users).`,
      },
    ],
  };
}

async function strategyNode(state) {
  const llm = getModel();
  const response = await llm.invoke([
    new SystemMessage(
      "You are a campaign strategy planner for BFSI email campaigns. Keep output concise."
    ),
    new HumanMessage(
      `Campaign brief:\n${state.brief}\n\nCustomer count: ${state.customerCount}\n\nProvide strategy in 4 bullet points.`
    ),
  ]);

  const strategy = contentToText(response.content);
  return {
    strategy,
    steps: [
      {
        agent: "Strategy-Agent",
        step: "Generated targeting and delivery strategy with LangChain.",
      },
    ],
  };
}

async function contentNode(state) {
  const llm = getModel();
  const response = await llm.invoke([
    new SystemMessage(
      "Generate exactly 3 email variants in JSON array with keys subject, body, variant, tone, tags."
    ),
    new HumanMessage(
      `Campaign brief:\n${state.brief}\n\nStrategy:\n${state.strategy}\n\nReturn JSON only.`
    ),
  ]);
  const variants = parseVariants(contentToText(response.content));

  return {
    contentVariants: variants,
    steps: [
      {
        agent: "Content-Agent",
        step: `Generated ${variants.length} email variants with Gemini.`,
      },
      {
        agent: "Orchestrator",
        step: "LangGraph workflow complete and ready for human approval.",
      },
    ],
  };
}

function buildGraph() {
  return new StateGraph(WorkflowState)
    .addNode("load_cohort", loadCohortNode)
    .addNode("plan_strategy", strategyNode)
    .addNode("generate_content", contentNode)
    .addEdge(START, "load_cohort")
    .addEdge("load_cohort", "plan_strategy")
    .addEdge("plan_strategy", "generate_content")
    .addEdge("generate_content", END)
    .compile();
}

export async function runCampaignLangGraph(brief) {
  configureLangSmithTracing();
  const startedAt = Date.now();
  const runId = randomUUID();

  try {
    const graph = buildGraph();
    const result = await graph.invoke({
      brief,
      customerCount: 0,
      strategy: "",
      contentVariants: [],
      steps: [
        {
          agent: "Orchestrator",
          step: "Initialized LangGraph campaign workflow.",
        },
      ],
    });

    await persistAgentTrace({
      run_id: runId,
      agent_name: "langgraph-orchestrator",
      input_payload: { brief },
      output_payload: {
        strategy: result.strategy,
        variant_count: result.contentVariants.length,
        customer_count: result.customerCount,
      },
      status: "success",
      latency_ms: Date.now() - startedAt,
    });

    return {
      brief,
      strategy: result.strategy,
      contentVariants: result.contentVariants,
      customerCount: result.customerCount,
      campaignReady: true,
      steps: result.steps,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await persistAgentTrace({
      run_id: runId,
      agent_name: "langgraph-orchestrator",
      input_payload: { brief },
      output_payload: { error: message },
      status: "error",
      latency_ms: Date.now() - startedAt,
    });

    throw error;
  }
}
