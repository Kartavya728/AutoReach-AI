import { getServerConfig, requireServerEnv } from "@/src/lib/server/env";
import type {
  CustomerCohortResponse,
  GetReportResponse,
  SendCampaignRequest,
  SendCampaignResponse,
} from "@/src/lib/types";

type EndpointConfig = {
  method: "GET" | "POST";
  path: string;
};

const ENDPOINTS: Record<"cohort" | "send" | "report", EndpointConfig> = {
  cohort: { method: "GET", path: "/api/v1/get_customer_cohort" },
  send: { method: "POST", path: "/api/v1/send_campaign" },
  report: { method: "GET", path: "/api/v1/get_report" },
};

async function campaignxRequest<T>(
  endpoint: keyof typeof ENDPOINTS,
  options: {
    query?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  const config = getServerConfig();
  const apiKey = requireServerEnv("CAMPAIGNX_API_KEY");
  const endpointConfig = ENDPOINTS[endpoint];

  const url = new URL(endpointConfig.path, config.campaignxBaseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: endpointConfig.method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(`CampaignX API error (${response.status}): ${rawError}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchCustomerCohortFromCampaignX() {
  return campaignxRequest<CustomerCohortResponse>("cohort");
}

export async function sendCampaignToCampaignX(payload: SendCampaignRequest) {
  return campaignxRequest<SendCampaignResponse>("send", { body: payload });
}

export async function fetchCampaignReportFromCampaignX(campaignId: string) {
  return campaignxRequest<GetReportResponse>("report", {
    query: { campaign_id: campaignId },
  });
}
