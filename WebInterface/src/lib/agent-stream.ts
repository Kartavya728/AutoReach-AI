import type {
  AgentLiveMetrics,
  AgentPausePayload,
  AgentRoundComplete,
  AgentRunResult,
  AgentThinkingStep,
  GeneratedEmailVariant,
} from "@/src/lib/types";

type UnknownRecord = Record<string, unknown>;

export type AgentPauseResponder = (response: Record<string, unknown>) => void;

export interface StreamCampaignAgentOptions {
  rounds?: number;
  onHeartbeat?: () => void;
  onThinking?: (step: AgentThinkingStep) => void;
  onPause?: (pause: AgentPausePayload, respond: AgentPauseResponder) => void;
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
    };
  });
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

    const fail = (error: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      try {
        ws.close();
      } catch {
        // Ignore close errors.
      }
      reject(error);
    };

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
              }
            : {
                audience: 0,
                openRate: 0,
                clickRate: 0,
                segments: 0,
              },
        });
        return;
      }

      if (event === "done") {
        if (finished) {
          return;
        }
        finished = true;
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
          resolve(recovered);
          return;
        }
        fail(new Error("WebSocket closed before completion."));
      })();
    };
  });
}
