import { getServerConfig } from "@/src/lib/server/env";
import { serverCreateCampaign } from "@/src/lib/server/supabase";
import type { GeneratedEmailVariant } from "@/src/lib/types";

/**
 * Campaign generation endpoint — proxies to the Python FastAPI agent service.
 *
 * The Python service runs the full multi-agent pipeline (segmentation, war room,
 * twin simulation, bandit selection, etc.) and returns structured results.
 *
 * This route:
 *   1. Starts the Python pipeline (POST /run_campaign)
 *   2. Simultaneously streams logs from the Python service (GET /agent_logs/{sessionId})
 *   3. Emits SSE events to the frontend in the same format as before
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { brief?: string; campaignName?: string };
    const brief = payload.brief?.trim();
    if (!brief) {
      return new Response(
        JSON.stringify({ error: "Missing required field: brief" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const config = getServerConfig();
    const pythonUrl = config.pythonAgentUrl;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        /** Helper: send one SSE event */
        function emit(event: string, data: unknown) {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        }

        try {
          emit("step", { step: "Connecting to Python Agent Engine...", agent: "Orchestrator" });

          // Call the Python FastAPI service (now returns an SSE stream)
          const response = await fetch(`${pythonUrl}/run_campaign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brief, campaignName: payload.campaignName }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            emit("error", { error: "Python agent service failed", message: errorText });
            controller.close();
            return;
          }

          if (!response.body) {
            emit("error", { error: "Python agent service returned empty body" });
            controller.close();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let logBuffer = "";
          let result: any = null;

          // Process the SSE stream from Python
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            logBuffer += decoder.decode(value, { stream: true });
            const messages = logBuffer.split("\n\n");
            logBuffer = messages.pop() ?? "";

            for (const msg of messages) {
              if (!msg.trim()) continue;

              const eventMatch = msg.match(/^event:\s*(.+)$/m);
              const dataMatch = msg.match(/^data:\s*(.+)$/m);
              if (!dataMatch) continue;

              const eventType = eventMatch?.[1]?.trim() ?? "step";

              if (eventType === "done") {
                console.log("[Route.ts] Stream finished.");
                break;
              } else if (eventType === "result") {
                try {
                  result = JSON.parse(dataMatch[1]);
                } catch {
                  // ignore parse error of result
                }
              } else if (eventType === "error") {
                try {
                  const errEntry = JSON.parse(dataMatch[1]);
                  emit("error", errEntry);
                } catch { }
              } else {
                // eventType === "step" or other
                try {
                  const logEntry = JSON.parse(dataMatch[1]);
                  console.log(`[Route.ts] Received Step from ${logEntry.agent || 'Agent'}: ${logEntry.action || logEntry.thought || logEntry.step || ''}`);
                  emit("step", {
                    step: logEntry.action || logEntry.thought || logEntry.step || "",
                    agent: logEntry.agent || "Agent",
                  });
                } catch { }
              }
            }
          }

          if (!result) {
            emit("error", { error: "Python pipeline ended without returning a result payload." });
            controller.close();
            return;
          }

          const contentVariants = (result.contentVariants || []) as GeneratedEmailVariant[];

          // Save campaign to Supabase
          let savedCampaign = null;
          try {
            const variants = contentVariants.map((v, i) => ({
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
              target_customer_ids: result.targetCustomerIds || [],
              strategy_reasoning: result.strategyReasoning || "",
              json_output: {
                strategy: result.strategy,
                strategyReasoning: result.strategyReasoning,
                segments: result.segments,
                banditSelections: result.banditSelections,
                twinResults: result.twinResults,
              },
              total_customers: Number(result.customerCount) || 0,
              temperature: 0.7,
              use_emojis: true,
              tone: "friendly",
              variants,
            });
          } catch (err) {
            console.warn("[Agent] Failed to save campaign to Supabase:", err);
          }

          // Final result event
          emit("done", {
            ...result,
            savedCampaignId: savedCampaign?.id ?? null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          emit("error", { error: "Failed to execute Python agent pipeline", message });
        } finally {
          controller.close();
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
      JSON.stringify({ error: "Failed to execute Python agent pipeline", message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
