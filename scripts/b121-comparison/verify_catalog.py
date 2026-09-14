"""Read-only validation of the intake projection against every exact archived member."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile

root = Path(sys.argv[1])
catalog = json.loads((root / 'docs/design/causal-comparison-preparation/source-catalog.json').read_text())
archive = root / 'archive/evals/causal-host-proof-execution/local-files-v1.tar.gz'
assert catalog['archive'] == str(archive.relative_to(root))
assert hashlib.sha256(archive.read_bytes()).hexdigest() == catalog['archiveSha256'] == '7317e670202027fc3d102de09a0f5bb44cb04b522a3571fc3528363b33811e2a'
ids = dict(zip(('C1','C2','C3','C4','C5','C6','C7','C8'), ('S1-score-mutant','S2-equivalent','S3-interleaved-revisions','S4-stale-current','S5-exact-replay','S6-short','S7-missing-verifier','S2-baseline')))
assert set(catalog['cases']) == set(ids)
with tarfile.open(archive) as tar:
    for case, source in ids.items():
        assert set(catalog['cases'][case]) == {'graph', 'plain'}
        for arm in ('graph', 'plain'):
            record = catalog['cases'][case][arm]
            member = f'real-execution/{source}-{arm}.stdout.log'
            assert record['archiveMember'] == member
            raw = tar.extractfile(member).read()
            assert hashlib.sha256(raw).hexdigest() == record['sha256']
            observed = json.loads(raw)
            for field in ('trace', 'checkpoints', 'topology'):
                assert record[field] == observed[field], (case, arm, field)
print(json.dumps({'archiveMembersVerified': 16, 'runtimeExecutions': 0}))
