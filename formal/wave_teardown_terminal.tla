---------------------- MODULE wave_teardown_terminal ----------------------
(***************************************************************************
GraphReFly -- TEARDOWN relays through terminal intermediates (D65 / B33).

A -> B -> C. B may already be terminal when TEARDOWN arrives from A. Terminal
seals value output but does not drop TEARDOWN, which is a destroy/unwire signal.
 ***************************************************************************)
EXTENDS Sequences, TLC

CONSTANT InitiallyTerminal

VARIABLES bTerminal, bReceivedTeardown, queueToC, cTrace, resurrected

vars == <<bTerminal, bReceivedTeardown, queueToC, cTrace, resurrected>>

TypeOK ==
  /\ InitiallyTerminal \in BOOLEAN
  /\ bTerminal \in BOOLEAN
  /\ bReceivedTeardown \in BOOLEAN
  /\ queueToC \in Seq({"COMPLETE","TEARDOWN"})
  /\ cTrace \in Seq({"COMPLETE","TEARDOWN"})
  /\ resurrected \in BOOLEAN

Init ==
  /\ bTerminal = InitiallyTerminal
  /\ bReceivedTeardown = FALSE
  /\ queueToC = <<>>
  /\ cTrace = <<>>
  /\ resurrected = FALSE

ReceiveTeardownAtB ==
  /\ ~bReceivedTeardown
  /\ bReceivedTeardown' = TRUE
  /\ IF bTerminal
       THEN /\ queueToC' = Append(queueToC, "TEARDOWN")
            /\ bTerminal' = bTerminal
       ELSE /\ queueToC' = Append(Append(queueToC, "COMPLETE"), "TEARDOWN")
            /\ bTerminal' = TRUE
  /\ resurrected' = FALSE
  /\ UNCHANGED cTrace

DeliverToC ==
  /\ queueToC # <<>>
  /\ cTrace' = Append(cTrace, Head(queueToC))
  /\ queueToC' = Tail(queueToC)
  /\ UNCHANGED <<bTerminal, bReceivedTeardown, resurrected>>

Next == ReceiveTeardownAtB \/ DeliverToC \/ UNCHANGED vars
Spec == Init /\ [][Next]_vars

TerminalRelaysTeardown == (bReceivedTeardown /\ queueToC = <<>>) => "TEARDOWN" \in {cTrace[i] : i \in DOMAIN cTrace}
AlreadyTerminalDoesNotRecomplete == InitiallyTerminal => ~("COMPLETE" \in {cTrace[i] : i \in DOMAIN cTrace})
NoResurrection == ~resurrected /\ (bReceivedTeardown => bTerminal)
=============================================================================
