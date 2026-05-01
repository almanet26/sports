import sys, os

path = 'frontend/src/lib/api.ts'
raw = open(path, 'rb').read()

# Fix 1: TrainingSession status -> optional
old1 = b"  session_type: 'virtual' | 'in_person';\n  status: string;\n}"
new1 = b"  session_type: 'virtual' | 'in_person';\n  status?: string;\n}"
if old1 in raw:
    raw = raw.replace(old1, new1, 1)
    print('Fixed TrainingSession.status')
else:
    print('TrainingSession.status pattern not found')

# Fix 2: PerformanceEntry - add missing fields
old2 = b"export interface PerformanceEntry {\n  id: number;\n  match_date: string;\n  opponent: string;\n  match_type: string;\n  runs: number;\n  fours: number;\n  sixes: number;\n  wickets: number;\n  catches: number;\n  result: string;\n}"
new2 = b"export interface PerformanceEntry {\n  id: number;\n  match_date: string;\n  opponent: string;\n  match_type: string;\n  runs: number;\n  fours: number;\n  sixes: number;\n  balls_faced?: number;\n  wickets: number;\n  overs_bowled?: number;\n  runs_conceded?: number;\n  catches: number;\n  run_outs?: number;\n  result: string;\n}"
if old2 in raw:
    raw = raw.replace(old2, new2, 1)
    print('Fixed PerformanceEntry')
else:
    print('PerformanceEntry pattern not found')
    idx = raw.find(b'export interface PerformanceEntry')
    print('PerformanceEntry at:', idx)
    if idx != -1:
        print(repr(raw[idx:idx+200]))

f = open(path, 'wb')
f.write(raw)
f.flush()
os.fsync(f.fileno())
f.close()
print('Done. Length:', len(raw))
