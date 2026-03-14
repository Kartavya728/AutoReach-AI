"use client";

import { useEffect } from "react";
import { preloadAgentStream } from "../../lib/agent-stream";



export function AgentPreloader() {
  useEffect(() => {
    preloadAgentStream().catch(() => {
      
    });
  }, []);

  return null;
}
