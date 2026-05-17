#!/usr/bin/env python3
"""
OwningCost — IndexNow bulk submission script

Reads sitemap.xml from the repository and submits all URLs to IndexNow
(Bing, Yandex, Naver, Seznam — anyone on the IndexNow protocol).

Usage:
    python3 submit_indexnow.py              # submit all URLs from sitemap.xml
    python3 submit_indexnow.py --new        # submit only the 5 new pages + restructured Learn hub
    python3 submit_indexnow.py --dry-run    # show what would be submitted, don't actually POST

Requirements: Python 3.6+, standard library only (no pip installs).

Run it from the repo root (where sitemap.xml lives), OR specify --sitemap path.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG — update these if domain or key ever changes
# ──────────────────────────────────────────────────────────────────────────────
HOST = "owningcost.com"
KEY = "b9ea6cea67954eadb6df80b28957122e"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow"

# Pages worth re-submitting after the 5-session Learn-first arc (Sessions 7A-7D).
# Used by --new flag. Order is roughly priority for crawler attention.
SESSION_7_PRIORITY = [
    # New Learn pages (the highest-value submissions)
    f"https://{HOST}/property-taxes-by-state.html",
    f"https://{HOST}/homeowners-insurance-by-state.html",
    f"https://{HOST}/questions-to-ask-a-landlord.html",
    f"https://{HOST}/how-to-compare-two-loan-estimates.html",
    f"https://{HOST}/home-maintenance-budget-guide.html",
    # Restructured Learn hub
    f"https://{HOST}/learn.html",
    # Updated category hubs (new rcards added)
    f"https://{HOST}/buying.html",
    f"https://{HOST}/renting.html",
    f"https://{HOST}/owning.html",
    f"https://{HOST}/financing.html",
    f"https://{HOST}/risk.html",
    # Calculators with new cross-links to Learn pages
    f"https://{HOST}/true-monthly-cost-calculator.html",
    f"https://{HOST}/affordability-calculator.html",
    f"https://{HOST}/rent-vs-buy-calculator.html",
    f"https://{HOST}/refinance-vs-keep-calculator.html",
    # Strategic flagship that got an in-prose pointer to the new tactical page
    f"https://{HOST}/how-to-choose-a-lender.html",
    # Updated reference pages with new counts
    f"https://{HOST}/index.html",
    f"https://{HOST}/about.html",
    f"https://{HOST}/calculators.html",
    f"https://{HOST}/ai-in-real-estate.html",
]


def parse_sitemap(sitemap_path):
    """Extract all <loc> URLs from sitemap.xml. Returns list of URL strings."""
    if not Path(sitemap_path).exists():
        print(f"ERROR: sitemap not found at {sitemap_path}")
        sys.exit(1)
    text = Path(sitemap_path).read_text(encoding="utf-8")
    urls = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", text)
    return [u.strip() for u in urls if u.strip()]


def chunk(items, size):
    """Yield successive size-sized chunks from items. IndexNow allows up to 10,000 per batch."""
    for i in range(0, len(items), size):
        yield items[i:i + size]


def submit_batch(urls, dry_run=False):
    """POST a batch of URLs to the IndexNow API. Returns (status_code, response_body)."""
    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }
    body = json.dumps(payload).encode("utf-8")

    if dry_run:
        print(f"\n[DRY RUN] Would POST {len(urls)} URLs to {INDEXNOW_ENDPOINT}")
        print(f"          Payload preview: host={HOST}, key={KEY[:8]}…, keyLocation={KEY_LOCATION}")
        print(f"          First 5 URLs: {urls[:5]}")
        return (200, "[dry run — not submitted]")

    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return (resp.status, resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode("utf-8", errors="replace"))
    except urllib.error.URLError as e:
        return (-1, f"URLError: {e.reason}")


def main():
    parser = argparse.ArgumentParser(description="Submit OwningCost URLs to IndexNow.")
    parser.add_argument("--sitemap", default="sitemap.xml",
                        help="Path to sitemap.xml (default: ./sitemap.xml)")
    parser.add_argument("--new", action="store_true",
                        help="Submit only the Session 7 priority list (new + changed pages)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be submitted without actually POSTing")
    args = parser.parse_args()

    if args.new:
        urls = SESSION_7_PRIORITY
        print(f"Mode: Session 7 priority list — {len(urls)} URLs")
    else:
        urls = parse_sitemap(args.sitemap)
        print(f"Mode: full sitemap — {len(urls)} URLs from {args.sitemap}")

    if not urls:
        print("ERROR: no URLs to submit.")
        sys.exit(1)

    # Sanity check: every URL must be on the correct host
    bad = [u for u in urls if HOST not in u]
    if bad:
        print(f"ERROR: {len(bad)} URLs are off-host. First 3: {bad[:3]}")
        sys.exit(1)

    print(f"Key file: {KEY_LOCATION}")
    print(f"Endpoint: {INDEXNOW_ENDPOINT}")
    print()

    # IndexNow accepts up to 10,000 per request. We're far below that, but chunk anyway.
    BATCH = 500
    total_ok = 0
    total_fail = 0
    for i, batch in enumerate(chunk(urls, BATCH), 1):
        print(f"Batch {i} — submitting {len(batch)} URLs…")
        status, body = submit_batch(batch, dry_run=args.dry_run)
        if status in (200, 202):
            print(f"  ✓ HTTP {status} — accepted")
            total_ok += len(batch)
        else:
            print(f"  ✗ HTTP {status} — {body[:200]}")
            total_fail += len(batch)

    print()
    print(f"Done. {total_ok} accepted, {total_fail} failed.")
    if total_fail:
        print()
        print("Common failure causes:")
        print("  403 — key file not yet live at " + KEY_LOCATION)
        print("        (verify by visiting that URL in a browser — should show the key)")
        print("  422 — URL host mismatch with the key file's host")
        print("  429 — rate-limited; wait an hour and retry")
        sys.exit(1)


if __name__ == "__main__":
    main()
