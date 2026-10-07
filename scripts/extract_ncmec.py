"""
Parses NCMEC CyberTipline "Reports by Country" PDFs (2020-2025) into one CSV.

Why this source: the CyberTipline is a *counted* tally of reports received in a calendar
year (a flow of events), published per country by the organisation that receives them.
That makes it suitable for a per-second average pace, which a prevalence stock is not.

Formats handled (verified against each file):
  2020, 2021, 2022  : "Country  Number of Reports"
  2023              : "Country / Territory  Reports"
  2024, 2025        : "Country / Territory  Referrals  Informational Reports  Total Reports"
The comparable series across all years is TOTAL reports per country.

Validation: for every year the sum of parsed country rows + the unknown/null row must
equal the "Total"/"Grand total" printed in the PDF, exactly. The script fails otherwise.

Run: ./.venv/bin/python scripts/extract_ncmec.py
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "ncmec"
OUT = ROOT / "data" / "intermediate"
YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

UNKNOWN_LABELS = {"no country listed", "null", "unknown"}
# Rows that are NOT single countries. Europol/Europe receive reports spanning several
# jurisdictions, so they are counted in the published total but never placed on the map.
AGGREGATE_LABELS = {"europol", "interpol", "europe"}
NUM = r"\d{1,3}(?:,\d{3})*|\d+"
# A data row: country name, then either 1-3 numbers or "-" (no reports that year).
ROW = re.compile(rf"^(?P<name>[^\d]+?)\s*\d?\s+(?P<nums>(?:{NUM})(?:\s+(?:{NUM})){{0,2}}|[-\u2013])$")
FUNCTION_TAIL = re.compile(r"\b(the|their|of|on|to|in|a|for|is|are|that|this|by|with|as)$", re.I)


def is_name_fragment(s: str) -> bool:
    """True if s looks like a country name wrapped onto its own line, not body prose."""
    if re.search(r"\d", s) or len(s) > 50 or len(s.split()) > 8:
        return False
    if len(re.findall(r"[A-Za-z]", s)) < 3:  # a lone "-" is a zero value, not a name
        return False
    return not FUNCTION_TAIL.search(s.strip())


def norm(s: str) -> str:
    return re.sub(r"[ \t\u00a0]+", " ", s).strip()


def to_int(s: str) -> int:
    return int(s.replace(",", ""))


def parse_year(year: int) -> tuple[list[dict], int, int]:
    path = RAW / f"{year}-reports-by-country.pdf"
    text = "\n".join(p.extract_text() or "" for p in PdfReader(str(path)).pages)
    lines = [norm(l) for l in text.splitlines()]

    published_total = None
    rows: list[dict] = []
    unknown = 0
    aggregates: dict[str, int] = {}
    skipped: list[str] = []
    three_col = year >= 2024

    # Walk the lines accumulating a buffer, because the PDF wraps long country names over
    # up to three lines ("Saint Helena, Ascension and Tristan da" / "Cunha" / "-"). A buffer
    # is only emitted once it forms a complete row, so body prose is dropped rather than
    # mistaken for data. The exact reconciliation against the published grand total below is
    # what guarantees no real row was lost.
    total_re = re.compile(rf"^(?:grand total|total)\s*:?\s*((?:{NUM})(?:\s+(?:{NUM}))*)$")
    buf = ""
    for l in lines:
        if not l:
            continue
        low = l.lower()
        if (low.startswith(("copyright", "country", "reports total", "number of reports", "* reasons"))
                or low.endswith(("cybertiplinedata", "by country"))
                or re.fullmatch(r"\d{1,2}", l)):
            continue
        cand = f"{buf} {l}".strip() if buf else l
        m = total_re.match(cand.lower())
        if m:
            published_total = to_int(m.group(1).split()[-1])
            buf = ""
            continue
        m = ROW.match(cand)
        if not m:
            buf = cand if is_name_fragment(cand) else ""
            if not buf:
                skipped.append(cand)
            continue
        buf = ""
        name = m.group("name").strip(" .*,")
        raw_nums = m.group("nums")
        if not name:
            continue
        key = name.lower().rstrip("*0123456789").strip()
        # "-" means the country is listed with no reports in that year: a true zero.
        nums = [0] if raw_nums in {"-", "\u2013"} else [to_int(x) for x in raw_nums.split()]
        # 2024/2025: "Antarctica 1 1" is referrals + total (no informational);
        # three numbers are referrals, informational, total; one number is the total.
        total = nums[-1]
        if key in UNKNOWN_LABELS:
            unknown += total
            continue
        if key in AGGREGATE_LABELS:
            aggregates[key] = aggregates.get(key, 0) + total
            continue
        rows.append({"year": year, "source_country_name": name, "total_reports": total,
                     "referrals": nums[0] if three_col and len(nums) == 3 else "",
                     "informational": nums[1] if three_col and len(nums) == 3 else ""})

    if published_total is None:
        sys.exit(f"{year}: published total not found")
    # Dropped lines are the explanatory prose; a dropped line ending in a number would mean a
    # real data row was missed, which the total reconciliation below would also catch.
    suspicious = [s for s in skipped if re.search(r"\d\s*$", s)]
    if suspicious:
        sys.exit(f"{year}: dropped line(s) that look like data: {suspicious[:5]}")
    parsed = sum(r["total_reports"] for r in rows) + unknown + sum(aggregates.values())
    if parsed != published_total:
        sys.exit(f"{year}: parsed {parsed:,} != published total {published_total:,} (diff {parsed - published_total:+,})")
    names = [r["source_country_name"] for r in rows]
    if len(names) != len(set(names)):
        dupes = {n for n in names if names.count(n) > 1}
        sys.exit(f"{year}: duplicate country rows {dupes}")
    return rows, unknown, published_total, aggregates


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    h.update(p.read_bytes())
    return h.hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    all_rows: list[dict] = []
    totals = {}
    for y in YEARS:
        rows, unknown, published, aggregates = parse_year(y)
        all_rows += rows
        totals[y] = {"published_total": published, "unknown_or_unlisted": unknown,
                     "multi_jurisdiction_excluded": aggregates,
                     "countries": len(rows),
                     "sum_countries": published - unknown - sum(aggregates.values())}
        extra = f", excluded {aggregates}" if aggregates else ""
        print(f"{y}: {len(rows)} countries, total {published:,} (unknown {unknown:,}{extra}) ✓")

    with (OUT / "ncmec_cybertipline_by_country.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["year", "source_country_name", "total_reports", "referrals", "informational"])
        w.writeheader()
        w.writerows(all_rows)
    (OUT / "ncmec_totals.json").write_text(json.dumps({
        "years": totals,
        "raw_sha256": {p.relative_to(ROOT).as_posix(): sha256(p) for p in sorted(RAW.glob("*.pdf"))},
    }, indent=2))


if __name__ == "__main__":
    main()
