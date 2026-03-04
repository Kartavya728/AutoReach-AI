import { getServerConfig } from "@/src/lib/server/env";

export function configureLangSmithTracing() {
  const config = getServerConfig();
  if (!config.langsmithApiKey) {
    return false;
  }

  process.env.LANGCHAIN_TRACING_V2 = config.langchainTracingEnabled
    ? "true"
    : "false";
  process.env.LANGCHAIN_ENDPOINT = config.langchainEndpoint;
  process.env.LANGCHAIN_API_KEY = config.langsmithApiKey;
  process.env.LANGCHAIN_PROJECT = config.langchainProject;

  if (config.langsmithWorkspaceId) {
    process.env.LANGSMITH_WORKSPACE_ID = config.langsmithWorkspaceId;
  }
  if (config.langsmithProject) {
    process.env.LANGSMITH_PROJECT = config.langsmithProject;
  }

  return true;
}
