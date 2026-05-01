import sys, os

path = 'frontend/src/lib/api.ts'
raw = open(path, 'rb').read()
idx = raw.find(b'Extend submissionsApi')
if idx == -1:
    sys.exit('NOT FOUND')

cut = idx - 3  # strip preceding \n\n/
result = raw[:cut] + b'\n'

f = open(path, 'wb')
f.write(result)
f.flush()
os.fsync(f.fileno())
f.close()

verify = open(path, 'rb').read()
sys.stdout.write('Written=' + str(len(result)) + ' Verified=' + str(len(verify)) + '\n')
sys.stdout.flush()
