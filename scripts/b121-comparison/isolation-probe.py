"""Fixed offline synthetic client; never executes participant input."""
import json, os, sys, socket, errno

def rpc(value):
    print(json.dumps(value), flush=True)
    return json.loads(sys.stdin.readline())

config = json.loads(sys.stdin.readline())
checks = {}
for key, path in config['hiddenPaths'].items():
    try:
        with open(path) as source:
            source.read(1)
        checks[key] = False
    except FileNotFoundError:
        checks[key] = True
    except PermissionError:
        checks[key] = False
checks['unprivileged'] = os.getuid() == 65534
checks['noIPv4Routes'] = len(open('/proc/net/route').read().splitlines()) == 1
try:
    with open('/tmp/b121-write-probe', 'w') as target:
        target.write('unexpected')
    checks['rootReadOnly'] = False
except OSError as error:
    checks['rootReadOnly'] = error.errno == errno.EROFS
with socket.socket() as sock:
    sock.settimeout(1)
    checks['externalConnectionDenied'] = sock.connect_ex(('192.0.2.1', 9)) != 0
checks['onlyAListed'] = rpc({'op': 'list'}) == {'ok': True, 'paths': ['A.json']}
checks['readA'] = rpc({'op': 'read', 'path': 'A.json'})['ok']
for key, value in {
    'earlyB': {'op': 'read', 'path': 'B.json'},
    'oracleTool': {'op': 'read', 'path': 'goldens.json'},
    'traversal': {'op': 'read', 'path': '../B.json'},
    'shellTool': {'op': 'exec', 'command': 'not-executed'},
    'clientSeal': {'op': 'sealA'},
}.items():
    checks[key] = rpc(value)['ok'] is False
for i in range(1, 9):
    checks['submitA'+str(i)] = rpc({'op': 'submit', 'phase': 'A', 'scenario': 'C'+str(i),
        'fields': {'consequence': {'value': 'unknown', 'citations': []}}})['ok']
checks['overwriteDenied'] = rpc({'op': 'submit', 'phase': 'A', 'scenario': 'C1',
    'fields': {'consequence': {'value': 'changed', 'citations': []}}})['ok'] is False
# Fixed probe choreography, not a participant tool or production transport.
checks['sealedByController'] = rpc({'probe': 'ready-for-controller-seal'})['ok']
checks['BVisibleAfterSeal'] = rpc({'op': 'read', 'path': 'B.json'})['ok']
checks['oldPhaseDenied'] = rpc({'op': 'submit', 'phase': 'A', 'scenario': 'C2',
    'fields': {'consequence': {'value': 'unknown', 'citations': []}}})['ok'] is False
for _ in range(80):
    final = rpc({'op': 'list'})
checks['budgetDenied'] = final == {'ok': False, 'error': 'budget exhausted'}
print(json.dumps({'probeResult': checks}), flush=True)
sys.exit(0 if all(checks.values()) else 1)
