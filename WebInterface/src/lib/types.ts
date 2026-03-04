export interface CustomerRecord {
  customer_id: string;
  email: string;
  name: string;
  age?: number;
  gender?: string;
  region?: string;
  status?: string;
}

export interface CustomerCohortResponse {
  data: CustomerRecord[];
  total_count: number;
  response_code: number;
  message: string;
}

export interface SendCampaignRequest {
  subject: string;
  body: string;
  list_customer_ids: string[];
  send_time: string;
}

export interface SendCampaignResponse {
  campaign_id: string;
  response_code: number;
  invokation_time: string;
  message: string;
}

export interface CampaignReportRecord {
  invokation_time: string;
  invokation_date: string;
  campaign_id: string;
  customer_id: string;
  send_time: string;
  subject: string;
  body: string;
  EO: "Y" | "N";
  EC: "Y" | "N";
}

export interface GetReportResponse {
  campaign_id: string;
  data: CampaignReportRecord[];
  total_rows: number;
  response_code: number;
  message: string;
}

export interface GeminiCampaignRequest {
  brief: string;
  temperature?: number;
  useEmojis?: boolean;
  tone?: string;
  additionalParams?: string;
}

export interface GeneratedEmailVariant {
  subject: string;
  body: string;
  variant: string;
  tone: string;
  tags: string[];
}

export interface CampaignAgentStep {
  step: string;
  agent: string;
}

export interface CampaignAgentResponse {
  brief: string;
  strategy: string;
  contentVariants: GeneratedEmailVariant[];
  customerCount: number;
  campaignReady: boolean;
  steps: CampaignAgentStep[];
}
