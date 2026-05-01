raw = open('frontend/src/lib/api.ts', 'rb').read()

# Find the closing of submissionsApi
idx = raw.find(b'getById: (submissionId: string) =>')
if idx == -1:
    print('ERROR: getById not found')
    exit(1)

# Find the closing }; after getById
close_idx = raw.find(b'\n};', idx)
if close_idx == -1:
    print('ERROR: closing }; not found')
    exit(1)

print('getById at:', idx, 'close at:', close_idx)
print('Context:', repr(raw[close_idx-10:close_idx+10]))

insert = b'''\n\n  /** Coach: list accepted athletes */\n  coachAthletes: () =>\n    api.get<{ athletes: CoachAthlete[]; total: number }>('/submissions/coach/athletes'),\n\n  /** Coach: player progress */\n  playerProgress: (playerId: string) =>\n    api.get<PlayerProgress>(`/submissions/coach/player/${playerId}/progress`),\n\n  /** Player: own progress */\n  myProgress: () =>\n    api.get<PlayerProgress>('/submissions/player/progress'),'''

result = raw[:close_idx] + insert + raw[close_idx:]
open('frontend/src/lib/api.ts', 'wb').write(result)
print('Done. New length:', len(result))
