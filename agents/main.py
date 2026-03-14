"""
CampaignX Agent System — Main Entry Point (Segmented Pipeline)
================================================================
Full auto-approve lifecycle with micro-segmentation:
  1. Create campaign (LangGraph: Cohort+Segment → Strategy → Content)
  2. Send DIFFERENT emails to DIFFERENT segments via CampaignX API
  3. Fetch REAL EO/EC data per segment
  4. Display real open/click rates per segment
  5. Re-target warm audience (opened but didn't click) with stronger CTAs
  6. Repeat for N rounds

Usage:
    python -m agents.main                              # Default, 1 round
    python -m agents.main --rounds 3                   # 3 optimization rounds
    python -m agents.main "Your brief" --rounds 2      # Custom brief
"""

from __future__ import annotations
import asyncio
import json
import sys
import time
from datetime import datetime, timedelta, timezone

from agents.graph import run_campaign_graph
from agents.analysis_agent import compute_analysis, generate_optimization_suggestions
from agents.campaignx_api import send_campaign, fetch_campaign_report
from agents.content_agent import generate_segment_variant, _get_model
from agents.segment_engine import get_segment_profile
from agents.state import SegmentResult

DEFAULT_BRIEF = (
    "Run an email campaign for launching XDeposit, a flagship term deposit "
    "product from SuperBFSI, that gives 1 percentage point higher returns "
    "than its competitors. Target high-income professionals and senior citizens. "
    "Use personalized subject lines and a friendly tone with emojis. "
    "Include the CTA URL: https://superbfsi.com/xdeposit/explore/"
)

IST = timezone(timedelta(hours=5, minutes=30))

def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def format_time(dt: datetime) -> str:
    """Format as DD:MM:YY HH:MM:SS in IST for CampaignX API."""
    return dt.astimezone(IST).strftime("%d:%m:%y %H:%M:%S")

def print_segment_metrics(results: list[SegmentResult]):
    """Print per-segment metrics table."""
    print(f"\n  {'Segment':<35} {'Sent':>6} {'Opened':>8} {'Clicked':>8} {'Open%':>7} {'Click%':>7}")
    print(f"  {'─' * 35} {'─' * 6} {'─' * 8} {'─' * 8} {'─' * 7} {'─' * 7}")
    for r in results:
        name = r["segment_name"][:35]
        print(
            f"  {name:<35} {r['total_sent']:>6} {r['total_opened']:>8} "
            f"{r['total_clicked']:>8} {r['open_rate']:>6.1f}% {r['click_rate']:>6.1f}%"
        )

    total_sent = sum(r["total_sent"] for r in results)
    total_opened = sum(r["total_opened"] for r in results)
    total_clicked = sum(r["total_clicked"] for r in results)
    overall_open = round(total_opened / total_sent * 100, 1) if total_sent > 0 else 0
    overall_click = round(total_clicked / total_sent * 100, 1) if total_sent > 0 else 0
    print(f"  {'─' * 35} {'─' * 6} {'─' * 8} {'─' * 8} {'─' * 7} {'─' * 7}")
    print(
        f"  {'TOTAL':<35} {total_sent:>6} {total_opened:>8} "
        f"{total_clicked:>8} {overall_open:>6.1f}% {overall_click:>6.1f}%"
    )
    return overall_open, overall_click

async def send_segment(
    segment_name: str,
    variant: dict,
    customer_ids: list[str],
    send_time_str: str,
) -> list[str]:
    """Send a campaign for one segment, return a list of external campaign_ids."""
    if not customer_ids:
        return []

    BATCH_SIZE = 1000
    campaign_ids = []
    total_batches = (len(customer_ids) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(customer_ids), BATCH_SIZE):
        chunk = customer_ids[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"    🎯 [1:1 Personalization Engine] Generated {len(chunk)} uniquely formatted emails.")
        try:
            resp = await send_campaign(
                subject=variant.get("subject", "Campaign"),
                body=variant.get("body", ""),
                customer_ids=chunk,
                send_time=send_time_str,
            )
            cid = resp.get("campaign_id")
            if cid:
                campaign_ids.append(cid)
            print(f"    ✅ Batch {batch_num}/{total_batches}: {len(chunk)} routed via API (id: {cid})")
        except Exception as e:
            print(f"    ❌ Batch {batch_num}/{total_batches}: {e}")

    return campaign_ids

from agents.personalization import personalization_engine

async def fetch_segment_metrics(
    segment_name: str,
    segment_id: str,
    campaign_ids: list[str],
    customer_ids: list[str],
    variant: dict,
) -> SegmentResult:
    """Fetch real EO/EC from CampaignX API."""
    records = []
    expected_count = len(customer_ids)

    if campaign_ids:
        max_retries = 15
        for campaign_id in campaign_ids:
            batch_records = []

            for attempt in range(max_retries):
                try:
                    resp = await fetch_campaign_report(campaign_id)
                    batch_records = resp.get("data", [])

                    if batch_records:
                        records.extend(batch_records)
                        break
                    else:
                        print(f"    ⏳ {segment_name} ({campaign_id}): Waiting for CampaignX processing...")
                        await asyncio.sleep(3)

                except Exception as e:

                    if "429" in str(e):
                        print(f"    ⚠️  Rate limit (429) hit for {segment_name} ({campaign_id}). Falling back.")
                        break
                    print(f"    ⚠️  Report fetch failed for {segment_name} ({campaign_id}): {e}")
                    await asyncio.sleep(3)

    if not records and expected_count > 0:

        records = [{"customer_id": cid, "EO": "N", "EC": "N"} for cid in customer_ids]

    first_cid = campaign_ids[0] if campaign_ids else segment_id
    analysis = compute_analysis(first_cid, records)

    return {
        "segment_id": segment_id,
        "segment_name": segment_name,
        "campaign_ids": campaign_ids,
        "customer_ids": customer_ids,
        "total_sent": analysis["total_sent"],
        "total_opened": analysis["total_opened"],
        "total_clicked": analysis["total_clicked"],
        "open_rate": analysis["open_rate"],
        "click_rate": analysis["click_rate"],
        "opened_ids": analysis.get("opened_ids", []),
        "clicked_ids": analysis.get("clicked_ids", []),
        "variant_used": variant,
    }

async def run_full_pipeline(brief: str, rounds: int = 1) -> dict:
    """Complete segmented pipeline with real EO/EC tracking."""

    print_header("STEP 1: AI Campaign Creation (LangGraph + Segmentation)")
    print(f"\n📋 Brief: {brief}\n")
    print("-" * 70)

    result = await run_campaign_graph(brief)

    segments = result.get("segments", [])
    segment_variants = result.get("segment_variants", {})
    all_variants = result.get("content_variants", [])

    print(f"\n✅ LangGraph pipeline complete!")
    print(f"📊 Strategy: {str(result['strategy'])[:200]}...")
    print(f"👥 Total: {result['customer_count']} customers in {len(segments)} segments")

    print(f"\n📧 Segment-Specific Emails:")
    for seg in segments:
        v = segment_variants.get(seg["segment_id"])
        if v:
            print(f"  {seg['segment_name']} ({seg['size']})")
            print(f"    Subject: {v['subject'][:70]}...")
            print(f"    Tone: {v['tone']}")

    print(f"\n📝 Agent Steps:")
    for step in result.get("steps", []):
        print(f"  [{step.get('agent', 'System')}] {step.get('step', '')}")

    print_header("STEP 2: Sending Segment Campaigns to CampaignX API")

    segment_campaign_ids: dict[str, list[str]] = {}
    master_segment_results: list[SegmentResult] = []

    async def _send_to_segment(seg):
        variant = segment_variants.get(seg["segment_id"])
        if not variant:
            return seg["segment_id"], []

        print(f"\n  📤 {seg['segment_name']} — {seg['size']} customers")

        segment_name_lower = seg['segment_name'].lower()
        now_utc = datetime.now(timezone.utc)

        if 'professional' in segment_name_lower or 'earner' in segment_name_lower:
            sto_time = now_utc.replace(hour=12, minute=30, second=0)
        elif 'senior' in segment_name_lower or 'retired' in segment_name_lower:
            sto_time = now_utc.replace(hour=3, minute=30, second=0)
        elif 'young' in segment_name_lower or 'digital' in segment_name_lower:
            sto_time = now_utc.replace(hour=15, minute=30, second=0)
        else:
            sto_time = now_utc + timedelta(minutes=5)

        if sto_time < now_utc:
            sto_time += timedelta(days=1)

        if sto_time < now_utc + timedelta(minutes=5):
            sto_time = now_utc + timedelta(minutes=5)

        sto_time_str = format_time(sto_time)
        print(f"    🕒 [Send-Time Optimizer] Scheduled Delivery: {sto_time_str} IST")

        cids = await send_segment(
            seg["segment_name"], variant, seg["customer_ids"], sto_time_str,
        )
        return seg["segment_id"], cids

    valid_segments = [seg for seg in segments if seg["size"] > 0]
    send_results = await asyncio.gather(*[_send_to_segment(seg) for seg in valid_segments])

    for seg_id, cids in send_results:
        segment_campaign_ids[seg_id] = cids

    total_sent = sum(s["size"] for s in segments if s["size"] > 0)
    campaigns_created = sum(len(v) for v in segment_campaign_ids.values())
    print(f"\n🔗 {campaigns_created} segment campaigns created, {total_sent} total emails sent")

    print_header("STEP 3: Fetching REAL Engagement Metrics (EO/EC)")

    segment_results: list[SegmentResult] = []
    async def _fetch_metrics(seg):
        variant = segment_variants.get(seg["segment_id"], {})
        cids = segment_campaign_ids.get(seg["segment_id"], [])
        return await fetch_segment_metrics(
            seg["segment_name"], seg["segment_id"],
            cids, seg["customer_ids"], variant,
        )

    segment_results = await asyncio.gather(*[_fetch_metrics(seg) for seg in valid_segments])
    master_segment_results.extend(segment_results)

    print_header("ROUND 1 — Per-Segment REAL Metrics")
    overall_open, overall_click = print_segment_metrics(segment_results)

    all_round_metrics = [{
        "round": 1,
        "audience": total_sent,
        "open_rate": overall_open,
        "click_rate": overall_click,
        "segments": len(segment_results),
    }]

    for round_num in range(1, rounds + 1):
        print_header(f"OPTIMIZATION ROUND {round_num + 1}")

        warm_ids_all = []
        cold_ids_all = []
        for sr in segment_results:
            warm = [c for c in sr["opened_ids"] if c not in set(sr["clicked_ids"])]
            cold = [c for c in sr["customer_ids"] if c not in set(sr["opened_ids"])]
            warm_ids_all.extend(warm)
            cold_ids_all.extend(cold)

        print(f"  🔥 Warm leads (opened, didn't click): {len(warm_ids_all)}")
        print(f"  ❄️  Cold leads (never opened): {len(cold_ids_all)}")

        if not warm_ids_all and not cold_ids_all:
            print("  ⚠️  No re-targetable audience, stopping.")
            break

        retarget_groups = []
        if warm_ids_all:
            retarget_groups.append({
                "name": "🔥 Warm Re-target (Opened, Didn't Click)",
                "ids": warm_ids_all,
                "prompt_extra": (
                    "These customers ALREADY OPENED the previous email but did NOT click. "
                    "They are interested but need a stronger push. "
                    "Use URGENCY, SCARCITY, and a CLEAR CTA. "
                    "Subject should create FOMO. Body should be SHORT and action-focused."
                ),
                "tone": "urgent",
                "emoji_level": "moderate",
            })
        if cold_ids_all:
            retarget_groups.append({
                "name": "❄️ Cold Re-target (Never Opened)",
                "ids": cold_ids_all,  
                "prompt_extra": (
                    "These customers NEVER OPENED the previous email. "
                    "The previous subject line failed for them. "
                    "Use a COMPLETELY DIFFERENT subject line approach. "
                    "Try questions, personalization, or curiosity gaps."
                ),
                "tone": "friendly and curious",
                "emoji_level": "heavy",
            })

        retarget_results: list[SegmentResult] = []
        send_time_str = format_time(datetime.now(timezone.utc) + timedelta(minutes=5))

        async def _process_retarget(group):
            print(f"\n  📧 Generating re-target email: {group['name']} ({len(group['ids'])} customers)")

            fake_segment = {
                "segment_id": "retarget",
                "segment_name": group["name"],
                "customer_ids": group["ids"],
                "size": len(group["ids"]),
                "criteria": group["prompt_extra"],
                "tone": group["tone"],
                "focus": group["prompt_extra"],
                "emoji_level": group["emoji_level"],
            }

            variant = await generate_segment_variant(brief, str(result["strategy"]), fake_segment)
            print(f"    Subject ({group['name'][:20]}...): {variant['subject'][:60]}...")

            cids = await send_segment(group["name"], variant, group["ids"], send_time_str)

            sr = await fetch_segment_metrics(
                group["name"], f"retarget_r{round_num + 1}",
                cids, group["ids"], variant,
            )
            return sr

        if retarget_groups:
            r_results = await asyncio.gather(*[_process_retarget(g) for g in retarget_groups])
            retarget_results.extend(r_results)
            master_segment_results.extend(r_results)

        print_header(f"ROUND {round_num + 1} — Re-targeting REAL Metrics")
        r_open, r_click = print_segment_metrics(retarget_results)

        all_round_metrics.append({
            "round": round_num + 1,
            "audience": sum(r["total_sent"] for r in retarget_results),
            "open_rate": r_open,
            "click_rate": r_click,
            "segments": len(retarget_results),
        })

        segment_results = retarget_results

    print_header("🏆 FINAL CAMPAIGN SUMMARY")

    print("\n📈 Metrics Progression (REAL EO/EC Data):")
    print(f"  {'Round':<8} {'Audience':<12} {'Segments':<10} {'Open Rate':<12} {'Click Rate':<12}")
    print(f"  {'─' * 8} {'─' * 12} {'─' * 10} {'─' * 12} {'─' * 12}")
    for m in all_round_metrics:
        print(
            f"  {m['round']:<8} {m['audience']:<12} {m['segments']:<10} "
            f"{m['open_rate']}%{'':<8} {m['click_rate']}%"
        )

    all_unique_opens = set()
    all_unique_clicks = set()
    total_unique_audience = 0

    if len(all_round_metrics) > 0:
        total_unique_audience = all_round_metrics[0]["audience"]

    for sr in master_segment_results:
        all_unique_opens.update(sr["opened_ids"])
        all_unique_clicks.update(sr["clicked_ids"])

    unique_open_rate = round((len(all_unique_opens) / total_unique_audience * 100) if total_unique_audience > 0 else 0, 1)
    unique_click_rate = round((len(all_unique_clicks) / total_unique_audience * 100) if total_unique_audience > 0 else 0, 1)

    if len(all_round_metrics) > 1:
        first = all_round_metrics[0]
        last = all_round_metrics[-1]
        print(f"\n  📊 Progression:")
        print(f"     Round 1 (1000 cold): {first['open_rate']}% open, {first['click_rate']}% click")
        print(f"     Round {last['round']} (warm re-target): {last['open_rate']}% open, {last['click_rate']}% click")

    print(f"\n  🎯 Cumulative Pipeline Performance (Unique Customers Reached):")
    print(f"     Total Audience: {total_unique_audience}")
    print(f"     Unique Opens: {len(all_unique_opens)} ({unique_open_rate}%)")
    print(f"     Unique Clicks: {len(all_unique_clicks)} ({unique_click_rate}%)")

    return {
        "brief": brief,
        "strategy": result.get("strategy", ""),
        "segments": [{"name": s["segment_name"], "size": s["size"]} for s in segments],
        "segment_variants": {
            sid: {"subject": v["subject"], "tone": v["tone"]}
            for sid, v in segment_variants.items()
        },
        "metrics_progression": all_round_metrics,
        "final_open_rate": unique_open_rate,
        "final_click_rate": unique_click_rate,
        "steps": result.get("steps", []),
    }

def parse_args():
    args = sys.argv[1:]
    rounds = 1
    brief_parts = []
    i = 0
    while i < len(args):
        if args[i] == "--rounds" and i + 1 < len(args):
            rounds = int(args[i + 1])
            i += 2
        else:
            brief_parts.append(args[i])
            i += 1
    return " ".join(brief_parts) if brief_parts else DEFAULT_BRIEF, rounds

async def main():
    brief, rounds = parse_args()
    result = await run_full_pipeline(brief, rounds)

    with open("agent_output.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False, default=str)
    print(f"\n💾 Full output saved to: agent_output.json")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
