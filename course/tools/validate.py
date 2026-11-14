#!/usr/bin/env python3
"""Validate course/days/*.json and course/index.json against SCHEMA.md. Exit 1 on errors."""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors, warns = [], []
def err(m): errors.append(m)

LEVELS = {"A0", "A1", "A2", "B1", "B2"}
TYPES = {"stem", "fixed", "phrasal"}
REGS = {"neutral", "casual", "polite", "work"}
IPA = re.compile(r"[ˈˌəɪʊɒæθðʃʒŋɑɔʌɛ]")

def need(o, keys, where):
    for k in keys:
        if k not in o:
            err(f"{where}: missing '{k}'")
            return False
    return True

files = sorted(glob.glob(os.path.join(ROOT, "days", "day-*.json")))
chunk_ids, line_ids = {}, {}
chunk_day = {}
days = {}
for f in files:
    name = os.path.basename(f)
    try:
        d = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        err(f"{name}: invalid JSON ({e})"); continue
    days[name] = d

def reg_line(i, where):
    if i in line_ids: err(f"{where}: duplicate line id {i} (also {line_ids[i]})")
    else: line_ids[i] = where

total_chunks = 0
for name, d in sorted(days.items()):
    if not need(d, ["day","level","function","title","intro_vi","chunks","dialogue","substitution","roleplay"], name): continue
    day = d["day"]
    if name != "day-%02d.json" % day: err(f"{name}: day number {day} does not match file name")
    if d["level"] not in LEVELS: err(f"{name}: bad level {d['level']}")
    ch = d["chunks"]
    if not 5 <= len(ch) <= 8: err(f"{name}: {len(ch)} chunks (need 5-8)")
    local = {}
    for c in ch:
        w = f"{name} chunk {c.get('id')}"
        if not need(c, ["id","text","type","vi","vi_equivalent","contrast_vi","register","reduced","source","examples"], w): continue
        total_chunks += 1
        if not re.fullmatch(r"c\d{3}", c["id"]): err(f"{w}: id format")
        if c["id"] in chunk_ids: err(f"{w}: duplicate chunk id (also {chunk_ids[c['id']]})")
        chunk_ids[c["id"]] = name; chunk_day[c["id"]] = day; local[c["id"]] = c
        if c["type"] not in TYPES: err(f"{w}: bad type")
        if c["register"] not in REGS: err(f"{w}: bad register")
        if c["type"] == "stem" and "…" not in c["text"]: err(f"{w}: stem without …")
        if c["type"] == "fixed" and "…" in c["text"]: err(f"{w}: fixed chunk contains …")
        if not c["vi"].strip(): err(f"{w}: empty vi")
        if c["vi_equivalent"] is False and not c["contrast_vi"].strip(): err(f"{w}: vi_equivalent=false needs contrast_vi")
        if c["reduced"] is not None and not isinstance(c["reduced"], str): err(f"{w}: reduced must be string or null")
        if IPA.search(c["text"]): err(f"{w}: IPA-like characters")
        if not c["examples"]: err(f"{w}: no examples")
        for e in c["examples"]:
            if need(e, ["id","en","vi"], w + " example"):
                reg_line(e["id"], w)
                if not e["en"].strip() or not e["vi"].strip(): err(f"{w}: empty example")
    # dialogue
    dl = d["dialogue"]
    seen = set(local) | {k for k, v in chunk_day.items() if v < day}
    used_earlier = set()
    if need(dl, ["setting_vi","lines"], name + " dialogue"):
        if not 6 <= len(dl["lines"]) <= 10: err(f"{name}: dialogue has {len(dl['lines'])} lines (need 6-10)")
        for l in dl["lines"]:
            if not need(l, ["id","speaker","en","vi","chunks"], name + " line"): continue
            reg_line(l["id"], name)
            for k in l["chunks"]:
                if k not in seen: err(f"{name} line {l['id']}: chunk {k} not introduced yet")
                elif k not in local: used_earlier.add(k)
    # substitution
    subs = d["substitution"]
    stems = {k for k, c in local.items() if c["type"] == "stem"}
    got = set()
    for s in subs:
        if not need(s, ["chunk","cues"], name + " substitution"): continue
        if s["chunk"] not in local: err(f"{name}: substitution chunk {s['chunk']} not new today")
        got.add(s["chunk"])
        if s["chunk"] in stems and not 3 <= len(s["cues"]) <= 5: err(f"{name}: stem {s['chunk']} has {len(s['cues'])} cues (need 3-5)")
        for q in s["cues"]:
            if need(q, ["id","cue_vi","answer","accept"], name + " cue"):
                reg_line(q["id"], name)
                if not q["accept"]: err(f"{name} cue {q['id']}: empty accept")
    for k in stems - got: err(f"{name}: stem {k} has no substitution")
    # roleplay
    rp = d["roleplay"]
    if need(rp, ["situation_vi","turns"], name + " roleplay"):
        if not 4 <= len(rp["turns"]) <= 8: err(f"{name}: roleplay has {len(rp['turns'])} turns (need 4-8)")
        if not any(t.get("role") == "you" for t in rp["turns"]): err(f"{name}: roleplay has no 'you' turn")
        for t in rp["turns"]:
            if not need(t, ["id","role"], name + " turn"): continue
            reg_line(t["id"], name)
            if t["role"] == "partner": need(t, ["en","vi"], name + " turn " + t["id"])
            elif t["role"] == "you":
                need(t, ["cue_vi","model","uses"], name + " turn " + t["id"])
                for k in t.get("uses", []):
                    if k not in seen: err(f"{name} turn {t['id']}: chunk {k} not introduced yet")
                    elif k not in local: used_earlier.add(k)
            else: err(f"{name} turn {t['id']}: bad role")
    if day >= 2 and not 3 <= len(used_earlier) <= 6:
        err(f"{name}: reuses {len(used_earlier)} earlier chunks (need 3-6)")

# chunk ids sequential
ids = sorted(chunk_ids)
for i, cid in enumerate(ids, 1):
    if cid != "c%03d" % i: err(f"chunk ids not contiguous at {cid} (expected c{i:03d})"); break
# day numbers contiguous
nums = sorted(d["day"] for d in days.values() if "day" in d)
if nums != list(range(1, len(nums) + 1)): err(f"day numbers not contiguous: {nums}")

# index
ip = os.path.join(ROOT, "index.json")
if not os.path.exists(ip): err("index.json missing")
else:
    idx = json.load(open(ip, encoding="utf-8"))
    byfile = {x.get("file"): x for x in idx}
    for name, d in days.items():
        x = byfile.get("days/" + name)
        if not x: err(f"index.json: no entry for {name}"); continue
        for k_idx, k_day in (("day","day"),("level","level"),("function","function"),("title","title")):
            if x.get(k_idx) != d.get(k_day): err(f"index.json: {name} {k_idx} mismatch")
    for fl in byfile:
        if not os.path.exists(os.path.join(ROOT, fl)): err(f"index.json: file {fl} missing")
    if [x["day"] for x in idx] != sorted(x["day"] for x in idx): err("index.json not sorted by day")

print(f"days: {len(days)}  chunks: {total_chunks}  line ids: {len(line_ids)}")
for m in errors: print("ERROR", m)
print("OK" if not errors else f"{len(errors)} error(s)")
sys.exit(1 if errors else 0)
