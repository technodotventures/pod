import { EventEmitter } from 'node:events';
import { ulid } from 'ulid';

export type WatchEventType = 'compile' | 'revise' | 'forget' | 'contradict';

export interface WatchEvent {
  id: string;
  type: WatchEventType;
  scope: string;
  target?: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface WatchPattern {
  scope: string;
  targets?: string[];
  event_types?: WatchEventType[];
}

const globalKey = Symbol.for('coffee-pod.watch-events');
const globalStore = globalThis as typeof globalThis & {
  [globalKey]?: EventEmitter;
  [bufferKey]?: WatchEvent[];
};
const emitter = globalStore[globalKey] ?? new EventEmitter();
globalStore[globalKey] = emitter;
emitter.setMaxListeners(100);

// PR-19 / D1: in-memory replay buffer for reconnection redelivery (WT-03).
// On reconnect, the client supplies last_event_id; we replay any newer
// events still in the buffer. Bounded to RING_BUFFER_SIZE most recent
// events; older events are unrecoverable (clients should reconnect
// promptly).
const RING_BUFFER_SIZE = 500;
const bufferKey = Symbol.for('coffee-pod.watch-events-buffer');
const buffer = globalStore[bufferKey] ?? [];
globalStore[bufferKey] = buffer;

function pushBuffer(event: WatchEvent): void {
  buffer.push(event);
  while (buffer.length > RING_BUFFER_SIZE) buffer.shift();
}

/**
 * Return every buffered event newer than `last_event_id`, in order.
 * Used by /pod/watch when a reconnecting client supplies it.
 */
export function eventsSince(last_event_id: string | null, pattern: WatchPattern): WatchEvent[] {
  if (!last_event_id) return [];
  const idx = buffer.findIndex((e) => e.id === last_event_id);
  if (idx < 0) return []; // event aged out; client has lost continuity
  const targetSet = new Set(pattern.targets ?? []);
  const typeSet = new Set(pattern.event_types ?? []);
  return buffer.slice(idx + 1).filter((event) => {
    if (event.scope !== pattern.scope) return false;
    if (typeSet.size > 0 && !typeSet.has(event.type)) return false;
    if (targetSet.size > 0 && (!event.target || !targetSet.has(event.target))) return false;
    return true;
  });
}

export function publishWatchEvent(input: Omit<WatchEvent, 'id' | 'occurred_at'> & { occurred_at?: string }): WatchEvent {
  const event: WatchEvent = {
    id: `evt_${ulid()}`,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    type: input.type,
    scope: input.scope,
    target: input.target,
    payload: input.payload,
  };
  pushBuffer(event);
  emitter.emit('event', event);
  return event;
}

export function subscribeWatch(pattern: WatchPattern, listener: (event: WatchEvent) => void): () => void {
  const targetSet = new Set(pattern.targets ?? []);
  const typeSet = new Set(pattern.event_types ?? []);
  const wrapped = (event: WatchEvent) => {
    if (event.scope !== pattern.scope) return;
    if (typeSet.size > 0 && !typeSet.has(event.type)) return;
    if (targetSet.size > 0 && (!event.target || !targetSet.has(event.target))) return;
    listener(event);
  };
  emitter.on('event', wrapped);
  return () => emitter.off('event', wrapped);
}
