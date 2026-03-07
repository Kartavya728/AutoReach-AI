import { runCampaignLangGraph } from "@/src/lib/server/langgraph";
import { serverCreateCampaign } from "@/src/lib/server/supabase";
import type { GeneratedEmailVariant } from "@/src/lib/types";

/**
 * Campaign generation endpoint with Server-Sent Events (SSE) streaming.
 * Each LangGraph agent step is emitted as an SSE event in real-time,
 * and the final result is sent as a "done" event.
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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        /** Helper: send one SSE event */
        function emit(event: string, data: unknown) {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        }

        try {
          emit("step", { step: "Initialized LangGraph AI targeting workflow.", agent: "Orchestrator" });

          // Run the LangGraph pipeline — steps are accumulated during execution
          const result = await runCampaignLangGraph(brief);

          // Stream each step that the graph accumulated
          for (const s of result.steps || []) {
            emit("step", s);
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
              target_customer_ids: (result as any).targetCustomerIds || [],
              strategy_reasoning: (result as any).strategyReasoning || "",
              json_output: { strategy: result.strategy, strategyReasoning: result.strategyReasoning },
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
          emit("error", { error: "Failed to execute LangGraph workflow", message });
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
      JSON.stringify({ error: "Failed to execute LangGraph workflow", message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
