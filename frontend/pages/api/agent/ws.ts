import type { NextApiRequest, NextApiResponse } from "next";
import { createServer, type Server as HTTPServer } from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import { serverCreateCampaign } from "@/src/lib/server/supabase";
import type { GeneratedEmailVariant } from "@/src/lib/types";

export const config = {
  api: {
    bodyParser: false,
  },
};

const DEFAULT_OPTIMIZATION_ROUNDS = 10;
const OUTPUT_FILE = "agent_output.json";
const CONTROL_PREFIX = "__AGENT_EVENT__";
const CLIENT_DISCONNECT_KILL_DELAY_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 5_000;
const WS_PORT = 3001;

const AGENT_ENV_PASSTHROUGH_KEYS = [
  "PATH",
  "PATHEXT",
  "ComSpec",
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "PROCESSOR_IDENTIFIER",
  "OS",
  "HOME",
  "AGENTS_TEST_MODE",
  "PYTHON_BIN",
] as const;

type UnknownRecord = Record<string, unknown>;


const globalAny = global as any;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendEvent(ws: WebSocket, event: string, data: unknown) {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify({ event, data }));
}

function parseControlEnvelope(line: string): { event: string; data: unknown } | null {
  if (!line.startsWith(CONTROL_PREFIX)) {
    return null;
  }

  const payload = line.slice(CONTROL_PREFIX.length).trim();
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    const event = String(parsed.event ?? "");
    if (!event) {
      return null;
    }
    return {
      event,
      data: parsed.data,
    };
  } catch {
    return null;
  }
}

function resolveWorkspaceRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "backend", "main.py"))) {
    return cwd;
  }

  const parent = path.resolve(cwd, "..");
  if (fs.existsSync(path.join(parent, "backend", "main.py"))) {
    return parent;
  }

  throw new Error("Could not locate backend/main.py from current runtime path.");
}

function parseDotEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadAgentsEnv(workspaceRoot: string): Record<string, string> {
  const envPath = path.join(workspaceRoot, ".env");
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, "utf-8");
  const envMap: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const clean = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIndex = clean.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = clean.slice(0, eqIndex).trim();
    const value = parseDotEnvValue(clean.slice(eqIndex + 1));
    if (!key) {
      continue;
    }
    envMap[key] = value;
  }

  return envMap;
}

function buildAgentProcessEnv(workspaceRoot: string): NodeJS.ProcessEnv {
  const passthrough: Record<string, string> = {};
  for (const key of AGENT_ENV_PASSTHROUGH_KEYS) {
    const value = process.env[key];
    if (value) {
      passthrough[key] = value;
    }
  }

  const agentsEnv = loadAgentsEnv(workspaceRoot);

  return {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    ...passthrough,
    ...agentsEnv,
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    LANGCHAIN_TRACING_V2: "false",
    LANGSMITH_TRACING: "false",
  } as NodeJS.ProcessEnv;
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
      toVariant(item, `Variant ${String.fromCharCode(65 + index)}`)
    );
  }

  if (Array.isArray(raw.content_variants)) {
    return raw.content_variants.map((item, index) =>
      toVariant(item, `Variant ${String.fromCharCode(65 + index)}`)
    );
  }

  if (isRecord(raw.segment_variants)) {
    return Object.entries(raw.segment_variants).map(([segmentId, variant], index) =>
      toVariant(variant, segmentId || `Variant ${String.fromCharCode(65 + index)}`)
    );
  }

  return [];
}

function toFinalPayload(raw: unknown, fallbackBrief: string) {
  const safe = isRecord(raw) ? raw : {};

  const targetCustomerIds = Array.isArray(safe.targetCustomerIds)
    ? safe.targetCustomerIds.map((id) => String(id))
    : Array.isArray(safe.target_customer_ids)
      ? safe.target_customer_ids.map((id) => String(id))
      : [];

  const customerCount =
    Number(safe.customerCount ?? safe.customer_count ?? 0) || targetCustomerIds.length;

  return {
    brief: String(safe.brief ?? fallbackBrief),
    ctaLink: String(safe.cta_link ?? safe.ctaLink ?? ""),
    strategy: String(safe.strategy ?? ""),
    strategyReasoning: String(safe.strategyReasoning ?? safe.strategy_reasoning ?? ""),
    targetCustomerIds,
    contentVariants: normalizeVariants(safe),
    customerCount,
    campaignReady: true,
    steps: Array.isArray(safe.steps) ? safe.steps : [],
    segments: Array.isArray(safe.segments) ? safe.segments : [],
    metricsProgression: Array.isArray(safe.metrics_progression)
      ? safe.metrics_progression
      : Array.isArray(safe.metricsProgression)
        ? safe.metricsProgression
        : [],
    finalOpenRate: Number(safe.final_open_rate ?? safe.finalOpenRate ?? 0) || 0,
    finalClickRate: Number(safe.final_click_rate ?? safe.finalClickRate ?? 0) || 0,
    finalTotalOpened: Number(safe.final_total_opened ?? safe.finalTotalOpened ?? 0) || 0,
    finalTotalClicked: Number(safe.final_total_clicked ?? safe.finalTotalClicked ?? 0) || 0,
    uniqueTotalOpened: Number(safe.unique_total_opened ?? safe.uniqueTotalOpened ?? 0) || 0,
    uniqueTotalClicked: Number(safe.unique_total_clicked ?? safe.uniqueTotalClicked ?? 0) || 0,
    predictedFinalOpenRate: Number(safe.predicted_final_open_rate ?? safe.predictedFinalOpenRate ?? 0) || 0,
    predictedFinalClickRate: Number(safe.predicted_final_click_rate ?? safe.predictedFinalClickRate ?? 0) || 0,
    rawResult: safe,
  };
}

async function persistCampaignResult(
  finalPayload: ReturnType<typeof toFinalPayload>,
  brief: string,
  campaignName?: string
) {
  const variants = finalPayload.contentVariants.map((v, i) => ({
    variant_label: v.variant || String.fromCharCode(65 + i),
    subject: v.subject || `Variant ${String.fromCharCode(65 + i)}`,
    body: v.body || "",
    tone: v.tone || "professional",
    tags: v.tags || [],
    is_selected: i === 0,
  }));

  return serverCreateCampaign({
    name: campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
    brief,
    subject: variants[0]?.subject || "",
    body: variants[0]?.body || "",
    target_segment: "all",
    target_customer_ids: finalPayload.targetCustomerIds,
    strategy_reasoning: finalPayload.strategyReasoning,
    json_output: {
      ctaLink: finalPayload.ctaLink,
      strategy: finalPayload.strategy,
      strategyReasoning: finalPayload.strategyReasoning,
      segments: finalPayload.segments,
      metricsProgression: finalPayload.metricsProgression,
      finalOpenRate: finalPayload.finalOpenRate,
      finalClickRate: finalPayload.finalClickRate,
      finalTotalOpened: finalPayload.finalTotalOpened,
      finalTotalClicked: finalPayload.finalTotalClicked,
      uniqueTotalOpened: finalPayload.uniqueTotalOpened,
      uniqueTotalClicked: finalPayload.uniqueTotalClicked,
      predictedFinalOpenRate: finalPayload.predictedFinalOpenRate,
      predictedFinalClickRate: finalPayload.predictedFinalClickRate,
      rawResult: finalPayload.rawResult,
    },
    total_customers: finalPayload.customerCount,
    temperature: 0.7,
    use_emojis: true,
    tone: "friendly",
    variants,
  });
}

function handleConnection(ws: WebSocket) {
  let pythonProcess: ReturnType<typeof spawn> | null = null;
  let started = false;
  let stderrBuffer = "";
  let processCompleted = false;
  let disconnectKillTimer: NodeJS.Timeout | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let stderrTranscript = "";
  let errorSent = false;

  const sendError = (payload: UnknownRecord) => {
    errorSent = true;
    sendEvent(ws, "error", payload);
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  ws.on("close", () => {
    stopHeartbeat();
    if (processCompleted || !pythonProcess || pythonProcess.killed || disconnectKillTimer) {
      return;
    }
    disconnectKillTimer = setTimeout(() => {
      if (pythonProcess && !pythonProcess.killed && !processCompleted) {
        pythonProcess.kill();
      }
      disconnectKillTimer = null;
    }, CLIENT_DISCONNECT_KILL_DELAY_MS);
  });

  ws.on("message", (raw) => {
    let message: UnknownRecord;
    try {
      const parsed = JSON.parse(raw.toString("utf-8")) as unknown;
      message = isRecord(parsed) ? parsed : {};
    } catch {
      sendError({ error: "Invalid JSON payload" });
      return;
    }

    const messageType = String(message.type ?? "");

    if (messageType === "human_input") {
      if (!started || !pythonProcess || pythonProcess.killed || !pythonProcess.stdin) {
        return;
      }
      try {
        pythonProcess.stdin.write(`${JSON.stringify(message)}\n`);
      } catch (err) {
        sendError({
          error: "Failed to forward human input",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (messageType !== "start") {
      return;
    }

    if (started) {
      return;
    }

    started = true;

    void (async () => {
      const brief = String(message.brief ?? "").trim();
      if (!brief) {
        sendError({ error: "Missing required field: brief" });
        return;
      }

      const workspaceRoot = resolveWorkspaceRoot();
      const outputPath = path.join(workspaceRoot, OUTPUT_FILE);
      const env = buildAgentProcessEnv(workspaceRoot);

      await fsp.rm(outputPath, { force: true });

      const requestedRounds = Number(message.rounds);
      const rounds =
        Number.isFinite(requestedRounds) && requestedRounds > 0
          ? Math.floor(requestedRounds)
          : DEFAULT_OPTIMIZATION_ROUNDS;
      const interactive = Boolean(message.interactive);

      const pythonBin = env.PYTHON_BIN || "python";
      const args = ["-u", "-m", "backend.main", brief, "--rounds", String(rounds)];
      if (interactive) {
        args.push("--interactive");
      }

      sendEvent(ws, "thinking", {
        agent: "Orchestrator",
        step: interactive
          ? `Starting agents pipeline with up to ${rounds} optimization rounds.`
          : "Starting agents pipeline.",
        kind: "status",
      });

      pythonProcess = spawn(pythonBin, args, {
        cwd: workspaceRoot,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env,
      });

      if (!pythonProcess.stdout || !pythonProcess.stderr || !pythonProcess.stdin) {
        sendError({
          error: "Agents process streams unavailable",
          message: "Could not attach to stdin/stdout/stderr for interactive streaming.",
        });
        return;
      }

      heartbeatTimer = setInterval(() => {
        sendEvent(ws, "heartbeat", { ts: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);

      pythonProcess.stdout.on("data", (chunk) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk);
        sendEvent(ws, "terminal", { text });
      });

      pythonProcess.stderr.on("data", (chunk) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk);
        stderrBuffer += text;

        let newlineIndex = stderrBuffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const rawLine = stderrBuffer.slice(0, newlineIndex);
          stderrBuffer = stderrBuffer.slice(newlineIndex + 1);

          const normalized = rawLine.replace(/\r$/, "");
          const control = parseControlEnvelope(normalized);
          if (control) {
            if (control.event === "error") {
              errorSent = true;
            }
            sendEvent(ws, control.event, control.data);
          } else if (normalized.trim()) {
            stderrTranscript = `${stderrTranscript}${normalized}\n`.slice(-16_000);
            console.error("[Agent WS stderr]", normalized);
          }

          newlineIndex = stderrBuffer.indexOf("\n");
        }
      });

      pythonProcess.once("error", (error) => {
        stopHeartbeat();
        sendError({
          error: "Failed to start agents process",
          message: error instanceof Error ? error.message : String(error),
        });
      });

      pythonProcess.once("close", async (code) => {
        processCompleted = true;
        stopHeartbeat();
        if (disconnectKillTimer) {
          clearTimeout(disconnectKillTimer);
          disconnectKillTimer = null;
        }

        if (stderrBuffer) {
          const normalizedBuffer = stderrBuffer.replace(/\r$/, "");
          const control = parseControlEnvelope(normalizedBuffer);
          if (control) {
            if (control.event === "error") {
              errorSent = true;
            }
            sendEvent(ws, control.event, control.data);
          } else if (normalizedBuffer.trim()) {
            stderrTranscript = `${stderrTranscript}${normalizedBuffer}\n`.slice(-16_000);
            console.error("[Agent WS stderr]", normalizedBuffer);
          }
          stderrBuffer = "";
        }

        if (code !== 0) {
          if (!errorSent) {
            sendError({
              error: "Agents pipeline exited with failure",
              message: stderrTranscript.trim()
                ? `Process exited with code ${code ?? "unknown"}\n${stderrTranscript.trim()}`
                : `Process exited with code ${code ?? "unknown"}`,
            });
          }
          return;
        }

        try {
          const rawText = await fsp.readFile(outputPath, "utf-8");
          const parsed = JSON.parse(rawText) as unknown;
          const finalPayload = toFinalPayload(parsed, brief);

          let savedCampaign: { id: string } | null = null;
          try {
            savedCampaign = await persistCampaignResult(
              finalPayload,
              brief,
              typeof message.campaignName === "string" ? message.campaignName : undefined
            );
        } catch (err) {
          console.warn("[Agent WS] Failed to save campaign to Supabase:", err);
        }

        sendEvent(ws, "done", {
            ...finalPayload,
            savedCampaignId: savedCampaign?.id ?? null,
          });
        } catch (error) {
          sendError({
            error: "Failed to parse agents final output",
            message: error instanceof Error ? error.message : "Unknown parsing failure",
          });
        }
      });
    })();
  });
}

function ensureStandaloneServer(): Promise<number> {
  if (globalAny.__wsServerReady && globalAny.__wsStandaloneServer) {
    return Promise.resolve(WS_PORT);
  }

  return new Promise((resolve, reject) => {
    if (globalAny.__wsStandaloneWss) {
      resolve(WS_PORT);
      return;
    }

    const httpServer = createServer((_req, res) => {
      
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ ok: true, wsPort: WS_PORT }));
    });

    const wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws) => {
      console.log("[Agent WS] New client connected");
      handleConnection(ws);
    });

    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        
        console.log(`[Agent WS] Port ${WS_PORT} already in use, reusing existing server`);
        globalAny.__wsServerReady = true;
        resolve(WS_PORT);
        return;
      }
      reject(err);
    });

    httpServer.listen(WS_PORT, () => {
      console.log(`[Agent WS] Standalone WebSocket server listening on port ${WS_PORT}`);
      globalAny.__wsStandaloneServer = httpServer;
      globalAny.__wsStandaloneWss = wss;
      globalAny.__wsServerReady = true;
      resolve(WS_PORT);
    });
  });
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const port = await ensureStandaloneServer();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.status(200).json({ ok: true, wsPort: port });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to start WebSocket server", message });
  }
}
