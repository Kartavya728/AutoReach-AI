// Quick WebSocket connectivity test — connects to standalone WS server
import WebSocket from "ws";

const BOOTSTRAP_URL = "http://localhost:3000/api/agent/ws";

// Step 1: Bootstrap — start the standalone WS server and get port
console.log("[1] Bootstrapping WS server...");
let wsPort = 3001;
try {
  const res = await fetch(`${BOOTSTRAP_URL}?ts=${Date.now()}`);
  const json = await res.json();
  console.log("[1] Bootstrap response:", json);
  wsPort = json.wsPort || 3001;
} catch (err) {
  console.error("[1] Bootstrap failed:", err.message);
  process.exit(1);
}

// Step 2: Connect to standalone WS server
const WS_URL = `ws://localhost:${wsPort}`;
console.log("[2] Connecting to", WS_URL);
const ws = new WebSocket(WS_URL);

let messageCount = 0;
const timeout = setTimeout(() => {
  console.error("[TIMEOUT] No done/error after 90s. Closing.");
  ws.close();
  process.exit(1);
}, 90_000);

ws.on("open", () => {
  console.log("[2] ✓ WebSocket OPEN — sending start command");
  ws.send(JSON.stringify({
    type: "start",
    brief: "Test campaign brief for WebSocket verification",
    rounds: 1,
  }));
});

ws.on("message", (raw) => {
  const text = raw.toString("utf-8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.log("[MSG] raw:", text.slice(0, 200));
    return;
  }

  messageCount++;
  const event = parsed.event || "unknown";

  if (event === "terminal") {
    const t = parsed.data?.text || "";
    process.stdout.write(t);
    return;
  }

  if (event === "heartbeat") {
    return;
  }

  if (event === "thinking") {
    const d = parsed.data || {};
    console.log(`\n[THINKING] ${d.agent}: ${d.step} (${d.kind})`);
    return;
  }

  if (event === "pause") {
    const d = parsed.data || {};
    console.log(`\n[PAUSE] ${d.pauseType}: ${d.title}`);
    const response = d.pauseType === "next_round"
      ? { type: "human_input", pauseType: d.pauseType, continueOptimization: false }
      : { type: "human_input", pauseType: d.pauseType, approved: true };
    console.log("[PAUSE] Auto-responding:", JSON.stringify(response));
    ws.send(JSON.stringify(response));
    return;
  }

  if (event === "live_metrics") {
    const d = parsed.data || {};
    console.log(`\n[METRICS] Round ${d.round}: sent=${d.sent} open=${d.openRate}% click=${d.clickRate}%`);
    return;
  }

  if (event === "round_complete") {
    const d = parsed.data || {};
    console.log(`\n[ROUND] ${d.round} complete:`, JSON.stringify(d.summary));
    return;
  }

  if (event === "done") {
    console.log("\n\n[DONE] ✓ Agent finished! Messages received:", messageCount);
    const d = parsed.data || {};
    console.log("  Campaign ID:", d.savedCampaignId);
    console.log("  Open rate:", d.finalOpenRate);
    console.log("  Click rate:", d.finalClickRate);
    clearTimeout(timeout);
    ws.close();
    process.exit(0);
  }

  if (event === "error") {
    console.error("\n[ERROR]", JSON.stringify(parsed.data));
    clearTimeout(timeout);
    ws.close();
    process.exit(1);
  }

  console.log(`[${event}]`, JSON.stringify(parsed.data).slice(0, 300));
});

ws.on("error", (err) => {
  console.error("[WS ERROR]", err.message);
  clearTimeout(timeout);
  process.exit(1);
});

ws.on("close", (code, reason) => {
  console.log(`\n[WS CLOSED] code=${code} reason=${reason?.toString() || ""}`);
  clearTimeout(timeout);
});
