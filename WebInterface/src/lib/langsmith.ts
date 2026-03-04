export interface LangSmithStatus {
  enabled: boolean;
  project: string;
  endpoint: string;
}

export function getLangSmithStatus(): LangSmithStatus {
  return {
    enabled: Boolean(process.env.NEXT_PUBLIC_LANGSMITH_ENABLED === "true"),
    project: process.env.NEXT_PUBLIC_LANGCHAIN_PROJECT ?? "campaignx-ai",
    endpoint:
      process.env.NEXT_PUBLIC_LANGCHAIN_ENDPOINT ??
      "https://api.smith.langchain.com",
  };
}
