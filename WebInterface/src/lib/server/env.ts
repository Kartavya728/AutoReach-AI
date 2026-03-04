const DEFAULT_CAMPAIGNX_BASE_URL = "https://campaignx.inxiteout.ai";
const DEFAULT_LANGCHAIN_ENDPOINT = "https://api.smith.langchain.com";

function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

export function requireServerEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getServerConfig() {
  return {
    campaignxBaseUrl: getEnv("CAMPAIGNX_BASE_URL", DEFAULT_CAMPAIGNX_BASE_URL)!,
    campaignxApiKey: getEnv("CAMPAIGNX_API_KEY"),
    geminiApiKey: getEnv("GEMINI_API_KEY"),
    geminiModel: getEnv("GEMINI_MODEL", "gemini-2.0-flash"),
    langsmithApiKey: getEnv("LANGSMITH_API_KEY"),
    langsmithWorkspaceId: getEnv("LANGSMITH_WORKSPACE_ID"),
    langsmithProject: getEnv("LANGSMITH_PROJECT"),
    langchainProject: getEnv("LANGCHAIN_PROJECT", "campaignx-ai")!,
    langchainEndpoint: getEnv("LANGCHAIN_ENDPOINT", DEFAULT_LANGCHAIN_ENDPOINT)!,
    langchainTracingEnabled: getEnv("LANGCHAIN_TRACING_V2", "true") === "true",
    supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
