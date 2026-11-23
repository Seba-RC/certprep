#!/usr/bin/env python3
"""
Compile human-friendly question source files into the JSON the web app loads.

Source layout (one folder per certification):

    bank-src/<cert-id>/cert.json      exam metadata (name, domains, weights, timing...)
    bank-src/<cert-id>/*.md           questions, any number of files

Question block format (blocks start with '### '):

    ### ace-1001 [1.1] d2 #org-policy #hierarchy
    Stem text. Can span several lines.
    - Wrong option text :: Feedback explaining why it is wrong.
    + Correct option text :: Feedback explaining why it is right.
    - Another wrong option :: Feedback.
    > One-line key takeaway shown after answering.

  * '+' marks a correct option, '-' an incorrect one. Two or more '+' => multi-select,
    and the stem must say "(Choose two.)" / "(Choose three.)" matching the count.
  * d1/d2/d3 = difficulty (easy/medium/hard).
  * Lines starting with '//' are comments.

Usage:
    python3 scripts/build_bank.py            # build every cert in bank-src/
    python3 scripts/build_bank.py --check    # validate only, write nothing
"""
import hashlib
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "bank-src"
OUT = ROOT / "web" / "banks"

HEADER = re.compile(r"^###\s+(?P<id>[a-z0-9-]+)\s+\[(?P<obj>\d+\.\d+)\]\s+d(?P<diff>[123])(?P<tags>(\s+#[a-z0-9-]+)*)\s*$")
CHOOSE = re.compile(r"\(Choose (two|three|four)\.\)")
WORDS = {"two": 2, "three": 3, "four": 4}
LETTERS = "ABCDEFGH"


class BankError(Exception):
    pass


def parse_file(path: Path):
    questions, block, start = [], None, 0
    lines = path.read_text(encoding="utf-8").splitlines()

    def flush():
        if block is not None:
            questions.append(parse_block(block, path, start))

    for i, raw in enumerate(lines, 1):
        line = raw.rstrip()
        if line.startswith("//"):
            continue
        if line.startswith("### "):
            flush()
            block, start = [line], i
        elif block is not None:
            block.append(line)
    flush()
    return questions


def parse_block(block, path, lineno):
    where = f"{path.name}:{lineno}"
    m = HEADER.match(block[0])
    if not m:
        raise BankError(f"{where}: bad header line: {block[0]!r}")
    stem, options, takeaway = [], [], None
    for line in block[1:]:
        s = line.strip()
        if not s:
            continue
        if s[:2] in ("+ ", "- "):
            if " :: " not in s:
                raise BankError(f"{where}: option missing ' :: feedback': {s[:60]!r}")
            text, fb = s[2:].split(" :: ", 1)
            options.append({"text": text.strip(), "feedback": fb.strip(), "correct": s[0] == "+"})
        elif s.startswith("> "):
            takeaway = s[2:].strip()
        else:
            if options:
                # continuation of previous option feedback
                options[-1]["feedback"] += " " + s
            else:
                stem.append(s)
    stem_text = " ".join(stem).strip()
    if not stem_text:
        raise BankError(f"{where}: empty stem")
    if not 3 <= len(options) <= 6:
        raise BankError(f"{where}: needs 3-6 options, has {len(options)}")
    n_correct = sum(o["correct"] for o in options)
    if n_correct == 0:
        raise BankError(f"{where}: no correct option")
    cm = CHOOSE.search(stem_text)
    if n_correct > 1:
        if not cm or WORDS[cm.group(1)] != n_correct:
            raise BankError(f"{where}: {n_correct} correct options but stem lacks matching '(Choose N.)'")
    elif cm:
        raise BankError(f"{where}: stem says '{cm.group(0)}' but only one option is correct")
    if not takeaway:
        raise BankError(f"{where}: missing '> takeaway' line")
    texts = [o["text"].lower() for o in options]
    if len(set(texts)) != len(texts):
        raise BankError(f"{where}: duplicate option text")
    for o in options:
        if len(o["feedback"]) < 15:
            raise BankError(f"{where}: feedback too short for option {o['text'][:40]!r}")

    # Deterministic per-question shuffle so the stored answer letters are balanced
    # (authors tend to put the right answer in the same slot). The app can also
    # shuffle again at runtime.
    seed = int(hashlib.sha256(m.group("id").encode()).hexdigest(), 16)
    random.Random(seed).shuffle(options)
    opts = []
    for idx, o in enumerate(options):
        opts.append({"id": LETTERS[idx], "text": o["text"], "feedback": o["feedback"]})
    return {
        "id": m.group("id"),
        "objective": m.group("obj"),
        "domain": m.group("obj").split(".")[0],
        "difficulty": int(m.group("diff")),
        "type": "multi" if n_correct > 1 else "single",
        "tags": [t.strip()[1:] for t in m.group("tags").split()] if m.group("tags") else [],
        "question": stem_text,
        "options": opts,
        "answer": [LETTERS[i] for i, o in enumerate(options) if o["correct"]],
        "takeaway": takeaway,
    }


def build_cert(cert_dir: Path, write: bool):
    meta = json.loads((cert_dir / "cert.json").read_text(encoding="utf-8"))
    cert_id = meta["id"]
    if cert_id != cert_dir.name:
        raise BankError(f"{cert_dir}: cert.json id {cert_id!r} must match folder name")
    objectives = {o["id"] for d in meta["domains"] for o in d["objectives"]}
    questions = []
    for f in sorted(cert_dir.glob("*.md")):
        questions.extend(parse_file(f))
    ids = Counter(q["id"] for q in questions)
    dupes = [k for k, v in ids.items() if v > 1]
    if dupes:
        raise BankError(f"{cert_id}: duplicate question ids: {dupes}")
    stems = Counter(q["question"].lower() for q in questions)
    dstems = [k[:70] for k, v in stems.items() if v > 1]
    if dstems:
        raise BankError(f"{cert_id}: duplicate stems: {dstems}")
    for q in questions:
        if q["objective"] not in objectives:
            raise BankError(f"{cert_id}: {q['id']} uses unknown objective {q['objective']}")

    by_dom = Counter(q["domain"] for q in questions)
    by_obj = Counter(q["objective"] for q in questions)
    multi = sum(q["type"] == "multi" for q in questions)
    pos = Counter(a for q in questions if q["type"] == "single" for a in q["answer"])
    print(f"[{cert_id}] {len(questions)} questions ({multi} multi-select)")
    for d in meta["domains"]:
        share = by_dom[d["id"]] / max(len(questions), 1) * 100
        print(f"   Section {d['id']}: {by_dom[d['id']]:3d} questions ({share:4.1f}% of bank, exam weight {d['weight']}%)")
        for o in d["objectives"]:
            print(f"      {o['id']}: {by_obj[o['id']]}")
    print(f"   correct-letter spread (single answer, before runtime shuffle): {dict(sorted(pos.items()))}")

    meta_out = dict(meta)
    meta_out["questionCount"] = len(questions)
    meta_out["questionsFile"] = "questions.json"
    if write:
        out = OUT / cert_id
        out.mkdir(parents=True, exist_ok=True)
        (out / "cert.json").write_text(json.dumps(meta_out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (out / "questions.json").write_text(json.dumps(questions, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {
        "id": cert_id,
        "name": meta["name"],
        "shortName": meta.get("shortName", meta["name"]),
        "vendor": meta.get("vendor", ""),
        "level": meta.get("level", ""),
        "description": meta.get("description", ""),
        "questionCount": len(questions),
        "accent": meta.get("accent", "#4f7cff"),
    }


def main():
    write = "--check" not in sys.argv
    certs = []
    try:
        for d in sorted(p for p in SRC.iterdir() if p.is_dir()):
            if (d / "cert.json").exists():
                certs.append(build_cert(d, write))
    except BankError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    if write:
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "index.json").write_text(json.dumps({"certs": certs}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {len(certs)} cert(s) to {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
