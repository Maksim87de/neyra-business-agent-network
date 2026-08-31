#!/usr/bin/env python3
from __future__ import annotations
import argparse, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['README.md','AGENTS.md','.gitignore','.env.example','agents/orchestrator/profile.yaml','agents/legal/profile.yaml','agents/finance/profile.yaml','shared/schemas/task-envelope.schema.json','shared/schemas/evidence.schema.json','docs/architecture.md','docs/security-model.md','docs/publishing-gate.md']
FORBIDDEN = {'client-home','memories','knowledge','sessions','logs','backups'}
def main():
 p=argparse.ArgumentParser(); p.add_argument('--tree',action='store_true'); a=p.parse_args()
 missing=[x for x in REQUIRED if not (ROOT/x).is_file()]
 forbidden=[x.name for x in ROOT.iterdir() if x.name in FORBIDDEN]
 for n in ('task-envelope.schema.json','evidence.schema.json'): json.loads((ROOT/'shared/schemas'/n).read_text())
 if a.tree:
  for x in sorted(p.relative_to(ROOT) for p in ROOT.rglob('*') if '.git' not in p.parts): print(x)
 if missing or forbidden:
  print('Missing:', ', '.join(missing)); print('Forbidden:', ', '.join(forbidden)); return 1
 print('PASS: portable repository structure and JSON contracts are valid.'); return 0
if __name__ == '__main__': raise SystemExit(main())
