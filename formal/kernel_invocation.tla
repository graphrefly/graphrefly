------------------------- MODULE kernel_invocation -------------------------
(***************************************************************************
D808 / R-invocation@3: dependency-read capability belongs to one invocation,
including its setup and function execution, not to the lifetime. A saved ctx
or DepView cannot be read after return, even while a newer invocation runs.
Ordinary copied data and lifetime down/state/signal are outside this read guard.
Two invocations, all phases and old/current handles are exhaustively explored.
The two constants are mutation switches; both are FALSE in the normal config.
***************************************************************************)
EXTENDS Naturals, TLC
CONSTANTS AllowExpired, ReviveOld
VARIABLE k
vars == <<k>>
Init == k = [call |-> 0, phase |-> "idle", badRead |-> FALSE, deniedCurrent |-> FALSE]
Enter == /\ k.phase = "idle" /\ k.call < 2
         /\ k' = [k EXCEPT !.call = @ + 1, !.phase = "setup"]
Function == /\ k.phase = "setup" /\ k' = [k EXCEPT !.phase = "function"]
Return == /\ k.phase = "function" /\ k' = [k EXCEPT !.phase = "idle"]
Read == /\ k.call > 0
        /\ \E saved \in 1..k.call :
             LET active == k.phase \in {"setup", "function"}
                 valid == active /\ saved = k.call
                 allowed == valid \/ AllowExpired \/ (ReviveOld /\ active)
             IN k' = [k EXCEPT !.badRead = @ \/ (allowed /\ ~valid),
                               !.deniedCurrent = @ \/ (valid /\ ~allowed)]
Next == Enter \/ Function \/ Return \/ Read
Spec == Init /\ [][Next]_vars
InvocationOnly == ~k.badRead
CurrentReadable == ~k.deniedCurrent
=============================================================================
