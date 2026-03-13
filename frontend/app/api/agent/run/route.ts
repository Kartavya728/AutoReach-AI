import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { serverCreateCampaign } from "@/src/lib/server/supabase";
import type { GeneratedEmailVariant } from "@/src/lib/types";

export const runtime = "nodejs";

const DEFAULT_OPTIMIZATION_ROUNDS = 2;
const OUTPUT_FILE = "agent_output.json";

type RunPayload = {
  brief?: string;
  campaignName?: string;
  rounds?: number;
};

type UnknownRecord = Record<string, unknown>;
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

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveWorkspaceRoot(): string {
  const cwd = process.cwd();
  const cwdHasAgents = fs.existsSync(path.join(cwd, "backend", "main.py"));
  if (cwdHasAgents) {
    return cwd;
  }

  const parent = path.resolve(cwd, "..");
  const parentHasAgents = fs.existsSync(path.join(parent, "backend", "main.py"));
  if (parentHasAgents) {
    return parent;
  }

  throw new Error("Could not locate backend/main.py from current Next.js runtime path.");
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
  const tags = Array.isArray(safe.tags) ? safe.tags.map((tag) => String(tag)) : [];

  return {
    subject: String(safe.subject ?? fallbackLabel),
    body: String(safe.body ?? ""),
    variant: String(safe.variant ?? fallbackLabel),
    tone: String(safe.tone ?? "professional"),
    tags,
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RunPayload;
    const brief = payload.brief?.trim();
    if (!brief) {
      return new Response(
        JSON.stringify({ error: "Missing required field: brief" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const workspaceRoot = resolveWorkspaceRoot();
    const outputPath = path.join(workspaceRoot, OUTPUT_FILE);
    const agentProcessEnv = buildAgentProcessEnv(workspaceRoot);

    let pythonProcess: ReturnType<typeof spawn> | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

        const emit = (event: string, data: unknown) => {
          if (closed) {
            return;
          }
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            // Stream likely already closed by client disconnect.
          }
        };

        const closeStream = () => {
          if (closed) {
            return;
          }
          closed = true;
          controller.close();
        };

        try {
          await fsp.rm(outputPath, { force: true });

          const requestedRounds = Number(payload.rounds);
          const rounds =
            Number.isFinite(requestedRounds) && requestedRounds > 0
              ? Math.floor(requestedRounds)
              : DEFAULT_OPTIMIZATION_ROUNDS;

          const pythonBin = process.env.PYTHON_BIN || "python";
          const args = ["-u", "-m", "backend.main", brief, "--rounds", String(rounds)];

          const startText = `Starting agents pipeline with ${rounds} optimization rounds...\n`;
          for (const char of startText) {
            emit("terminal", { char, stream: "system" });
          }

          pythonProcess = spawn(pythonBin, args, {
            cwd: workspaceRoot,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
            env: agentProcessEnv,
          });

          if (!pythonProcess.stdout || !pythonProcess.stderr) {
            emit("error", {
              error: "Agents process streams unavailable",
              message: "Could not attach to stdout/stderr for live terminal streaming.",
            });
            closeStream();
            return;
          }

          const forwardChunkAsChars = (chunk: Buffer | string, stream: "stdout" | "stderr") => {
            const text = Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk);
            for (const char of text) {
              emit("terminal", { char, stream });
            }
          };

          pythonProcess.stdout.on("data", (chunk) => {
            forwardChunkAsChars(chunk, "stdout");
          });

          pythonProcess.stderr.on("data", (chunk) => {
            forwardChunkAsChars(chunk, "stderr");
          });

          pythonProcess.once("error", (error) => {
            emit("error", {
              error: "Failed to start agents process",
              message: error instanceof Error ? error.message : String(error),
            });
            closeStream();
          });

          pythonProcess.once("close", async (code) => {
            if (closed) {
              return;
            }

            if (code !== 0) {
              emit("error", {
                error: "Agents pipeline exited with failure",
                message: `Process exited with code ${code ?? "unknown"}`,
              });
              closeStream();
              return;
            }

            try {
              const rawText = await fsp.readFile(outputPath, "utf-8");
              const parsed = JSON.parse(rawText) as unknown;
              const finalPayload = toFinalPayload(parsed, brief);

              let savedCampaign: { id: string } | null = null;
              try {
                const variants = finalPayload.contentVariants.map((v, i) => ({
                  variant_label: v.variant || String.fromCharCode(65 + i),
                  subject: v.subject || `Variant ${String.fromCharCode(65 + i)}`,
                  body: v.body || "",
                  tone: v.tone || "professional",
                  tags: v.tags || [],
                  is_selected: i === 0,
                }));

                savedCampaign = await serverCreateCampaign({
                  name: payload.campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
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
              } catch (err) {
                console.warn("[Agent] Failed to save campaign to Supabase:", err);
              }

              emit("done", {
                ...finalPayload,
                savedCampaignId: savedCampaign?.id ?? null,
              });
              closeStream();
            } catch (error) {
              emit("error", {
                error: "Failed to parse agents final output",
                message: error instanceof Error ? error.message : "Unknown parsing failure",
              });
              closeStream();
            }
          });
        } catch (error) {
          emit("error", {
            error: "Failed to execute agents pipeline",
            message: error instanceof Error ? error.message : "Unknown error",
          });
          closeStream();
        }
      },
      cancel() {
        if (pythonProcess && !pythonProcess.killed) {
          pythonProcess.kill();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to execute agents pipeline", message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("latest") !== "1") {
      return new Response(
        JSON.stringify({ error: "Missing required query parameter: latest=1" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const workspaceRoot = resolveWorkspaceRoot();
    const outputPath = path.join(workspaceRoot, OUTPUT_FILE);

    if (!fs.existsSync(outputPath)) {
      return new Response(
        JSON.stringify({ status: "pending", message: "Agent output not available yet" }),
        { status: 202, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }

    const rawText = await fsp.readFile(outputPath, "utf-8");
    const parsed = JSON.parse(rawText) as unknown;
    const fallbackBrief = isRecord(parsed) ? String(parsed.brief ?? "") : "";
    const finalPayload = toFinalPayload(parsed, fallbackBrief);

    return new Response(JSON.stringify(finalPayload), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to read latest agent output", message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
