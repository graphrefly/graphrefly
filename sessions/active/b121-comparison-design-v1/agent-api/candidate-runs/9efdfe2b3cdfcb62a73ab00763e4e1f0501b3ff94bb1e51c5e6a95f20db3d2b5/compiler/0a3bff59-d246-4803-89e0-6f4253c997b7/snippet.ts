import { fromPushNotification } from "@graphrefly/ts/sources";
import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
import type { PushRegister } from "@graphrefly/ts/sources";

export function connectPushNumbers(
  graph: Graph,
  register: PushRegister<number>,
  onValue: (value: number) => void,
): { source: Node<number>; stop: () => void } {
  // Adapt the caller's push registration into a graph-registered source node.
  // fromPushNotification owns delivery + teardown only; the host owns the transport.
  const source = graph.initNode(fromPushNotification<number>(register), [], {
    name: "pushNumbers",
  });

  // Our own subscription: it activates the source (register runs once on activation)
  // and forwards only DATA payloads (0 included) to onValue.
  const detach = source.subscribe((msg) => {
    if (msg[0] === "DATA") onValue(msg[1] as number);
  });

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    detach();
  };

  return { source, stop };
}
