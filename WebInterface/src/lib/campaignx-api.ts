import type {
  CustomerCohortResponse,
  GetReportResponse,
  SendCampaignRequest,
  SendCampaignResponse,
} from "@/src/lib/types";

export type {
  CustomerCohortResponse,
  CustomerRecord,
  GetReportResponse,
  CampaignReportRecord,
  SendCampaignRequest,
  SendCampaignResponse,
} from "@/src/lib/types";

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

export async function getCustomerCohort(): Promise<CustomerCohortResponse> {
  return request<CustomerCohortResponse>("/api/campaignx/cohort", {
    method: "GET",
    cache: "no-store",
  });
}

export async function sendCampaign(
  payload: SendCampaignRequest
): Promise<SendCampaignResponse> {
  return request<SendCampaignResponse>("/api/campaignx/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCampaignReport(
  campaignId: string
): Promise<GetReportResponse> {
  const search = new URLSearchParams({ campaign_id: campaignId });
  return request<GetReportResponse>(`/api/campaignx/report?${search.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
}
