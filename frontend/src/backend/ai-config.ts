const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

export function requireAIEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAIConfig() {
  return {
    geminiApiKey: getEnv("GEMINI_API_KEY"),
    geminiModel: getEnv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)!,
  };
}
