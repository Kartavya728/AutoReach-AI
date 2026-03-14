import type {
  AgentLiveMetrics,
  AgentPausePayload,
  AgentRoundComplete,
  AgentRunResult,
  AgentThinkingStep,
  AgentTwinCard,
  GeneratedEmailVariant,
} from "@/src/lib/types";

type UnknownRecord = Record<string, unknown>;

export type AgentPauseResponder = (response: Record<string, unknown>) => void;

export interface StreamCampaignAgentOptions {
  rounds?: number;
  interactive?: boolean;
  signal?: AbortSignal;
  onHeartbeat?: () => void;
  onThinking?: (step: AgentThinkingStep) => void;
  onPause?: (pause: AgentPausePayload, respond: AgentPauseResponder) => void;
  onTwinUpdate?: (card: AgentTwinCard) => void;
  onLiveMetrics?: (metrics: AgentLiveMetrics) => void;
  onRoundComplete?: (round: AgentRoundComplete) => void;
  onTerminal?: (text: string) => void;
}

const CLOSE_RECOVERY_ATTEMPTS = 45;
const CLOSE_RECOVERY_DELAY_MS = 1_000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildWebSocketUrl(port: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${port}`;
}

function toVariant(input: unknown, fallbackLabel: string): GeneratedEmailVariant {
  const safe = isRecord(input) ? input : {};
  return {
    subject: String(safe.subject ?? fallbackLabel),
    body: String(safe.body ?? ""),
    variant: String(safe.variant ?? fallbackLabel),
    tone: String(safe.tone ?? "professional"),
    tags: Array.isArray(safe.tags) ? safe.tags.map((tag) => String(tag)) : [],
    ctaLink: safe.ctaLink ? String(safe.ctaLink) : safe.cta_link ? String(safe.cta_link) : undefined,
  };
}

function normalizeVariants(raw: unknown): GeneratedEmailVariant[] {
  if (!isRecord(raw)) {
    return [];
  }

  if (Array.isArray(raw.contentVariants)) {
    return raw.contentVariants.map((item, index) =>
      toVariant(item, `Draft ${String.fromCharCode(65 + index)}`)
    );
  }

  if (Array.isArray(raw.content_variants)) {
    return raw.content_variants.map((item, index) =>
      toVariant(item, `Draft ${String.fromCharCode(65 + index)}`)
    );
  }

  if (isRecord(raw.segment_variants)) {
    return Object.entries(raw.segment_variants).map(([segmentId, variant], index) =>
      toVariant(variant, segmentId || `Draft ${String.fromCharCode(65 + index)}`)
    );
  }

  return [];
}

function normalizeSegments(raw: unknown): AgentRunResult["segments"] {
  if (!isRecord(raw)) {
    return [];
  }

  const input = Array.isArray(raw.segments) ? raw.segments : [];
  return input.map((segment) => {
    const safe = isRecord(segment) ? segment : {};
    return {
      name: String(safe.name ?? safe.segment_name ?? "Segment"),
      size: Number(safe.size ?? 0) || 0,
      criteria: String(safe.criteria ?? ""),
      tone: String(safe.tone ?? ""),
      focus: String(safe.focus ?? ""),
      approved: safe.approved == null ? undefined : Boolean(safe.approved),
    };
  });
}

function normalizeMetricsProgression(raw: unknown): AgentRunResult["metricsProgression"] {
  if (!isRecord(raw)) {
    return [];
  }

  const input = Array.isArray(raw.metricsProgression)
    ? raw.metricsProgression
    : Array.isArray(raw.metrics_progression)
      ? raw.metrics_progression
      : [];

  return input.map((entry) => {
    const safe = isRecord(entry) ? entry : {};
    return {
      round: Number(safe.round ?? 0) || 0,
      audience: Number(safe.audience ?? safe.sent ?? 0) || 0,
      openRate: Number(safe.openRate ?? safe.open_rate ?? 0) || 0,
      clickRate: Number(safe.clickRate ?? safe.click_rate ?? 0) || 0,
      segments: Number(safe.segments ?? 0) || 0,
      totalOpened: Number(safe.totalOpened ?? safe.total_opened ?? 0) || 0,
      totalClicked: Number(safe.totalClicked ?? safe.total_clicked ?? 0) || 0,
      uniqueOpened: Number(safe.uniqueOpened ?? safe.unique_opened ?? 0) || 0,
      uniqueClicked: Number(safe.uniqueClicked ?? safe.unique_clicked ?? 0) || 0,
      predictedOpenRate: Number(safe.predictedOpenRate ?? safe.predicted_open_rate ?? 0) || 0,
      predictedClickRate: Number(safe.predictedClickRate ?? safe.predicted_click_rate ?? 0) || 0,
    };
  });
}

function normalizeTwinCard(raw: unknown): AgentTwinCard | null {
  if (!isRecord(raw)) {
    return null;
  }

  const personas = Array.isArray(raw.personas) ? raw.personas : [];

  return {
    segmentId: String(raw.segmentId ?? raw.segment_id ?? ""),
    segmentName: String(raw.segmentName ?? raw.segment_name ?? "Segment"),
    size: Number(raw.size ?? 0) || 0,
    attempt: Number(raw.attempt ?? 1) || 1,
    maxAttempts: Number(raw.maxAttempts ?? raw.max_attempts ?? 3) || 3,
    stage: String(raw.stage ?? "queued") as AgentTwinCard["stage"],
    subject: String(raw.subject ?? ""),
    body: String(raw.body ?? ""),
    ctaLink: raw.ctaLink ? String(raw.ctaLink) : raw.cta_link ? String(raw.cta_link) : undefined,
    openVotes: Number(raw.openVotes ?? raw.open_votes ?? 0) || 0,
    clickVotes: Number(raw.clickVotes ?? raw.click_votes ?? 0) || 0,
    ignoreVotes: Number(raw.ignoreVotes ?? raw.ignore_votes ?? 0) || 0,
    personas: personas.map((persona, index) => {
      const safe = isRecord(persona) ? persona : {};
      return {
        personaId: String(safe.personaId ?? safe.persona_id ?? `persona-${index + 1}`),
        name: String(safe.name ?? `Persona ${index + 1}`),
        occupation: safe.occupation ? String(safe.occupation) : undefined,
        city: safe.city ? String(safe.city) : undefined,
        decision: String(safe.decision ?? "pending") as AgentTwinCard["personas"][number]["decision"],
        monologue: safe.monologue ? String(safe.monologue) : undefined,
      };
    }),
  };
}

function normalizeRunResult(raw: unknown): AgentRunResult {
  const safe = isRecord(raw) ? raw : {};
  const targetCustomerIds = Array.isArray(safe.targetCustomerIds)
    ? safe.targetCustomerIds.map((id) => String(id))
    : Array.isArray(safe.target_customer_ids)
      ? safe.target_customer_ids.map((id) => String(id))
      : [];

  const customerCount =
    Number(safe.customerCount ?? safe.customer_count ?? 0) || targetCustomerIds.length;

  return {
    brief: String(safe.brief ?? ""),
    ctaLink: safe.ctaLink ? String(safe.ctaLink) : safe.cta_link ? String(safe.cta_link) : undefined,
    strategy: String(safe.strategy ?? ""),
    strategyReasoning: String(safe.strategyReasoning ?? safe.strategy_reasoning ?? ""),
    contentVariants: normalizeVariants(safe),
    segments: normalizeSegments(safe),
    metricsProgression: normalizeMetricsProgression(safe),
    customerCount,
    targetCustomerIds,
    savedCampaignId: safe.savedCampaignId ? String(safe.savedCampaignId) : null,
    finalOpenRate: Number(safe.finalOpenRate ?? safe.final_open_rate ?? 0) || 0,
    finalClickRate: Number(safe.finalClickRate ?? safe.final_click_rate ?? 0) || 0,
    finalTotalOpened: Number(safe.finalTotalOpened ?? safe.final_total_opened ?? 0) || 0,
    finalTotalClicked: Number(safe.finalTotalClicked ?? safe.final_total_clicked ?? 0) || 0,
    uniqueTotalOpened: Number(safe.uniqueTotalOpened ?? safe.unique_total_opened ?? 0) || 0,
    uniqueTotalClicked: Number(safe.uniqueTotalClicked ?? safe.unique_total_clicked ?? 0) || 0,
    predictedFinalOpenRate: Number(safe.predictedFinalOpenRate ?? safe.predicted_final_open_rate ?? 0) || 0,
    predictedFinalClickRate: Number(safe.predictedFinalClickRate ?? safe.predicted_final_click_rate ?? 0) || 0,
    rawResult: safe.rawResult ?? safe,
  };
}

async function bootstrapWebSocketServer(): Promise<number> {
  const setupUrl = `/api/agent/ws?ts=${Date.now()}`;
  const res = await fetch(setupUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const json = await res.json() as Record<string, unknown>;
  return Number(json.wsPort) || 3001;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recoverLatestAgentResult(expectedBrief: string): Promise<AgentRunResult | null> {
  for (let attempt = 0; attempt < CLOSE_RECOVERY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`/api/agent/run?latest=1&ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.status === 202) {
        await delay(CLOSE_RECOVERY_DELAY_MS);
        continue;
      }

      if (response.ok) {
        const data = (await response.json()) as unknown;
        const normalized = normalizeRunResult(data);
        if (!expectedBrief.trim() || normalized.brief.trim() === expectedBrief.trim()) {
          return normalized;
        }
      }
    } catch {
      // Ignore polling errors during close recovery.
    }

    await delay(CLOSE_RECOVERY_DELAY_MS);
  }

  return null;
}

let preconnectedWs: WebSocket | null = null;
let preconnectPort: number | null = null;

export async function preloadAgentStream(): Promise<void> {
  if (typeof window === "undefined") return;
  if (preconnectedWs) {
    if (preconnectedWs.readyState === WebSocket.OPEN || preconnectedWs.readyState === WebSocket.CONNECTING) {
      return;
    }
  }
  try {
    preconnectPort = await bootstrapWebSocketServer();
    preconnectedWs = new WebSocket(buildWebSocketUrl(preconnectPort));
  } catch (err) {
    console.warn("Failed to preload agent stream", err);
  }
}

export async function streamCampaignAgent(
  brief: string,
  options?: StreamCampaignAgentOptions
): Promise<AgentRunResult> {
  if (typeof window === "undefined") {
    throw new Error("Agent streaming is only available in the browser runtime.");
  }

  const wsPort = preconnectPort ?? (await bootstrapWebSocketServer());

  return new Promise<AgentRunResult>((resolve, reject) => {
    let ws: WebSocket;
    if (preconnectedWs && (preconnectedWs.readyState === WebSocket.OPEN || preconnectedWs.readyState === WebSocket.CONNECTING)) {
      ws = preconnectedWs;
      preconnectedWs = null; // Consume the preloaded socket
    } else {
      ws = new WebSocket(buildWebSocketUrl(wsPort));
    }

    let finished = false;
    let recoveringFromClose = false;
    let opened = ws.readyState === WebSocket.OPEN;
    let abortListener: (() => void) | null = null;

    const cleanupAbortListener = () => {
      if (options?.signal && abortListener) {
        options.signal.removeEventListener("abort", abortListener);
      }
      abortListener = null;
    };

    const buildAbortError = () => {
      const err = new Error("Campaign run aborted.");
      err.name = "AbortError";
      return err;
    };

    const fail = (error: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      cleanupAbortListener();
      try {
        ws.close();
      } catch {
        // Ignore close errors.
      }
      reject(error);
    };

    if (options?.signal?.aborted) {
      fail(buildAbortError());
      return;
    }

    if (options?.signal) {
      abortListener = () => {
        fail(buildAbortError());
      };
      options.signal.addEventListener("abort", abortListener, { once: true });
    }

    const respondToPause = (pause: AgentPausePayload): AgentPauseResponder => {
      return (response) => {
        if (finished || ws.readyState !== WebSocket.OPEN) {
          return;
        }
        ws.send(
          JSON.stringify({
            type: "human_input",
            pauseType: pause.pauseType,
            ...response,
          })
        );
      };
    };

    const startPayload = JSON.stringify({
      type: "start",
      brief,
      rounds: options?.rounds,
      interactive: Boolean(options?.interactive),
    });

    if (opened) {
      ws.send(startPayload);
    } else {
      ws.onopen = () => {
        opened = true;
        ws.send(startPayload);
      };
    }

    ws.onmessage = (messageEvent) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(messageEvent.data));
      } catch {
        return;
      }

      const safe = isRecord(payload) ? payload : {};
      const event = String(safe.event ?? "");
      const data = safe.data;

      if (event === "heartbeat") {
        options?.onHeartbeat?.();
        return;
      }

      if (event === "terminal") {
        options?.onHeartbeat?.();
        const termData = isRecord(data) ? data : {};
        const text = String(termData.text ?? "");
        if (text) {
          options?.onTerminal?.(text);
        }
        return;
      }

      if (event === "thinking") {
        options?.onHeartbeat?.();
        const thinking = isRecord(data) ? data : {};
        options?.onThinking?.({
          agent: String(thinking.agent ?? "Agent"),
          step: String(thinking.step ?? ""),
          kind: thinking.kind ? String(thinking.kind) : undefined,
        });
        return;
      }

      if (event === "pause") {
        options?.onHeartbeat?.();
        const pauseData = isRecord(data) ? data : { pauseType: "segment_approval" };
        const pause: AgentPausePayload = {
          pauseType: String(pauseData.pauseType ?? "segment_approval"),
          title: pauseData.title ? String(pauseData.title) : undefined,
          message: pauseData.message ? String(pauseData.message) : undefined,
          round: Number(pauseData.round ?? 0) || undefined,
          maxRounds: Number(pauseData.maxRounds ?? 0) || undefined,
          ctaLink: pauseData.ctaLink ? String(pauseData.ctaLink) : pauseData.cta_link ? String(pauseData.cta_link) : undefined,
          segments: Array.isArray(pauseData.segments)
            ? (pauseData.segments as AgentPausePayload["segments"])
            : undefined,
          variants: Array.isArray(pauseData.variants)
            ? (pauseData.variants as AgentPausePayload["variants"])
            : undefined,
          metrics: isRecord(pauseData.metrics)
            ? {
                audience: Number(pauseData.metrics.audience ?? 0) || undefined,
                openRate: Number(pauseData.metrics.openRate ?? 0) || undefined,
                clickRate: Number(pauseData.metrics.clickRate ?? 0) || undefined,
                totalOpened: Number(pauseData.metrics.totalOpened ?? pauseData.metrics.total_opened ?? 0) || undefined,
                totalClicked: Number(pauseData.metrics.totalClicked ?? pauseData.metrics.total_clicked ?? 0) || undefined,
                uniqueOpened: Number(pauseData.metrics.uniqueOpened ?? pauseData.metrics.unique_opened ?? 0) || undefined,
                uniqueClicked: Number(pauseData.metrics.uniqueClicked ?? pauseData.metrics.unique_clicked ?? 0) || undefined,
                predictedOpenRate: Number(pauseData.metrics.predictedOpenRate ?? pauseData.metrics.predicted_open_rate ?? 0) || undefined,
                predictedClickRate: Number(pauseData.metrics.predictedClickRate ?? pauseData.metrics.predicted_click_rate ?? 0) || undefined,
              }
            : undefined,
        };
        const respond = respondToPause(pause);
        if (options?.onPause) {
          options.onPause(pause, respond);
        } else if (pause.pauseType === "next_round") {
          respond({ continueOptimization: false });
        } else {
          respond({ approved: true });
        }
        return;
      }

      if (event === "digital_twin") {
        options?.onHeartbeat?.();
        const card = normalizeTwinCard(data);
        if (card) {
          options?.onTwinUpdate?.(card);
        }
        return;
      }

      if (event === "live_metrics") {
        options?.onHeartbeat?.();
        const liveData = isRecord(data) ? data : {};
        options?.onLiveMetrics?.({
          round: Number(liveData.round ?? 0) || 0,
          sent: Number(liveData.sent ?? 0) || 0,
          opened: Number(liveData.opened ?? 0) || 0,
          clicked: Number(liveData.clicked ?? 0) || 0,
          openRate: Number(liveData.openRate ?? 0) || 0,
          clickRate: Number(liveData.clickRate ?? 0) || 0,
          uniqueOpened: Number(liveData.uniqueOpened ?? liveData.unique_opened ?? liveData.opened ?? 0) || 0,
          uniqueClicked: Number(liveData.uniqueClicked ?? liveData.unique_clicked ?? liveData.clicked ?? 0) || 0,
          predictedOpenRate: Number(liveData.predictedOpenRate ?? liveData.predicted_open_rate ?? 0) || 0,
          predictedClickRate: Number(liveData.predictedClickRate ?? liveData.predicted_click_rate ?? 0) || 0,
          bySegment: Array.isArray(liveData.bySegment)
            ? (liveData.bySegment as AgentLiveMetrics["bySegment"])
            : [],
        });
        return;
      }

      if (event === "round_complete") {
        options?.onHeartbeat?.();
        const roundData = isRecord(data) ? data : {};
        options?.onRoundComplete?.({
          round: Number(roundData.round ?? 0) || 0,
          summary: isRecord(roundData.summary)
            ? {
                audience: Number(roundData.summary.audience ?? 0) || 0,
                openRate: Number(roundData.summary.openRate ?? 0) || 0,
                clickRate: Number(roundData.summary.clickRate ?? 0) || 0,
                segments: Number(roundData.summary.segments ?? 0) || 0,
                totalOpened: Number(roundData.summary.totalOpened ?? roundData.summary.total_opened ?? 0) || 0,
                totalClicked: Number(roundData.summary.totalClicked ?? roundData.summary.total_clicked ?? 0) || 0,
                uniqueOpened: Number(roundData.summary.uniqueOpened ?? roundData.summary.unique_opened ?? 0) || 0,
                uniqueClicked: Number(roundData.summary.uniqueClicked ?? roundData.summary.unique_clicked ?? 0) || 0,
                predictedOpenRate: Number(roundData.summary.predictedOpenRate ?? roundData.summary.predicted_open_rate ?? 0) || 0,
                predictedClickRate: Number(roundData.summary.predictedClickRate ?? roundData.summary.predicted_click_rate ?? 0) || 0,
              }
            : {
                audience: 0,
                openRate: 0,
                clickRate: 0,
                segments: 0,
                totalOpened: 0,
                totalClicked: 0,
                uniqueOpened: 0,
                uniqueClicked: 0,
                predictedOpenRate: 0,
                predictedClickRate: 0,
              },
        });
        return;
      }

      if (event === "done") {
        if (finished) {
          return;
        }
        finished = true;
        cleanupAbortListener();
        resolve(normalizeRunResult(data));
        ws.close();
        return;
      }

      if (event === "error") {
        const err = isRecord(data) ? data : {};
        fail(new Error(String(err.message ?? err.error ?? "Agent websocket execution failed.")));
      }
    };

    ws.onerror = () => {
      if (!opened) {
        fail(new Error("WebSocket connection failed for the campaign agent."));
      }
    };

    ws.onclose = () => {
      if (finished || recoveringFromClose) {
        return;
      }

      recoveringFromClose = true;
      void (async () => {
        const recovered = await recoverLatestAgentResult(brief);
        if (recovered) {
          finished = true;
          cleanupAbortListener();
          resolve(recovered);
          return;
        }
        fail(new Error("WebSocket closed before completion."));
      })();
    };
  });
}
