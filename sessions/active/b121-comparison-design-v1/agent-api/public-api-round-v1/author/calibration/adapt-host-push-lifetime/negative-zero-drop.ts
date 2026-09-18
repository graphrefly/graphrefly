import type { Graph } from "@graphrefly/ts/graph";
import type { Node } from "@graphrefly/ts/core";
import { fromPushNotification, type PushRegister } from "@graphrefly/ts/sources";
export function connectPushNumbers(graph: Graph, register: PushRegister<number>, onValue: (value: number) => void): { source: Node<number>; stop: () => void } {
  const source = graph.initNode(fromPushNotification<number>(register), []);
  const unsubscribe = source.subscribe(message => {
    if (message[0] === "DATA" && message[1]) onValue(message[1] as number);
  });
  let stopped = false;
  return { source, stop() { if (!stopped) { stopped = true; unsubscribe(); } } };
}
