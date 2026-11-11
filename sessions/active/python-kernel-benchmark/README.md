# Python kernel benchmark

Evidence for [PROPOSAL-python-kernel-separation.md](../PROPOSAL-python-kernel-separation.md), run on
2026-11-10. Non-normative and not package code: the Python files here are a measurement of what a
pure-Python D797 kernel costs, not the Python package's implementation.

| File | Contents |
|---|---|
| [kernel.py](kernel.py) | Line-by-line port of [reference/kernel/kernel.mjs](../../../reference/kernel/kernel.mjs) at root `51f6885` |
| [kernel_fast.py](kernel_fast.py) | The same with fast paths for plain DATA waves; anything else falls back to the ported code |
| [kernel_c.py](kernel_c.py) | `kernel_fast.py` with the annotations mypyc needs, compiled with mypyc for one column |
| [gen.py](gen.py), [run.mjs](run.mjs), [run.py](run.py), [diff.py](diff.py) | Differential check: random graphs and host operations, run through the JS reference and a Python kernel, traces compared |
| [bench.py](bench.py), [results.txt](results.txt) | The benchmark and its output |

## Checking a port against the reference

```bash
python3 gen.py 5000 100000 > sc.json
node run.mjs < sc.json > js.json
K=kernel_fast python3 run.py < sc.json > py.json
python3 diff.py js.json py.json sc.json
```

On 2026-11-10 all three kernels matched the reference on 8,000 scenarios (seeds 0–2999 and
100000–104999, 84,496 trace entries). Mutations that change behavior were caught. Not covered: a
`set(fn)` that returns the value it was given, and requests made inside a batch body.

## Benchmark

Run with the Python package's virtual environment, after `uv run maturin develop --release` there, so
that `graphrefly` is the PyO3 binding (graphrefly-rs `cf02fc9`, graphrefly-py `467e529`, both still on
the protocol before D797). For the mypyc column, compile `kernel_c.py` with `mypyc` in a separate
environment and put the built module on `PYTHONPATH`.

```bash
PYTHONPATH=<dir with kernel_c module> ../../../../graphrefly-py/.venv/bin/python bench.py
```

Python 3.14.2 on arm64 macOS, best of five. Each step is one host input; the cost is reported per
node run. `inc` is `x + 1`; `heavy` adds about 1 µs of Python work per run.

| Scenario (µs per node run) | Reference port | Tuned | Tuned + mypyc | Rust, public facade | Rust, `_native` |
|---|---|---|---|---|---|
| chain of 100, `inc` | 4.85 | 2.34 | 1.90 | 0.88 | 0.54 |
| fan 100 → 1, `inc` | 5.21 | 2.43 | 2.48 | 0.98 | 0.65 |
| batch of 100 states, `inc` | 8.42 | 4.40 | 4.22 | 1.75 | 1.04 |
| build and subscribe 200, `inc` | 6.16 | 4.70 | 3.37 | 7.13 | 2.57 |
| chain of 100, `heavy` | 5.80 | 3.28 | 2.82 | 1.80 | 1.47 |
| fan 100 → 1, `heavy` | 6.24 | 3.36 | 3.40 | 1.90 | 1.56 |
| batch of 100 states, `heavy` | 9.22 | 5.42 | 5.11 | 2.68 | 1.95 |

Limits: the two sides implement different protocol revisions; only synchronous waves were measured;
no async work, lifetime churn beyond the build row, or typed mypyc build.
