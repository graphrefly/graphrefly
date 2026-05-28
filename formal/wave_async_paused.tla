----------------------- MODULE wave_async_paused -----------------------
(***************************************************************************
GraphReFly — async-result arriving at a paused node (conformance C-2).

Pins R-async-paused (DR-3) + R-pause-lockset (D10). A node N has a pause
lockset and an async (LocalAsync pool) computation in flight. If N is paused
when the async result RESOLVES, the result enters N's pause buffer (it is NOT
delivered downstream); on final-lock RESUME the buffer drains to the sink. If
N is live (no locks) when the result resolves, it delivers directly. No async
result is ever dropped at a paused node.

Multi-lock: paused state = lockset.size > 0; releasing one of several locks
does not resume; an unknown-id RESUME is a no-op (R-pause-lockset).

Status: draft (flips active with the LocalAsync pool + PAUSE buffer impl, CSP-1).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Values, LockIds, MaxDispatch

VARIABLES
  locks,       \* SUBSET LockIds — held pause locks; paused iff locks # {}
  pending,     \* BOOLEAN — an async result is in flight
  pendingVal,  \* Values \cup {-1}
  buffer,      \* Seq(Values) — results resolved while paused, awaiting RESUME
  delivered,   \* Seq(Values) — observable downstream trace
  dispatched   \* Nat — async ops dispatched so far (bound)

vars == <<locks, pending, pendingVal, buffer, delivered, dispatched>>
NONE == -1

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

\* The pool callback resolves while N is PAUSED → buffer it (do not deliver).
ResolveWhilePaused ==
  /\ pending
  /\ locks # {}
  /\ buffer'     = Append(buffer, pendingVal)
  /\ pending'    = FALSE
  /\ pendingVal' = NONE
  /\ UNCHANGED <<locks, delivered, dispatched>>

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
  \/ ResolveWhilePaused
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
=============================================================================
