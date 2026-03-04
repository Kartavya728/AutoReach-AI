"""
CampaignX API Test Suite
━━━━━━━━━━━━━━━━━━━━━━━
Team       : ValoBabies
Team Email : b24199@students.iitmandi.ac.in
API Key    : on1MLV73fprjBptTJR_mKg-3v6Bq0OIc5aGbKc9TFEY
Base URL   : https://campaignx.inxiteout.ai

Tests all available CampaignX API endpoints and writes full responses +
analysis to  api_output.txt.

Usage:
    pip install requests python-dotenv langsmith
    python test.py
"""

import json
import os
import re
import sys
import time
import datetime
import requests
from typing import Optional

# ─── Configuration ─────────────────────────────────────────────────────────────

BASE_URL  = "https://campaignx.inxiteout.ai"
API_KEY   = "on1MLV73fprjBptTJR_mKg-3v6Bq0OIc5aGbKc9TFEY"
OUT_FILE  = os.path.join(os.path.dirname(__file__), "api_output.txt")

HEADERS = {
    "X-API-Key":    API_KEY,
    "Content-Type": "application/json",
    "Accept":       "application/json",
}

# ─── Dual-writer (console + file) ──────────────────────────────────────────────

_log_fh = None   # file handle, opened in main()

RESET   = "\033[0m";  BOLD  = "\033[1m"
GREEN   = "\033[92m"; YELLOW= "\033[93m"; RED   = "\033[91m"
CYAN    = "\033[96m"; BLUE  = "\033[94m"; MAGENTA="\033[95m"

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")

def _strip(s: str) -> str:
    return _ANSI_RE.sub("", s)

def _emit(line: str) -> None:
    """Print to console (with colour) and write plain text to file."""
    print(line)
    if _log_fh:
        _log_fh.write(_strip(line) + "\n")

def banner(title: str) -> None:
    _emit(f"\n{BOLD}{BLUE}{'=' * 70}{RESET}")
    _emit(f"{BOLD}{BLUE}  {title}{RESET}")
    _emit(f"{BOLD}{BLUE}{'=' * 70}{RESET}")

def section(title: str) -> None:
    _emit(f"\n{BOLD}{CYAN}  >> {title}{RESET}")
    _emit(f"  {CYAN}{'-' * 65}{RESET}")

def ok(msg: str)   -> None: _emit(f"  {GREEN}[OK]  {msg}{RESET}")
def warn(msg: str) -> None: _emit(f"  {YELLOW}[WARN] {msg}{RESET}")
def fail(msg: str) -> None: _emit(f"  {RED}[FAIL] {msg}{RESET}")
def info(msg: str) -> None: _emit(f"  {MAGENTA}[INFO] {msg}{RESET}")
def raw(msg: str)  -> None: _emit(msg)   # undecorated line

def print_response(resp: requests.Response) -> dict:
    """Log status line + formatted JSON body."""
    status = resp.status_code
    colour = GREEN if 200 <= status < 300 else (YELLOW if status < 500 else RED)
    _emit(f"\n  {colour}{BOLD}HTTP {status}  {resp.reason}{RESET}")
    try:
        data = resp.json()
        _emit(json.dumps(data, indent=4, ensure_ascii=False))
        return data
    except Exception:
        _emit(resp.text)
        return {}

# ─── File header / footer helpers ──────────────────────────────────────────────

def write_file_header() -> None:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "=" * 70,
        "  CampaignX API Test Suite — Full Output",
        "=" * 70,
        f"  Team       : ValoBabies",
        f"  Email      : b24199@students.iitmandi.ac.in",
        f"  API Key    : {API_KEY[:16]}...  (truncated)",
        f"  Base URL   : {BASE_URL}",
        f"  Run Time   : {now} IST",
        f"  Output File: {OUT_FILE}",
        "=" * 70,
        "",
        "  ENDPOINTS TESTED",
        "  ----------------",
        "  1. [SKIP] POST /api/v1/signup          -- already registered",
        "  2.        GET  /api/v1/get_customer_cohort",
        "  3a.       POST /api/v1/send_campaign   -- Variant A (formal tone)",
        "  3b.       POST /api/v1/send_campaign   -- Variant B (urgent tone)",
        "  4a.       GET  /api/v1/get_report       -- Variant A campaign",
        "  4b.       GET  /api/v1/get_report       -- Variant B campaign",
        "",
        "  Rate limit: 100 requests / day (all authenticated endpoints combined)",
        "  Estimated usage this run: 6 requests",
        "",
    ]
    for ln in lines:
        _emit(ln)  # _emit handles both console + file; no double-write

def write_file_footer(campaign_ids: dict, reports: dict) -> None:
    _emit("")
    banner("FINAL SUMMARY")
    for label, cid in campaign_ids.items():
        if cid:
            ok(f"Campaign {label} ID : {cid}")
    _emit("")
    for label, report in reports.items():
        rows = report.get("data", [])
        total   = report.get("total_rows", len(rows))
        opened  = sum(1 for r in rows if r.get("EO") == "Y")
        clicked = sum(1 for r in rows if r.get("EC") == "Y")
        if total:
            open_rate  = (opened  / total) * 100
            click_rate = (clicked / total) * 100
            weighted   = (click_rate * 0.70) + (open_rate * 0.30)
            info(f"Campaign {label} | Open: {open_rate:.1f}%  Click: {click_rate:.1f}%  "
                 f"Weighted Score: {weighted:.2f}%")
        else:
            warn(f"Campaign {label} | No data rows returned yet.")

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _emit("\n" + "=" * 70)
    _emit(f"  End of output  |  Generated at {now} IST")
    _emit("=" * 70)

# ─── 1. Signup (already done — reference only) ─────────────────────────────────

def test_signup_info() -> None:
    banner("STEP 1 — SIGNUP  [SKIPPED — already registered]")
    info("Endpoint : POST /api/v1/signup")
    info("Team     : ValoBabies")
    info("Email    : b24199@students.iitmandi.ac.in")
    info("API Key  : on1MLV73fprjBptTJR_mKg-3v6Bq0OIc5aGbKc9TFEY")
    info("Reg Time : 2026-03-03T22:16:07.976996+05:30")
    warn("Signup is unauthenticated and must only be called once per team.")
    warn("Calling it again with the same email returns a duplicate-team error.")
    raw("""
  [REFERENCE] Signup request payload:
  {
      "team_name":  "ValoBabies",
      "team_email": "b24199@students.iitmandi.ac.in"
  }

  [REFERENCE] Signup success response (201 Created):
  {
      "api_key":    "on1MLV73fprjBptTJR_mKg-3v6Bq0OIc5aGbKc9TFEY",
      "team_name":  "ValoBabies",
      "team_email": "b24199@students.iitmandi.ac.in",
      "created_at": "2026-03-03T22:16:07.976996+05:30",
      "message":    "Team registered successfully. API key sent to your email."
  }
""")

# ─── 2. Get Customer Cohort ─────────────────────────────────────────────────────

def test_get_customer_cohort() -> list:
    banner("STEP 2 — GET CUSTOMER COHORT")
    section("GET /api/v1/get_customer_cohort")
    info(f"URL  : {BASE_URL}/api/v1/get_customer_cohort")
    info("Auth : X-API-Key header")
    info("Note : Returns full customer master data (IDs + demographics)")

    start = time.time()
    resp  = requests.get(f"{BASE_URL}/api/v1/get_customer_cohort",
                         headers=HEADERS, timeout=30)
    elapsed = time.time() - start

    data      = print_response(resp)
    customers = data.get("data", [])

    if resp.ok:
        ok(f"Fetched {data.get('total_count', len(customers))} customers in {elapsed:.2f}s")
        if customers:
            ok(f"First customer : {json.dumps(customers[0],  ensure_ascii=False)}")
            ok(f"Last  customer : {json.dumps(customers[-1], ensure_ascii=False)}")
            # Show all available fields in the customer object
            info(f"Customer fields: {list(customers[0].keys())}")
    else:
        fail("Failed to fetch customer cohort.")

    return customers

# ─── 3. Send Campaign ───────────────────────────────────────────────────────────

def test_send_campaign(customers: list, variant: str) -> Optional[str]:
    """
    variant : "A" -> formal tone, first 5 customers
              "B" -> urgent tone, next 5 customers
    """
    banner(f"STEP 3{variant} — SEND CAMPAIGN  [Variant {variant}]")

    if variant == "A":
        subset  = customers[:5]
        subject = "Introducing XDeposit -- Earn 1% More on Your Savings!"
        body    = (
            "Dear Valued Customer,\n\n"
            "We are excited to introduce XDeposit, the flagship Term Deposit from SuperBFSI.\n\n"
            "* 1 percentage point HIGHER returns than competitors\n"
            "* Special bonus: +0.25% for female senior citizens\n"
            "* Safe, secure, and trusted by millions across India\n\n"
            "Start growing your wealth today: https://superbfsi.com/xdeposit/explore/\n\n"
            "Best regards,\nTeam SuperBFSI"
        )
    else:
        subset  = customers[5:10]
        subject = "Last Chance: XDeposit Rate Offer -- Act Now!"
        body    = (
            "Hi there!\n\n"
            "Don't miss out on XDeposit -- India's smartest term deposit.\n\n"
            ">> Earn 1% MORE than any other bank\n"
            ">> Female senior citizens get an extra 0.25% bonus\n"
            ">> Limited period offer -- act now!\n\n"
            "Learn more: https://superbfsi.com/xdeposit/explore/\n\n"
            "-- SuperBFSI Team"
        )

    target_ids = [c["customer_id"] for c in subset] if subset else ["CUST001"]
    send_dt    = datetime.datetime.now() + datetime.timedelta(minutes=2)
    send_time  = send_dt.strftime("%d:%m:%y %H:%M:%S")

    payload = {
        "subject":           subject,
        "body":              body,
        "list_customer_ids": target_ids,
        "send_time":         send_time,
    }

    section(f"POST /api/v1/send_campaign  [Variant {variant}]")
    info(f"Subject    : {subject}")
    info(f"Target IDs : {target_ids}")
    info(f"Send Time  : {send_time}  (2 minutes from now)")
    info(f"Body length: {len(body)} characters")
    info("Full request payload:")
    _emit(json.dumps(payload, indent=4, ensure_ascii=False))

    start   = time.time()
    resp    = requests.post(f"{BASE_URL}/api/v1/send_campaign",
                            headers=HEADERS, json=payload, timeout=30)
    elapsed = time.time() - start

    data        = print_response(resp)
    campaign_id = data.get("campaign_id")

    if resp.ok and campaign_id:
        ok(f"Campaign submitted successfully in {elapsed:.2f}s")
        ok(f"Campaign ID : {campaign_id}")
    else:
        fail(f"Campaign {variant} submission failed  (HTTP {resp.status_code})")

    return campaign_id

# ─── 4. Get Report ──────────────────────────────────────────────────────────────

def test_get_report(campaign_id: str, variant: str) -> dict:
    banner(f"STEP 4{variant} — GET CAMPAIGN REPORT  [Variant {variant}]")

    if not campaign_id:
        fail("No campaign_id — skipping report.")
        return {}

    section(f"GET /api/v1/get_report?campaign_id={campaign_id}")
    info(f"Campaign ID : {campaign_id}")
    info("Metrics     : EO = Email Opened, EC = Email Clicked")
    info("Note: Report is available immediately per hackathon rules")

    start   = time.time()
    resp    = requests.get(f"{BASE_URL}/api/v1/get_report",
                           headers=HEADERS,
                           params={"campaign_id": campaign_id},
                           timeout=30)
    elapsed = time.time() - start

    data = print_response(resp)

    if resp.ok:
        ok(f"Report fetched in {elapsed:.2f}s")
        rows    = data.get("data", [])
        total   = data.get("total_rows", len(rows))
        opened  = sum(1 for r in rows if r.get("EO") == "Y")
        clicked = sum(1 for r in rows if r.get("EC") == "Y")
        info(f"Total records   : {total}")
        if total:
            open_rate  = (opened  / total) * 100
            click_rate = (clicked / total) * 100
            weighted   = (click_rate * 0.70) + (open_rate * 0.30)
            ok(f"Emails Opened   : {opened}/{total}  ({open_rate:.1f}%)")
            ok(f"Emails Clicked  : {clicked}/{total}  ({click_rate:.1f}%)")
            ok(f"Weighted Score  : {weighted:.2f}%  "
               f"(click*70% + open*30% per evaluation rubric)")
        else:
            warn("No rows in report data yet.")
    else:
        fail(f"Report fetch failed  (HTTP {resp.status_code})")

    return data

# ─── 5. Rate Limit + API Summary ────────────────────────────────────────────────

def print_api_summary() -> None:
    banner("API ENDPOINTS OVERVIEW")
    rows = [
        ("Method", "Endpoint",                       "Auth",    "Rate Limit"),
        ("------", "--------",                       "----",    "----------"),
        ("POST",   "/api/v1/signup",                 "None",    "Once per team"),
        ("GET",    "/api/v1/get_customer_cohort",    "API Key", "100/day"),
        ("POST",   "/api/v1/send_campaign",          "API Key", "100/day"),
        ("GET",    "/api/v1/get_report",             "API Key", "100/day"),
    ]
    for r in rows:
        _emit(f"  {r[0]:<8} {r[1]:<40} {r[2]:<12} {r[3]}")

    _emit("")
    info(f"Base URL : {BASE_URL}")
    info(f"Auth Header : X-API-Key: {API_KEY[:16]}...")
    info("429 Too Many Requests = daily quota exceeded")

# ─── 6. LangSmith setup note ────────────────────────────────────────────────────

def langsmith_setup_note() -> None:
    banner("LANGSMITH OBSERVABILITY NOTE")
    info("LangSmith traces every LLM call and agent decision in the pipeline.")
    info("Required .env variables:")
    raw("""
  LANGCHAIN_TRACING_V2   = true
  LANGCHAIN_ENDPOINT     = https://api.smith.langchain.com
  LANGCHAIN_API_KEY      = <your_langsmith_key>
  LANGCHAIN_PROJECT      = CampaignX
""")
    info("Install: pip install langsmith langchain langchain-google-genai")
    info("Dashboard: https://smith.langchain.com  -> Project 'CampaignX'")

    try:
        from langsmith import Client
        ls_key = os.getenv("LANGCHAIN_API_KEY", "")
        if ls_key:
            client   = Client(api_key=ls_key)
            projects = list(client.list_projects())
            ok(f"LangSmith connected -- {len(projects)} project(s) found")
        else:
            warn("LANGCHAIN_API_KEY not set in environment / .env")
    except ImportError:
        warn("langsmith not installed. Run: pip install langsmith")

# ─── Main ───────────────────────────────────────────────────────────────────────

def main():
    global _log_fh
    _log_fh = open(OUT_FILE, "w", encoding="utf-8", errors="replace")

    try:
        # Load .env if present
        try:
            from dotenv import load_dotenv
            load_dotenv()
            ok(".env loaded")
        except ImportError:
            warn("python-dotenv not installed (optional). Run: pip install python-dotenv")

        write_file_header()
        print_api_summary()

        # ── STEP 1: Signup (reference) ──
        test_signup_info()

        # ── STEP 2: Customer Cohort ──
        customers = test_get_customer_cohort()
        if not customers:
            fail("Empty cohort — cannot run campaign tests.")
            return
        time.sleep(1)

        # ── STEP 3A: Send Campaign Variant A ──
        campaign_id_a = test_send_campaign(customers, variant="A")
        time.sleep(1)

        # ── STEP 3B: Send Campaign Variant B ──
        campaign_id_b = test_send_campaign(customers, variant="B")
        time.sleep(1)

        # ── STEP 4A: Get Report for Variant A ──
        report_a = test_get_report(campaign_id_a, variant="A")
        time.sleep(1)

        # ── STEP 4B: Get Report for Variant B ──
        report_b = test_get_report(campaign_id_b, variant="B")

        # ── LangSmith note ──
        langsmith_setup_note()

        # ── Summary ──
        write_file_footer(
            campaign_ids={"A": campaign_id_a, "B": campaign_id_b},
            reports={"A": report_a, "B": report_b},
        )

        info(f"Full output saved to: {OUT_FILE}")

    finally:
        _log_fh.close()
        _log_fh = None


if __name__ == "__main__":
    main()