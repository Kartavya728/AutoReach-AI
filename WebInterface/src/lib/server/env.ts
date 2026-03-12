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
    geminiApiKey: getEnv("GEMINI_API_KEY"),
    geminiModel: getEnv("GEMINI_MODEL", "gemini-2.5-flash"),

    supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    pythonAgentUrl: getEnv("PYTHON_AGENT_URL", DEFAULT_PYTHON_AGENT_URL)!,
  };
}

/** Available Gemini models the user can select from */
export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", isDefault: true },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", isDefault: false },
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", isDefault: false },
];
