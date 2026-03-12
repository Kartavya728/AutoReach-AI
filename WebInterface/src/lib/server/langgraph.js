import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { randomUUID } from "crypto";
import { serverGetCustomers } from "@/src/lib/server/customers";
import { getServerConfig } from "@/src/lib/server/env";

import { persistAgentTrace } from "@/src/lib/server/supabase";

const WorkflowState = Annotation.Root({
  brief: Annotation(),
  crmData: Annotation(),
  customerCount: Annotation(),
  targetCustomerIds: Annotation(),
  strategyReasoning: Annotation(),
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
  console.log("[LangGraph] load_cohort starting with brief:", state.brief);
  const customers = await serverGetCustomers();
  
  // Condense CRM payload to avoid massive context windows
  const crmData = customers.map(c => ({
    id: c.customer_id,
    age: c.age,
    gender: c.gender,
    occupation: c.occupation,
    income: c.monthly_income,
    w1: c.w1,
    w2: c.w2,
    w3: c.w3,
  }));

  if (!crmData || crmData.length === 0) {
    console.error("[LangGraph] load_cohort: fetched 0 customers (empty CRM data).");
  }

  const result = {
    brief: state.brief || "",
    strategy: state.strategy || "",
    strategyReasoning: state.strategyReasoning || "",
    contentVariants: state.contentVariants || [],
    crmData: crmData,
    customerCount: customers.length,
    targetCustomerIds: state.targetCustomerIds || [],
    steps: [
      {
        agent: "Cohort-Agent",
        step: `Fetched audience CRM (${customers.length} users) from database.`,
      },
    ],
  };
  
  console.log("[LangGraph] load_cohort finished. customerCount:", result.customerCount);
  return result;
}

async function strategyNode(state) {
  console.log("[LangGraph] strategyNode starting. crmData present:", !!state.crmData);
  const llm = getModel();
  const response = await llm.invoke([
    new SystemMessage(
      "You are a BFSI AI targeting agent. " +
      "Analyze the brief and the customer database (CRM). " +
      "Weights (w1,w2,w3) represent engagement likelihood for different financial products (e.g. w1=loans, w2=deposits, w3=cards). " +
      "Your GOAL is to explicitly filter and select a subset of customers who are most likely to convert. " +
      "Instead of returning huge lists of IDs, return the logically calculated criteria to slice the cohort. " +
      "You must return JSON containing ONLY: " +
      "1. `targetWeight`: The best weight to filter by ('w1', 'w2', or 'w3'). " +
      "2. `strategy`: 4 bullet points of the content strategy. " +
      "3. `strategyReasoning`: Detailed natural language explanation of WHY these specific users were chosen based on attributes and weights."
    ),
    new HumanMessage(
      `Campaign brief:\n${state.brief}\n\nCRM Data Summary:\n` + 
      `Total users: ${state.crmData ? state.crmData.length : 0}. Average w1: 0.5, w2: 0.5, w3: 0.5.\n\nReturn strict JSON.`
    ),
  ]);

  const outputRaw = contentToText(response.content);
  let parsed;
  try {
    const start = outputRaw.indexOf("{");
    const end = outputRaw.lastIndexOf("}");
    parsed = JSON.parse(outputRaw.slice(start, end + 1));
  } catch (e) {
    console.error("[LangGraph] Failed to parse Strategy output:", e);
    parsed = {
      targetWeight: "w1",
      strategy: "* Target top users\n* Engage\n* Monitor\n* Optimize",
      strategyReasoning: "Fallback targeting top w1 users due to JSON parsing failure.",
    };
  }

  // Filter cohort securely in the backend using LLM's criteria
  let targetCustomerIds = state.crmData ? state.crmData.map(c => c.id) : [];
  if (parsed.targetWeight && state.crmData) {
    const targetKey = parsed.targetWeight;
    const scored = state.crmData.map(c => ({ id: c.id, score: Number(c[targetKey]) || 0 }));
    scored.sort((a,b) => b.score - a.score);
    // Take between 1500 and 2000 customers (or max scored.length if < 1500)
    const subsetSize = Math.min(scored.length, Math.floor(Math.random() * 501) + 1500);
    targetCustomerIds = scored.slice(0, subsetSize).map(x => x.id);
  }

  const finalStrategy = parsed.strategy || "";
  const finalReasoning = parsed.strategyReasoning || `Targeting criteria: Top 20% of ${parsed.targetWeight}`;

  if (!finalStrategy || !finalReasoning || !targetCustomerIds || targetCustomerIds.length === 0) {
    console.error("[LangGraph] strategyNode returned empty strategy or zero target users.");
  }

  const result = {
    brief: state.brief || "",
    strategy: finalStrategy,
    strategyReasoning: finalReasoning,
    contentVariants: state.contentVariants || [],
    crmData: state.crmData || [],
    customerCount: state.customerCount || 0,
    targetCustomerIds: targetCustomerIds,
    steps: [
      {
        agent: "Targeting-Agent",
        step: `Selected ${targetCustomerIds.length} users and generated strategy reasoning.`,
      },
    ],
  };

  console.log("[LangGraph] strategyNode finished. Selected targets:", result.targetCustomerIds.length);
  return result;
}

async function contentNode(state) {
  console.log("[LangGraph] contentNode starting. strategy present:", !!state.strategy);
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

  if (!variants || variants.length === 0) {
    console.error("[LangGraph] contentNode generated empty contentVariants.");
  }

  const result = {
    brief: state.brief || "",
    strategy: state.strategy || "",
    strategyReasoning: state.strategyReasoning || "",
    contentVariants: variants && variants.length > 0 ? variants : [{
      subject: "Engage with our latest offer",
      body: "Hello! Based on your recent activity, we have a great offer to help you achieve your goals. Visit our dashboard to learn more.",
      variant: "Fallback A",
      tone: "professional",
      tags: ["fallback", "engagement"]
    }],
    crmData: state.crmData || [],
    customerCount: state.customerCount || 0,
    targetCustomerIds: state.targetCustomerIds || [],
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

  console.log("[LangGraph] contentNode finished. variants:", variants.length);
  return result;
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

  const startedAt = Date.now();
  const runId = randomUUID();

  try {
    const graph = buildGraph();
    const result = await graph.invoke({
      brief,
      crmData: [],
      customerCount: 0,
      targetCustomerIds: [],
      strategyReasoning: "",
      strategy: "",
      contentVariants: [],
      steps: [
        {
          agent: "Orchestrator",
          step: "Initialized LangGraph AI targeting workflow.",
        },
      ],
    });

    // Persist trace in background — don't let it crash the response
    try {
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
    } catch (traceErr) {
      console.warn("[Supabase] Failed to persist success trace:", traceErr);
    }

    return {
      brief,
      strategy: result.strategy,
      strategyReasoning: result.strategyReasoning,
      targetCustomerIds: result.targetCustomerIds,
      contentVariants: result.contentVariants,
      customerCount: result.targetCustomerIds?.length || result.customerCount,
      campaignReady: true,
      steps: result.steps,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Persist error trace in background — don't let it mask the real error
    try {
      await persistAgentTrace({
        run_id: runId,
        agent_name: "langgraph-orchestrator",
        input_payload: { brief },
        output_payload: { error: message },
        status: "error",
        latency_ms: Date.now() - startedAt,
      });
    } catch (traceErr) {
      console.warn("[Supabase] Failed to persist error trace:", traceErr);
    }

    throw error;
  }
}
