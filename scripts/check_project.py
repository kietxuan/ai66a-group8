"""Offline document/link/config hygiene; no env reads or network calls."""
import json
import re
from pathlib import Path
from urllib.parse import unquote

ROOT=Path(__file__).resolve().parents[1]


def main():
    failures=[]
    # The launcher must also parse under Windows PowerShell 5.1 (ANSI default).
    if not (ROOT/'scripts/dev.ps1').read_bytes().isascii():
        failures.append('scripts/dev.ps1 must stay ASCII-only for Windows PowerShell 5.1 compatibility')
    docs=[ROOT/'README.md',ROOT/'AGENTS.md',*sorted((ROOT/'docs').rglob('*.md'))]
    for path in docs:
        text=path.read_text(encoding='utf-8')
        for target in re.findall(r'\]\(([^)]+)\)',text):
            target=target.strip('<>')
            if target.startswith(('https:','http:','#','mailto:')):continue
            target=unquote(target.split('#')[0])
            if target and not (path.parent/target).exists():failures.append(f'{path.name}: broken local link')
        if re.search(r'\bgsk_[A-Za-z0-9]{30,}',text):failures.append(f'{path.name}: possible credential')
    for path in (ROOT/'docs/evidence').glob('*.json'):
        try:json.loads(path.read_text(encoding='utf-8'))
        except ValueError:failures.append(f'{path.name}: invalid JSON')
    audit=ROOT/'docs/AUDIT_IMPROVEMENTS_2026-10-21.md'
    tracking=ROOT/'docs/IMPROVEMENT_STATUS_2026-10-21.md'
    if audit.exists() and tracking.exists():
        expected=set(re.findall(r'\b([A-J]\d{2})\b',audit.read_text(encoding='utf-8')))
        rows=re.findall(r'^\| ([A-J]\d{2}) \|',tracking.read_text(encoding='utf-8'),re.M)
        if len(rows)!=107 or len(set(rows))!=107 or set(rows)!=expected:
            failures.append('Improvement tracking must cover exactly the 107 unique audit IDs')
    print(json.dumps({'documents':len(docs),'errors':failures},ensure_ascii=False))
    return bool(failures)


if __name__=='__main__':raise SystemExit(main())
