import { BACKEND_URL, refreshAccessToken } from './api';

// The wire shape of a LiveEventMessage as serialized by the backend. System.Text.Json uses PascalCase by default
// (no string-enum converter on this path), so EventType arrives as a number in `data:` — the reliable type
// discriminator is the SSE `event:` line (the LiveEventType enum NAME). We read keys defensively for either casing.
type LiveEventMessageWire = {
  EventType?: number | string;
  Channel?: string;
  PayloadJson?: string;
  EventId?: string | null;
  OccurredAtUtc?: string | null;
  eventType?: number | string;
  channel?: string;
  payloadJson?: string;
  eventId?: string | null;
  occurredAtUtc?: string | null;
};

export type LiveEvent = {
  /** LiveEventType enum name, e.g. "SiteAlertRaised" — taken from the SSE `event:` line. */
  type: string;
  channel: string;
  /** Parsed PayloadJson (object), or the raw string if it was not JSON. */
  payload: unknown;
  eventId?: string | null;
  occurredAtUtc?: string | null;
};

type StreamStatus = 'connecting' | 'open' | 'closed';

type StreamArgs = {
  token: string;
  signal: AbortSignal;
  onEvent: (event: LiveEvent) => void;
  onStatusChange?: (status: StreamStatus) => void;
};

// Opens the scope-filtered /events/me SSE stream via fetch streaming. EventSource can't send an Authorization header
// and the endpoint requires a Bearer token, so we stream the ReadableStream and parse SSE frames by hand. Performs a
// one-shot silent token refresh on a 401, then resolves when the server closes the stream (caller handles reconnect).
export async function streamLiveEvents({ token, signal, onEvent, onStatusChange }: StreamArgs): Promise<void> {
  onStatusChange?.('connecting');
  let bearer = token;

  const open = (accessToken: string) =>
    fetch(`${BACKEND_URL}/events/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'text/event-stream' },
      signal,
      cache: 'no-store',
    });

  let response = await open(bearer);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed && refreshed !== bearer) {
      bearer = refreshed;
      response = await open(bearer);
    }
  }

  if (!response.ok || !response.body) {
    onStatusChange?.('closed');
    throw new Error(`SSE stream failed (${response.status})`);
  }

  onStatusChange?.('open');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. Tolerate CRLF as well as LF.
      let boundary = nextFrameBoundary(buffer);
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const event = parseFrame(frame);
        if (event) onEvent(event);
        boundary = nextFrameBoundary(buffer);
      }
    }
  } finally {
    onStatusChange?.('closed');
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }
}

function nextFrameBoundary(buffer: string): { index: number; length: number } | -1 {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf === -1 && crlf === -1) return -1;
  if (crlf !== -1 && (lf === -1 || crlf < lf)) return { index: crlf, length: 4 };
  return { index: lf, length: 2 };
}

function parseFrame(frame: string): LiveEvent | null {
  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const rawLine of frame.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue; // blank or comment (heartbeat)
    if (line.startsWith('event:')) eventName = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trimStart());
  }

  if (dataLines.length === 0) return null;

  try {
    const message = JSON.parse(dataLines.join('\n')) as LiveEventMessageWire;
    const payloadJson = message.PayloadJson ?? message.payloadJson;
    let payload: unknown = null;
    if (payloadJson) {
      try {
        payload = JSON.parse(payloadJson);
      } catch {
        payload = payloadJson;
      }
    }
    return {
      type: eventName ?? String(message.EventType ?? message.eventType ?? 'Unknown'),
      channel: message.Channel ?? message.channel ?? '',
      payload,
      eventId: message.EventId ?? message.eventId ?? null,
      occurredAtUtc: message.OccurredAtUtc ?? message.occurredAtUtc ?? null,
    };
  } catch {
    return null;
  }
}
