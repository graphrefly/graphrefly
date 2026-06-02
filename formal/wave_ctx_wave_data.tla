---------------------- MODULE wave_ctx_wave_data ----------------------
(***************************************************************************
GraphReFly -- raw ctx waveData + lightweight terminal metadata contract (D77/D78 / C-23).

The fn input view has one canonical dep-value surface: ctx.waveData.
waveData[dep] is a list of wave projections; each inner sequence corresponds
to one upstream msgs array / wave (D8).

Encoding modeled here:

  * no delivered wave this invocation: <<>>
  * RESOLVED-only wave: << <<>> >>
  * DATA(null): << <<"NULL">> >>
  * DATA([]): << <<"EMPTY_ARRAY">> >>
  * one wave [[DATA,1],[DATA,2],[INVALIDATE]]:
      << <<"ONE", "TWO", "SENTINEL">> >>

"SENTINEL" models the per-language sentinel marker used for INVALIDATE inside
waveData (TS undefined; Rust/Py sentinel equivalent). DATA(SENTINEL) is already
illegal by R-data-payload, so this marker cannot collide with legal DATA.

Terminal metadata is modeled as a parallel lightweight slot:

  * "none": no COMPLETE/ERROR delivered to this dep slot this invocation (TS raw ctx: false)
  * "complete": COMPLETE delivered (TS raw ctx: true)
  * "errorPayload": ERROR(payload) delivered

R-data-payload rejects ERROR(false) and ERROR(true), so the false/true terminal
shorthand cannot collide with legal ERROR payloads.
 ***************************************************************************)
EXTENDS Naturals, Sequences, TLC

Deps == {"A"}
Cases == {
  "none",
  "resolved",
  "dataNull",
  "dataEmptyArray",
  "dataInvalidate",
  "terminalComplete",
  "terminalErrorPayload"
}
WaveItem == {"ONE", "TWO", "NULL", "EMPTY_ARRAY", "SENTINEL"}
TerminalSlot == {"none", "complete", "errorPayload"}

VARIABLES picked, waveData, terminal

vars == <<picked, waveData, terminal>>

TypeOK ==
  /\ picked \in Cases \cup {"init"}
  /\ waveData \in [Deps -> Seq(Seq(WaveItem))]
  /\ terminal \in [Deps -> TerminalSlot]

Init ==
  /\ picked = "init"
  /\ waveData = [d \in Deps |-> <<>>]
  /\ terminal = [d \in Deps |-> "none"]

PickNone ==
  /\ picked = "init"
  /\ picked' = "none"
  /\ waveData' = [d \in Deps |-> <<>>]
  /\ terminal' = [d \in Deps |-> "none"]

PickResolved ==
  /\ picked = "init"
  /\ picked' = "resolved"
  /\ waveData' = [d \in Deps |-> << <<>> >>]
  /\ terminal' = [d \in Deps |-> "none"]

PickDataNull ==
  /\ picked = "init"
  /\ picked' = "dataNull"
  /\ waveData' = [d \in Deps |-> << <<"NULL">> >>]
  /\ terminal' = [d \in Deps |-> "none"]

PickDataEmptyArray ==
  /\ picked = "init"
  /\ picked' = "dataEmptyArray"
  /\ waveData' = [d \in Deps |-> << <<"EMPTY_ARRAY">> >>]
  /\ terminal' = [d \in Deps |-> "none"]

PickDataInvalidate ==
  /\ picked = "init"
  /\ picked' = "dataInvalidate"
  /\ waveData' = [d \in Deps |-> << <<"ONE", "TWO", "SENTINEL">> >>]
  /\ terminal' = [d \in Deps |-> "none"]

PickTerminalComplete ==
  /\ picked = "init"
  /\ picked' = "terminalComplete"
  /\ waveData' = [d \in Deps |-> <<>>]
  /\ terminal' = [d \in Deps |-> "complete"]

PickTerminalErrorPayload ==
  /\ picked = "init"
  /\ picked' = "terminalErrorPayload"
  /\ waveData' = [d \in Deps |-> <<>>]
  /\ terminal' = [d \in Deps |-> "errorPayload"]

Next ==
  PickNone \/ PickResolved \/ PickDataNull \/ PickDataEmptyArray \/ PickDataInvalidate
  \/ PickTerminalComplete \/ PickTerminalErrorPayload
  \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

NoWaveIsEmptyOuter ==
  picked = "none" => waveData["A"] = <<>>

ResolvedIsOneEmptyInnerWave ==
  picked = "resolved" => waveData["A"] = << <<>> >>

NullDataIsOneInnerItem ==
  picked = "dataNull" => waveData["A"] = << <<"NULL">> >>

EmptyArrayDataIsNotResolved ==
  picked = "dataEmptyArray" =>
    /\ waveData["A"] = << <<"EMPTY_ARRAY">> >>
    /\ waveData["A"] # << <<>> >>

DataInvalidateSameWaveKeepsOrder ==
  picked = "dataInvalidate" => waveData["A"] = << <<"ONE", "TWO", "SENTINEL">> >>

CasesAreDistinguishable ==
  /\ (picked = "resolved" => waveData["A"] # <<>>)
  /\ (picked = "dataNull" => waveData["A"] # <<>> /\ waveData["A"] # << <<>> >>)
  /\ (picked = "dataEmptyArray" => waveData["A"] # <<>> /\ waveData["A"] # << <<>> >>)
  /\ (picked = "dataInvalidate" => waveData["A"] # <<>> /\ waveData["A"] # << <<>> >>)

TerminalCompleteIsTrueShorthand ==
  picked = "terminalComplete" =>
    /\ waveData["A"] = <<>>
    /\ terminal["A"] = "complete"

TerminalErrorPayloadIsDistinctFromFalseTrueShorthand ==
  picked = "terminalErrorPayload" =>
    /\ waveData["A"] = <<>>
    /\ terminal["A"] = "errorPayload"
    /\ terminal["A"] # "none"
    /\ terminal["A"] # "complete"

TerminalDoesNotEnterWaveData ==
  picked \in {"terminalComplete", "terminalErrorPayload"} => waveData["A"] = <<>>

=============================================================================
