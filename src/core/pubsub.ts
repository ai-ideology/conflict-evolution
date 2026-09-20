/**
 * 迷你发布订阅（学习 ncase/trust 的 MinPubSub）
 * 用于 slide 之间、引擎与 UI 之间的解耦通信。
 */

type Handler = (data?: unknown) => void;

const channels = new Map<string, Set<Handler>>();

export function subscribe(event: string, handler: Handler): () => void {
  let set = channels.get(event);
  if (!set) {
    set = new Set();
    channels.set(event, set);
  }
  set.add(handler);
  return () => set.delete(handler);
}

export function publish(event: string, data?: unknown): void {
  const set = channels.get(event);
  if (!set) return;
  for (const handler of [...set]) handler(data);
}

export function unsubscribeAll(event: string): void {
  channels.delete(event);
}
