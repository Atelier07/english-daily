#!/usr/bin/env python3
"""Validate course/stories/day-01..30.json. Exit 1 on error. Warnings (chunk listed but not found in text) do not fail."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rng(d): return (60,100) if d<=5 else (100,170) if d<=15 else (150,250)
def norm(s): return re.sub(r"[^a-z0-9' ]"," ",s.lower().replace("’","'"))
def words(s): return re.findall(r"[A-Za-z0-9']+", s)
errs=[]; warns=[]; ids=set(); qids=set(); summary=[]
chunk_day={}; chunk_text={}; last={}
for d in range(1,31):
    p=os.path.join(ROOT,'days','day-%02d.json'%d)
    if not os.path.exists(p): errs.append('missing days file %s'%p); continue
    j=json.load(open(p,encoding='utf8'))
    for c in j['chunks']: chunk_day[c['id']]=d; chunk_text[c['id']]=c['text']
    last[d]=max(int(c['id'][1:]) for c in j['chunks'])
for d in range(1,31):
    p=os.path.join(ROOT,'stories','day-%02d.json'%d)
    if not os.path.exists(p): errs.append('day %d: file missing'%d); continue
    try: s=json.load(open(p,encoding='utf8'))
    except Exception as e: errs.append('day %d: bad JSON %s'%(d,e)); continue
    E=lambda m: errs.append('day %d: %s'%(d,m))
    if s.get('day')!=d: E('day field != %d'%d)
    if s.get('story_id')!='t%02d'%d: E('story_id should be t%02d'%d)
    if not s.get('title_vi'): E('title_vi missing')
    lines=s.get('lines') or []
    if not lines: E('no lines')
    total=0; maxw=10 if d<=10 else 18; maxw_found=0
    for l in lines:
        for k in ('id','speaker','en','vi'):
            if not l.get(k): E('line missing %s: %s'%(k,l.get('id')))
        if l.get('speaker') not in ('N','A','B'): E('bad speaker in %s'%l.get('id'))
        i=l.get('id','')
        if i in ids: E('duplicate id %s'%i)
        ids.add(i)
        if not i.startswith('t%02dl'%d): E('line id %s wrong prefix'%i)
        w=len(words(l.get('en','')))
        total+=w; maxw_found=max(maxw_found,w)
        lim=14 if d<=10 else 18
        if w>lim: E('line %s has %d words (>%d)'%(i,w,lim))
    lo,hi=rng(d)
    if not lo<=total<=hi: E('word count %d outside %d-%d'%(total,lo,hi))
    ch=s.get('chunks') or []
    if not ch: E('no chunks')
    for c in ch:
        if c not in chunk_day: E('unknown chunk %s'%c)
        elif chunk_day[c]>d: E('chunk %s is from day %d (> %d)'%(c,chunk_day[c],d))
    text=norm(' '.join(l.get('en','') for l in lines))
    for c in ch:
        t=chunk_text.get(c)
        if t and '…' not in t:
            t2=norm(t).strip()
            if t2 not in text: warns.append('day %d: chunk %s "%s" not found verbatim'%(d,c,t))
    qs=s.get('questions') or []
    if not 2<=len(qs)<=3: E('need 2-3 questions, got %d'%len(qs))
    for q in qs:
        if not q.get('id') or q['id'] in qids: E('bad/duplicate question id %s'%q.get('id'))
        qids.add(q.get('id'))
        if not q.get('q_vi'): E('question text missing')
        o=q.get('options_vi') or []
        if not 2<=len(o)<=4: E('question %s options count'%q.get('id'))
        a=q.get('answer')
        if not isinstance(a,int) or not 0<=a<len(o): E('question %s bad answer'%q.get('id'))
    summary.append((d,len(lines),total,maxw_found,len(ch),len(qs)))
print('day lines words maxline chunks questions')
for r in summary: print('%3d %5d %5d %7d %6d %9d'%r)
for w in warns: print('WARN',w)
for e in errs: print('ERROR',e)
print('%d stories, %d errors, %d warnings'%(len(summary),len(errs),len(warns)))
sys.exit(1 if errs else 0)
