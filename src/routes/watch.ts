import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import type { PodScopeAlias } from '../pod/types.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { eventsSince, subscribeWatch, type WatchEvent, type WatchEventType, type WatchPattern } from '../services/watch-events.js';
import { evaluateAccess } from 'smartware';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const EVENT_TYPES = new Set<WatchEventType>(['compile', 'revise', 'forget', 'contradict']);
function sendHttpError(socket: Duplex, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function acceptWebSocket(request: IncomingMessage, socket: Duplex): boolean {
  const key = request.headers['sec-websocket-key'];
  if (!key || Array.isArray(key)) return false;
  const accept = crypto.createHash('sha1').update(`${key}${WS_GUID}`).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ].join('\r\n'));
  return true;
}

function parseList(value: string | null): string[] {
  return (value ?? '').split(',').map(part => part.trim()).filter(Boolean);
}

function parsePattern(url: URL, scope: string): WatchPattern {
  const eventTypes = parseList(url.searchParams.get('event_types'))
    .filter((value): value is WatchEventType => EVENT_TYPES.has(value as WatchEventType));
  return {
    scope,
    targets: parseList(url.searchParams.get('targets')),
    event_types: eventTypes.length > 0 ? eventTypes : undefined,
  };
}

function encodePingFrame(): Buffer {
  // PR-11 / D1: WebSocket Ping (opcode 0x9), empty payload.
  return Buffer.from([0x89, 0x00]);
}

function encodeTextFrame(payload: string): Buffer {
  const body = Buffer.from(payload, 'utf8');
  if (body.length < 126) return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  if (body.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(body.length), 2);
  return Buffer.concat([header, body]);
}

function sendEvent(socket: Duplex, event: WatchEvent): void {
  socket.write(encodeTextFrame(JSON.stringify({ event })));
}

export async function registerWatchRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const clients = new Set<Duplex>();
  app.server.on('upgrade', (request, socket) => {
    void handleUpgrade(request, socket, env, clients).catch(() => {
      sendHttpError(socket, 500, 'Internal Server Error');
    });
  });
  app.addHook('onClose', async () => {
    for (const client of clients) client.destroy();
    clients.clear();
  });
}

async function handleUpgrade(request: IncomingMessage, socket: Duplex, env: CoffeePodEnv, clients: Set<Duplex>): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  if (url.pathname !== '/pod/watch') return sendHttpError(socket, 404, 'Not Found');

  const actorId = url.searchParams.get('actor_id');
  if (!actorId) return sendHttpError(socket, 400, 'Bad Request');

  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const alias = url.searchParams.get('scope_alias') as PodScopeAlias | null;
  const scope = url.searchParams.get('scope')
    ?? (alias ? profile.scopes[alias] : undefined)
    ?? profile.scopes.workspace;

  // PR-24 / WT-04: ACCESS-gate the subscription. Actor must have at
  // least one read-capable grant on the requested scope; otherwise the
  // upgrade is refused. The substrate's evaluateAccess returns
  // 'actor_unregistered' or 'forbidden' which we map to 401/403.
  const access = evaluateAccess(actorId, 'read', scope, core.getConfig());
  if (access.decision === 'deny') {
    const status = access.code === 'actor_unregistered' ? 401 : 403;
    const message = access.code === 'actor_unregistered' ? 'Unauthorized' : 'Forbidden';
    return sendHttpError(socket, status, message);
  }

  const pattern = parsePattern(url, scope);

  const unsubscribe = subscribeWatch(pattern, event => sendEvent(socket, event));
  if (!acceptWebSocket(request, socket)) {
    unsubscribe();
    return sendHttpError(socket, 400, 'Bad Request');
  }
  clients.add(socket);

  // PR-19 / WT-03: reconnection redelivery. If the client supplied
  // `last_event_id` in the upgrade query, replay every buffered event
  // newer than it that matches the subscription pattern. Best-effort
  // (RING_BUFFER_SIZE bounded); the client treats event_id as the
  // resume cursor.
  const lastEventId = url.searchParams.get('last_event_id');
  if (lastEventId) {
    const missed = eventsSince(lastEventId, pattern);
    for (const event of missed) sendEvent(socket, event);
  }

  // PR-11 / D1: heartbeat every 30s per transport-bindings v0.1.1.
  // Server sends a Ping; client is expected to Pong (browsers auto-respond).
  // unref() so the timer doesn't keep the event loop alive on shutdown.
  const heartbeat = setInterval(() => {
    try {
      socket.write(encodePingFrame());
    } catch {
      // socket already closed; cleanup will fire
    }
  }, 30_000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    clients.delete(socket);
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('data', data => {
    const frame = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const opcode = frame[0]! & 0x0f;
    if (opcode === 0x08) {
      // Close frame
      socket.end();
    }
    // 0x0A = Pong; 0x09 = Ping (client → server, we should reply but
    // skip for now — most browsers don't send unsolicited pings).
    // Other opcodes ignored.
  });
}
