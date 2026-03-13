"use client";

import { useEffect } from "react";
import { preloadAgentStream } from "../../lib/agent-stream";

/**
 * Invisible component that preconnects the WebSocket to the agent server
 * as soon as any page loads — not just when the user submits a prompt.
 */
export function AgentPreloader() {
  useEffect(() => {
    preloadAgentStream().catch(() => {
      // Silently ignore — the connection will be retried when needed.
    });
  }, []);

  return null;
}
