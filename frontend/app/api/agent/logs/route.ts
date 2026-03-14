import { getServerConfig } from "@/src/lib/server/env";



export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session");

    if (!sessionId) {
        return new Response(
            JSON.stringify({ error: "Missing required query parameter: session" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const config = getServerConfig();
    const pythonUrl = config.pythonAgentUrl;

    try {
        const upstream = await fetch(`${pythonUrl}/agent_logs/${sessionId}`);

        if (!upstream.ok) {
            return new Response(
                JSON.stringify({ error: "Failed to connect to Python agent log stream" }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!upstream.body) {
            return new Response(
                JSON.stringify({ error: "No log stream available" }),
                { status: 204, headers: { "Content-Type": "application/json" } }
            );
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const transform = new TransformStream({
            transform(chunk, controller) {
                const text = decoder.decode(chunk, { stream: true });

                
                const messages = text.split("\n\n");
                for (const msg of messages) {
                    if (!msg.trim()) continue;

                    const eventMatch = msg.match(/^event:\s*(.+)$/m);
                    const dataMatch = msg.match(/^data:\s*(.+)$/m);
                    if (!dataMatch) continue;

                    const eventType = eventMatch?.[1]?.trim() ?? "step";

                    if (eventType === "done") {
                        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
                        continue;
                    }

                    try {
                        const entry = JSON.parse(dataMatch[1]);
                        
                        const frontendEvent = {
                            step: entry.action || entry.thought || "",
                            agent: entry.agent || "Agent",
                        };
                        controller.enqueue(
                            encoder.encode(`event: step\ndata: ${JSON.stringify(frontendEvent)}\n\n`)
                        );
                    } catch {
                        
                        controller.enqueue(encoder.encode(msg + "\n\n"));
                    }
                }
            },
        });

        const transformed = upstream.body.pipeThrough(transform);

        return new Response(transformed, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: "Failed to proxy agent logs", message }),
            { status: 502, headers: { "Content-Type": "application/json" } }
        );
    }
}
