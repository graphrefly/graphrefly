import hashlib,json,tarfile,sys
from pathlib import Path
root=Path(sys.argv[1]); archive=root/'archive/evals/causal-host-proof-preparation/attempt-2026-09-14T20-26-15-335Z.tar.gz'
base='attempt-2026-09-14T20-26-15-335Z/'
reports={}
with tarfile.open(archive) as tar:
 for label in ['baseline','sample-to-population-graph','sample-to-population-plain']:
  raw=tar.extractfile(base+label+'.binding.json').read(); report=json.loads(raw)
  bundle=tar.extractfile(base+label+'.mjs').read()
  assert report['runtimeDigest']=='sha256:'+hashlib.sha256(bundle).hexdigest()
  for edit in report['edits']:
   source=(root/edit['path']).read_text()
   assert hashlib.sha256(source.encode()).hexdigest()==edit['rawSha256']
   assert source.count(edit['from'])==1
   assert hashlib.sha256(source.replace(edit['from'],edit['to']).encode()).hexdigest()==edit['loadedSha256']
  reports[label]=report
print(json.dumps({'reports':reports,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
