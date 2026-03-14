// Core records

export interface CustomerRecord {
  customer_id: string;
  email: string;
  name: string;
  age?: number;
  gender?: string;
  region?: string;
  status?: string;
}

export interface CustomerCRMRecord {
  id: string;
  customer_id: string;
  email: string;
  full_name?: string | null;
  age?: number | null;
  gender?: string | null;
  marital_status?: string | null;
  family_size?: number | null;
  dependent_count?: number | null;
  occupation?: string | null;
  occupation_type?: string | null;
  monthly_income?: number | null;
  kyc_status?: string | null;
  city?: string | null;
  kids_in_household?: number | null;
  app_installed?: string | null;
  existing_customer?: string | null;
  credit_score?: number | null;
  social_media_active?: string | null;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  topics_list: string[];
  w1: number;
  w2: number;
  w3: number;
  created_at: string;
  updated_at: string;
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

// Agent runtime

export interface GeneratedEmailVariant {
  subject: string;
  body: string;
  variant: string;
  tone: string;
  tags: string[];
  ctaLink?: string;
}

export type AgentPauseType = "segment_approval" | "content_approval" | "next_round" | string;
export type AgentRoundPhase = "virtual_prediction" | "optimization" | string;

export interface AgentThinkingStep {
  agent: string;
  step: string;
  kind?: string;
}

export interface AgentSegmentCard {
  segmentId: string;
  name: string;
  size: number;
  criteria?: string;
  tone?: string;
  focus?: string;
  tier?: string;
  approved?: boolean;
}

export interface AgentDraftCard {
  segmentId: string;
  segmentName: string;
  size: number;
  subject: string;
  body: string;
  tone?: string;
  tags?: string[];
  ctaLink?: string;
  approved?: boolean;
}

export type AgentTwinPersonaDecision = "pending" | "open" | "click" | "ignore";
export type AgentTwinCardStage = "queued" | "testing" | "passed" | "retrying" | "fallback";

export interface AgentTwinPersonaCard {
  personaId: string;
  name: string;
  occupation?: string;
  city?: string;
  decision: AgentTwinPersonaDecision;
  monologue?: string;
}

export interface AgentTwinCard {
  segmentId: string;
  segmentName: string;
  size: number;
  attempt: number;
  maxAttempts: number;
  stage: AgentTwinCardStage;
  subject: string;
  body: string;
  ctaLink?: string;
  openVotes: number;
  clickVotes: number;
  ignoreVotes: number;
  personas: AgentTwinPersonaCard[];
}

export interface AgentPausePayload {
  pauseType: AgentPauseType;
  title?: string;
  message?: string;
  round?: number;
  maxRounds?: number;
  ctaLink?: string;
  segments?: AgentSegmentCard[];
  variants?: AgentDraftCard[];
  metrics?: {
    audience?: number;
    openRate?: number;
    clickRate?: number;
    totalOpened?: number;
    totalClicked?: number;
    uniqueOpened?: number;
    uniqueClicked?: number;
    predictedOpenRate?: number;
    predictedClickRate?: number;
  };
}

export interface AgentLiveMetrics {
  round: number;
  phase?: AgentRoundPhase;
  phaseLabel?: string;
  displayRound?: number;
  optimizationRound?: number;
  virtualPredictionRound?: number;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
  uniqueOpened: number;
  uniqueClicked: number;
  predictedOpenRate?: number;
  predictedClickRate?: number;
  bySegment: Array<{
    segmentName: string;
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
  }>;
}

export interface AgentRoundComplete {
  round: number;
  phase?: AgentRoundPhase;
  phaseLabel?: string;
  displayRound?: number;
  optimizationRound?: number;
  virtualPredictionRound?: number;
  summary: {
    audience: number;
    openRate: number;
    clickRate: number;
    segments: number;
    phase?: AgentRoundPhase;
    phaseLabel?: string;
    displayRound?: number;
    optimizationRound?: number;
    virtualPredictionRound?: number;
    totalOpened?: number;
    totalClicked?: number;
    uniqueOpened?: number;
    uniqueClicked?: number;
    predictedOpenRate?: number;
    predictedClickRate?: number;
  };
}

export interface AgentRunResult {
  brief: string;
  ctaLink?: string;
  strategy: string;
  strategyReasoning: string;
  contentVariants: GeneratedEmailVariant[];
  segments: Array<{
    name: string;
    size: number;
    criteria: string;
    tone: string;
    focus: string;
    approved?: boolean;
  }>;
  metricsProgression: Array<{
    round: number;
    phase?: AgentRoundPhase;
    phaseLabel?: string;
    displayRound?: number;
    optimizationRound?: number;
    virtualPredictionRound?: number;
    audience: number;
    openRate: number;
    clickRate: number;
    segments: number;
    totalOpened?: number;
    totalClicked?: number;
    uniqueOpened?: number;
    uniqueClicked?: number;
    predictedOpenRate?: number;
    predictedClickRate?: number;
  }>;
  customerCount: number;
  targetCustomerIds: string[];
  savedCampaignId: string | null;
  finalOpenRate: number;
  finalClickRate: number;
  finalTotalOpened?: number;
  finalTotalClicked?: number;
  uniqueTotalOpened?: number;
  uniqueTotalClicked?: number;
  predictedFinalOpenRate?: number;
  predictedFinalClickRate?: number;
  rawResult: unknown;
}

// Supabase campaign

export interface CampaignRow {
  id: string;
  external_campaign_id?: string | null;
  name: string;
  brief: string;
  cta_link?: string | null;
  status: "draft" | "pending_approval" | "active" | "completed" | "paused";
  subject?: string | null;
  body?: string | null;
  target_segment: string;
  total_customers: number;
  send_time?: string | null;
  temperature: number;
  use_emojis: boolean;
  tone: string;
  optimization_round: number;
  open_rate?: number | null;
  click_rate?: number | null;
  total_opened?: number | null;
  total_clicked?: number | null;
  target_customer_ids?: string[] | null;
  strategy_reasoning?: string | null;
  json_output?: any | null;
  created_at: string;
  updated_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  campaign_variants?: CampaignVariantRow[];
}

export interface CampaignVariantRow {
  id: string;
  campaign_id: string;
  variant_label: string;
  subject: string;
  body: string;
  tone?: string | null;
  tags?: string[] | null;
  expected_open_rate?: string | null;
  expected_click_rate?: string | null;
  is_selected: boolean;
  created_at: string;
}

export interface CampaignRunImprovement {
  round: number;
  open_rate: number;
  click_rate: number;
  open_rate_delta: number;
  click_rate_delta: number;
}

export interface CampaignRunAgentCategory {
  agent: string;
  message_count: number;
  thought_count: number;
  action_count: number;
  observation_count: number;
}

export interface CampaignRunFinalMail {
  segment_id: string;
  segment_name: string;
  subject: string;
  body: string;
  tone?: string | null;
  tags?: string[] | null;
  cta_link?: string | null;
  approved?: boolean;
}

export interface CampaignRunMessage {
  id?: string;
  role: string;
  text: string;
  kind?: string;
  agent?: string;
  timestamp?: number;
}

export interface CampaignRunRow {
  id: string;
  campaign_name: string;
  prompt: string;
  cta_link?: string | null;
  phase: string;
  total_rounds: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  open_rate: number;
  click_rate: number;
  metrics: AgentLiveMetrics | null;
  round_history: AgentRoundComplete[];
  improvements: CampaignRunImprovement[];
  agent_categories: CampaignRunAgentCategory[];
  final_mails: CampaignRunFinalMail[];
  tools_used: string[];
  terminal_logs: string[];
  messages: CampaignRunMessage[];
  segments: AgentSegmentCard[];
  twin_cards: AgentTwinCard[];
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignRunPayload {
  campaign_name: string;
  prompt: string;
  cta_link?: string;
  phase: string;
  total_rounds: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  open_rate: number;
  click_rate: number;
  metrics?: AgentLiveMetrics | null;
  round_history?: AgentRoundComplete[];
  improvements?: CampaignRunImprovement[];
  agent_categories?: CampaignRunAgentCategory[];
  final_mails?: CampaignRunFinalMail[];
  tools_used?: string[];
  terminal_logs?: string[];
  messages?: CampaignRunMessage[];
  segments?: AgentSegmentCard[];
  twin_cards?: AgentTwinCard[];
  raw_payload?: Record<string, unknown> | null;
}

export interface OptimizationSuggestionRow {
  id: string;
  campaign_id: string;
  title: string;
  priority: "high" | "medium" | "low";
  expected_impact?: string | null;
  reasoning?: string | null;
  current_value?: string | null;
  suggested_value?: string | null;
  category?: string | null;
  status: "pending" | "approved" | "rejected";
  agent_thoughts?: string[] | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface OptimizationHistoryRow {
  id: string;
  campaign_id: string;
  round: number;
  date: string;
  previous_audience_size: number | null;
  new_audience_size: number | null;
  previous_open_rate: number | null;
  previous_click_rate: number | null;
  applied_optimizations: string[] | null;
  expected_improvements: string[] | null;
  created_at: string;
}

// API payloads

export interface CreateCampaignPayload {
  name: string;
  brief: string;
  cta_link?: string;
  subject?: string;
  body?: string;
  target_segment?: string;
  total_customers?: number;
  temperature?: number;
  use_emojis?: boolean;
  tone?: string;
  variants?: Omit<CampaignVariantRow, "id" | "campaign_id" | "created_at">[];
  target_customer_ids?: string[];
  strategy_reasoning?: string;
  json_output?: any;
}

export interface UpdateCampaignPayload {
  external_campaign_id?: string;
  name?: string;
  cta_link?: string;
  status?: CampaignRow["status"];
  subject?: string;
  body?: string;
  strategy?: string;
  send_time?: string;
  total_customers?: number;
  temperature?: number;
  use_emojis?: boolean;
  tone?: string;
  optimization_round?: number;
  open_rate?: number;
  click_rate?: number;
  total_opened?: number;
  total_clicked?: number;
  approved_by?: string;
  approved_at?: string;
  target_customer_ids?: string[];
  strategy_reasoning?: string;
  json_output?: any;
}

export interface OptimizeRequest {
  campaignId: string;
  approvedSuggestions: OptimizationSuggestionRow[];
}

export interface ImprovementReport {
  campaignId: string;
  previousMetrics: {
    openRate: number | null;
    clickRate: number | null;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
  };
  optimizationsApplied: string[];
  updatedStrategy: string;
  updatedVariants: GeneratedEmailVariant[];
  expectedImprovements: string[];
  newOptimizationRound: number;
}

export interface DashboardStats {
  totalCampaigns: number;
  totalCustomersReached: number;
  avgOpenRate: number;
  avgClickRate: number;
  activeOptimizations: number;
  pendingApprovals: number;
}

// Computed analysis report

export interface ComputedAnalysisReport {
  campaignId: string;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
  timeSeriesData: { time: string; opens: number; clicks: number; hour: number }[];
  segmentPerformance: { segment: string; openRate: number; clickRate: number; count: number }[];
  regionPerformance: { region: string; openRate: number; clickRate: number }[];
  genderPerformance: { gender: string; openRate: number; clickRate: number }[];
  deviceBreakdown: { device: string; percentage: number }[];
  hourlyBestPerformance: string;
  topPerformingSegment: string;
}
