----------------------- MODULE wave_async_paused -----------------------
(***************************************************************************
GraphReFly — async-result arriving at a paused node, GATED BY pausable mode
(conformance C-2 / C-9 / C-10).

Pins R-async-paused (DR-3) + R-pause-lockset (D10) + the D44 precedence:
`pausable` mode is the OUTER gate over async-result buffering.

A node N has a pause lockset and an async (LocalAsync pool) computation in
flight. When the async result RESOLVES while N is paused, whether it BUFFERS
or DELIVERS-IMMEDIATELY depends on the pausable Mode and whether N is a leaf
source (depless) or a compute node (D44):

  ShouldBuffer ==  Mode = "resumeAll"            \* production-gating: always buffer
              \/  (Mode = "true" /\ ~IsLeaf)      \* true: only a COMPUTE node's recompute buffers
  \* Mode = "false"           -> never buffer (ignore PAUSE entirely; B20)
  \* Mode = "true" /\ IsLeaf  -> deliver immediately (a leaf source's own production is not gated)

When ~ShouldBuffer the result is delivered immediately even while paused — the
node keeps producing through the PAUSE. No async result is ever dropped.

Multi-lock: paused state = lockset.size > 0; releasing one of several locks
does not resume; an unknown-id RESUME is a no-op (R-pause-lockset).

Status: draft (flips active with the D44 _shouldBufferOnPause impl, CSP-1).
Configs: wave_async_paused.cfg (true/compute = C-2 baseline, buffers),
wave_async_paused_ignore.cfg (false = B20, delivers), wave_async_paused_leaf.cfg
(true/leaf = B20 twin, delivers), wave_async_paused_resumeall.cfg (buffers).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Values, LockIds, MaxDispatch, Mode, IsLeaf

VARIABLES
  locks,       \* SUBSET LockIds — held pause locks; paused iff locks # {}
  pending,     \* BOOLEAN — an async result is in flight
  pendingVal,  \* Values \cup {-1}
  buffer,      \* Seq(Values) — results held while paused, awaiting RESUME
  delivered,   \* Seq(Values) — observable downstream trace
  dispatched   \* Nat — async ops dispatched so far (bound)

vars == <<locks, pending, pendingVal, buffer, delivered, dispatched>>
NONE == -1

\* D44: pausable mode is the OUTER gate over R-async-paused buffering.
ShouldBuffer ==
  \/ Mode = "resumeAll"
  \/ (Mode = "true" /\ ~IsLeaf)

TypeOK ==
  /\ locks      \in SUBSET LockIds
  /\ pending    \in BOOLEAN
  /\ pendingVal \in Values \cup {NONE}
  /\ buffer     \in Seq(Values)
  /\ delivered  \in Seq(Values)
  /\ dispatched \in 0..MaxDispatch

Init ==
  /\ locks      = {}
  /\ pending    = FALSE
  /\ pendingVal = NONE
  /\ buffer     = << >>
  /\ delivered  = << >>
  /\ dispatched = 0

\* An upstream wave dispatches an async computation on N.
Dispatch(v) ==
  /\ dispatched < MaxDispatch
  /\ ~pending
  /\ pending'    = TRUE
  /\ pendingVal' = v
  /\ dispatched' = dispatched + 1
  /\ UNCHANGED <<locks, buffer, delivered>>

\* Acquire a pause lock (idempotent on a held id).
Pause(l) ==
  /\ locks' = locks \cup {l}
  /\ UNCHANGED <<pending, pendingVal, buffer, delivered, dispatched>>

\* Release a lock. On final-lock release (lockset becomes empty), drain the
\* buffer to the sink in arrival order (R-async-paused replay). An unknown id
\* (not held) is a no-op.
Resume(l) ==
  /\ l \in locks
  /\ LET remaining == locks \ {l} IN
       /\ locks' = remaining
       /\ IF remaining = {}
            THEN /\ delivered' = delivered \o buffer
                 /\ buffer' = << >>
            ELSE /\ UNCHANGED <<delivered, buffer>>
  /\ UNCHANGED <<pending, pendingVal, dispatched>>

ResumeUnknown(l) ==
  /\ l \notin locks
  /\ UNCHANGED vars

\* The pool callback resolves while N is PAUSED and the mode/kind says buffer
\* (resumeAll, or true-mode compute node) → buffer it (do not deliver).
ResolveWhilePausedBuffer ==
  /\ pending
  /\ locks # {}
  /\ ShouldBuffer
  /\ buffer'     = Append(buffer, pendingVal)
  /\ pending'    = FALSE
  /\ pendingVal' = NONE
  /\ UNCHANGED <<locks, delivered, dispatched>>

\* The pool callback resolves while N is PAUSED but the mode/kind says DON'T
\* buffer (false = ignore PAUSE; or true-mode leaf source's own production) →
\* deliver immediately (D44 — keep producing through the PAUSE).
ResolveWhilePausedDeliver ==
  /\ pending
  /\ locks # {}
  /\ ~ShouldBuffer
  /\ delivered'  = Append(delivered, pendingVal)
  /\ pending'    = FALSE
  /\ pendingVal' = NONE
  /\ UNCHANGED <<locks, buffer, dispatched>>

\* The pool callback resolves while N is LIVE → deliver directly.
ResolveWhileLive ==
  /\ pending
  /\ locks = {}
  /\ delivered'  = Append(delivered, pendingVal)
  /\ pending'    = FALSE
  /\ pendingVal' = NONE
  /\ UNCHANGED <<locks, buffer, dispatched>>

Next ==
  \/ \E v \in Values : Dispatch(v)
  \/ \E l \in LockIds : Pause(l)
  \/ \E l \in LockIds : Resume(l)
  \/ \E l \in LockIds : ResumeUnknown(l)
  \/ ResolveWhilePausedBuffer
  \/ ResolveWhilePausedDeliver
  \/ ResolveWhileLive

Spec == Init /\ [][Next]_vars

\* ── Invariants ──
\* A buffered result implies N is currently paused — a result only sits in the
\* buffer while a lock is held; final-lock RESUME must have drained it. Catches
\* a RESUME that forgets to replay the buffer.
BufferImpliesPaused == buffer # << >> => locks # {}
\* No async result is dropped: every dispatched result is delivered, buffered,
\* or still pending — conservation across the paused boundary.
NoAsyncResultLost ==
  Len(delivered) + Len(buffer) + (IF pending THEN 1 ELSE 0) = dispatched
\* D44: when the mode/kind says "do not buffer" (false mode, or a true-mode leaf
\* source), the buffer is ALWAYS empty — the node delivers through PAUSE. Catches
\* a regression that buffers a pausable:false node (B20) or a true-mode leaf
\* source (B20's twin).
NoBufferWhenIgnoring == ~ShouldBuffer => buffer = << >>
=============================================================================
