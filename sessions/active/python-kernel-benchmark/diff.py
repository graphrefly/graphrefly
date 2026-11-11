import json, sys
js = json.load(open(sys.argv[1])); py = json.load(open(sys.argv[2])); sc = json.load(open(sys.argv[3]))
bad = [i for i, (a, b) in enumerate(zip(js, py)) if a != b]
print(f"scenarios={len(js)} trace_entries={sum(map(len, js))} mismatches={len(bad)}")
for i in bad[:3]:
    print("SCENARIO", json.dumps(sc[i]))
    a, b = js[i], py[i]
    for k in range(max(len(a), len(b))):
        x = a[k] if k < len(a) else None; y = b[k] if k < len(b) else None
        if x != y: print(" first diff at", k, "\n  js", x, "\n  py", y); break
