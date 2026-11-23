#!/usr/bin/env python3
"""
Scaffold a new certification so you can start writing questions.

    python3 scripts/new_cert.py aws-saa "AWS Certified Solutions Architect - Associate" --vendor AWS

Then edit bank-src/<id>/cert.json (domains, weights, exam settings), write questions in
bank-src/<id>/*.md, and run: python3 scripts/build_bank.py
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("id", help="lowercase id, e.g. aws-saa")
ap.add_argument("name", help="full certification name")
ap.add_argument("--vendor", default="")
ap.add_argument("--short", default="")
ap.add_argument("--accent", default="#4f7cff")
a = ap.parse_args()

if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,62}", a.id):
    raise SystemExit("id must be lowercase letters, digits and dashes")
d = ROOT / "bank-src" / a.id
if d.exists():
    raise SystemExit(f"{d} already exists")
d.mkdir(parents=True)
cert = {
    "id": a.id,
    "name": a.name,
    "shortName": a.short or a.name,
    "vendor": a.vendor,
    "level": "",
    "accent": a.accent,
    "description": f"Practice questions for {a.name}.",
    "examGuideUrl": "",
    "examGuideVersion": "",
    "exam": {"questions": 50, "durationMinutes": 120, "passPercent": 70,
             "passNote": "Set this to the official passing score if the vendor publishes one.",
             "format": "Describe the real exam format here."},
    "disclaimer": "Original practice questions written against the public exam guide.",
    "domains": [
        {"id": "1", "name": "First domain", "weight": 50,
         "objectives": [{"id": "1.1", "name": "First objective", "refs": []}]},
        {"id": "2", "name": "Second domain", "weight": 50,
         "objectives": [{"id": "2.1", "name": "Second objective", "refs": []}]},
    ],
}
(d / "cert.json").write_text(json.dumps(cert, indent=2) + "\n")
prefix = a.id.split("-")[-1]
(d / "questions.md").write_text(f"""// Questions for {a.name}. See scripts/build_bank.py for the format.

### {prefix}-1001 [1.1] d1 #example
Replace this with your first question. What should you do?
- A wrong option :: Explain why this is wrong.
+ The right option :: Explain why this is right.
- Another wrong option :: Explain why this is wrong.
- A fourth option :: Explain why this is wrong.
> One-line key takeaway.
""")
print(f"Created {d.relative_to(ROOT)}/ - edit cert.json and questions.md, then run scripts/build_bank.py")
