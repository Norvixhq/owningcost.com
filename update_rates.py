#!/usr/bin/env python3
"""
OwningCost — Rates Center update helper

Updates the Freddie Mac PMMS figures and "week of" date across all rate-center
pages in one command, so refreshing the Rates Center is a 60-second task instead
of a manual hunt-and-replace across 7 files.

USAGE:
    python3 update_rates.py --date "May 28, 2026" --r30 6.42 --r15 5.78 \
        --prior30 6.37 --prior15 5.72 --yearago30 6.81 --yearago15 5.95

    # Dry run (show what would change, don't write):
    python3 update_rates.py --date "May 28, 2026" --r30 6.42 --r15 5.78 --dry-run

WHERE TO GET THE NUMBERS:
    Freddie Mac PMMS, published Thursdays ~noon ET: https://www.freddiemac.com/pmms
    - r30      = this week's 30-year fixed average
    - r15      = this week's 15-year fixed average
    - prior30  = last week's 30-year (for the "+/- vs prior week" delta)
    - prior15  = last week's 15-year
    - yearago30/yearago15 = the "a year ago" comparison figures (optional)

WHAT IT DOES:
    - Replaces the old "Week of <date>" string with the new date everywhere
    - Replaces the headline 30-year and 15-year rate figures on the hub + key pages
    - Recomputes and updates the "+X.XX vs prior week" deltas
    - Leaves educational/illustrative rate mentions in body prose ALONE
      (only updates the clearly-labeled current-rate display elements)

DESIGN NOTE:
    This is intentionally conservative. It updates the ratecard display elements
    and the dated source line, NOT every "6.37%" in running prose (many of those
    are illustrative examples that shouldn't change). After running, eyeball the
    hub page to confirm. Honesty-degradation banners mean even a skipped week
    won't mislead — this script just makes the "commit to weekly" path easy IF
    you choose to take it.

REQUIREMENTS: Python 3.6+, standard library only.
"""

import argparse
import re
import sys
from pathlib import Path

# The pages that carry current-rate display elements (NOT every rate page —
# the purely educational ones like rate-lock-and-timing use illustrative numbers).
RATE_DISPLAY_PAGES = [
    "mortgage-rates.html",
    "todays-mortgage-rates.html",
    "30-year-vs-15-year-mortgage.html",
    "mortgage-rate-vs-treasury-spread.html",
]

# Pages where only the "week of <date>" string should be refreshed (schema + prose),
# without touching rate numbers (they're woven into explanatory text).
DATE_ONLY_PAGES = [
    "what-drives-mortgage-rates.html",
    "should-i-refinance-now.html",
]


def find_old_date(text):
    """Find the existing 'week of <Month DD, YYYY>' date string."""
    m = re.search(r'[Ww]eek of ([A-Z][a-z]+ \d{1,2}, \d{4})', text)
    return m.group(1) if m else None


def update_file(path, args, dry_run):
    p = Path(path)
    if not p.exists():
        print(f"  SKIP (not found): {path}")
        return 0
    text = p.read_text(encoding="utf-8")
    original = text
    changes = 0

    # 1. Update the date string everywhere it appears as "week of <date>"
    old_date = find_old_date(text)
    if old_date and old_date != args.date:
        text = re.sub(
            r'([Ww]eek of )' + re.escape(old_date),
            r'\g<1>' + args.date,
            text,
        )
        changes += 1

    # 2. Update ratecard rate displays (only on display pages)
    if path in RATE_DISPLAY_PAGES and args.r30:
        # The headline 30-year: <div class="ratecard__rate">6.37%</div>
        text, n30 = re.subn(
            r'(<div class="ratecard__rate">)\d\.\d{2,3}%(</div>)',
            lambda m, c=[0]: _nth_rate(m, c, args),
            text,
        )
        changes += n30

    # 3. Update deltas if prior-week figures supplied
    if path in RATE_DISPLAY_PAGES and args.prior30 and args.r30:
        d30 = round(float(args.r30) - float(args.prior30), 2)
        sign30 = "+" if d30 >= 0 else ""
        # crude: replace the first delta text; manual review recommended
        text = re.sub(
            r'(ratecard__delta[^>]*>)[+\-]?\d\.\d{2} vs prior week',
            r'\g<1>' + f'{sign30}{d30:.2f} vs prior week',
            text,
            count=1,
        )

    if text != original:
        if dry_run:
            print(f"  WOULD UPDATE: {path} ({changes} change blocks)")
        else:
            p.write_text(text, encoding="utf-8")
            print(f"  UPDATED: {path} ({changes} change blocks)")
        return 1
    else:
        print(f"  no change: {path}")
        return 0


# Helper: alternate between r30 and r15 for the two ratecards on a page
def _nth_rate(m, counter, args):
    idx = counter[0]
    counter[0] += 1
    rate = args.r30 if idx == 0 else (args.r15 if args.r15 else args.r30)
    return f'{m.group(1)}{rate}%{m.group(2)}'


def main():
    ap = argparse.ArgumentParser(description="Update OwningCost Rates Center figures.")
    ap.add_argument("--date", required=True, help='New PMMS week date, e.g. "May 28, 2026"')
    ap.add_argument("--r30", help="This week's 30-year fixed rate, e.g. 6.42")
    ap.add_argument("--r15", help="This week's 15-year fixed rate, e.g. 5.78")
    ap.add_argument("--prior30", help="Last week's 30-year (for delta)")
    ap.add_argument("--prior15", help="Last week's 15-year (for delta)")
    ap.add_argument("--yearago30", help="A year ago 30-year (optional)")
    ap.add_argument("--yearago15", help="A year ago 15-year (optional)")
    ap.add_argument("--dry-run", action="store_true", help="Show changes without writing")
    args = ap.parse_args()

    print(f"Updating Rates Center to week of {args.date}")
    if args.r30: print(f"  30-year: {args.r30}%  |  15-year: {args.r15 or '(unchanged)'}%")
    print()

    updated = 0
    for path in RATE_DISPLAY_PAGES + DATE_ONLY_PAGES:
        updated += update_file(path, args, args.dry_run)

    print()
    print(f"{'Would update' if args.dry_run else 'Updated'} {updated} files.")
    print()
    print("IMPORTANT: after running, open mortgage-rates.html and todays-mortgage-rates.html")
    print("to confirm the headline figures look right. The script only touches labeled")
    print("rate-display elements, not illustrative numbers in body prose — but eyeball it.")
    print()
    print("Then re-submit the rate pages to IndexNow:")
    print("  python3 submit_indexnow.py --new")


if __name__ == "__main__":
    main()
