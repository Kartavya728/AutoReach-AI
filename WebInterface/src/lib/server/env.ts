const DEFAULT_CAMPAIGNX_BASE_URL = "https://campaignx.inxiteout.ai";
const DEFAULT_PYTHON_AGENT_URL = "http://localhost:8000";

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
    supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    pythonAgentUrl: getEnv("PYTHON_AGENT_URL", DEFAULT_PYTHON_AGENT_URL)!,
  };
}
