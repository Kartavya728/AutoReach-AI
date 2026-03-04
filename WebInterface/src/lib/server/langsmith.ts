import { getServerConfig } from "@/src/lib/server/env";

export function configureLangSmithTracing(): boolean {
  try {
    const config = getServerConfig();

    // If tracing is explicitly disabled or no API key, skip setup
    if (!config.langchainTracingEnabled || !config.langsmithApiKey) {
      process.env.LANGCHAIN_TRACING_V2 = "false";
      return false;
    }

    // Set environment variables for LangSmith/LangChain tracing
    process.env.LANGCHAIN_TRACING_V2 = "true";
    process.env.LANGCHAIN_ENDPOINT = config.langchainEndpoint;
    process.env.LANGCHAIN_API_KEY = config.langsmithApiKey;
    process.env.LANGCHAIN_PROJECT = config.langchainProject;

    // Also set LANGSMITH_* variants for newer SDK versions
    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_API_KEY = config.langsmithApiKey;
    process.env.LANGSMITH_ENDPOINT = config.langchainEndpoint;

    if (config.langsmithProject) {
      process.env.LANGSMITH_PROJECT = config.langsmithProject;
    }

    return true;
  } catch (err) {
    // Tracing should never crash the agent workflow
    console.warn("[LangSmith] Failed to configure tracing:", err);
    process.env.LANGCHAIN_TRACING_V2 = "false";
    return false;
  }
}
