import { getStaffIdToken } from '@/services/firebase-client';

type Projection = {
  resource: 'table-sessions' | 'orders' | 'notifications';
  type: 'added' | 'modified' | 'removed';
};

type StaffRealtimeOptions = {
  clubId: string;
  onProjection: (projection: Projection) => void;
};

/**
 * Keeps the staff projection current without putting Firestore credentials or
 * operational records in the mobile bundle. The API stream emits identifiers
 * only; the existing protected query remains the source of projection data.
 */
export function startStaffRealtime({
  clubId,
  onProjection,
}: StaffRealtimeOptions): () => void {
  let stopped = false;
  let request: XMLHttpRequest | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = async () => {
    const token = await getStaffIdToken();
    if (stopped || !token) return;

    const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : '';
    const nextRequest = new XMLHttpRequest();
    request = nextRequest;
    let cursor = 0;
    let buffer = '';

    const handleChunk = () => {
      const text = nextRequest.responseText.slice(cursor);
      cursor = nextRequest.responseText.length;
      buffer += text;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const event of events) {
        const eventName = event.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const data = event.match(/^data:\s*(.+)$/m)?.[1]?.trim();
        if (eventName !== 'projection' || !data) continue;
        try {
          const projection = JSON.parse(data) as Projection;
          if (projection.resource && projection.type) onProjection(projection);
        } catch {
          // Ignore malformed stream frames; the HTTP fallback remains active.
        }
      }
    };

    const retry = () => {
      if (!stopped && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void connect();
        }, 5_000);
      }
    };

    nextRequest.open('GET', `${baseUrl}/api/v1/staff/realtime`);
    nextRequest.setRequestHeader('Accept', 'text/event-stream');
    nextRequest.setRequestHeader('Authorization', `Bearer ${token}`);
    nextRequest.setRequestHeader('X-Club-Id', clubId);
    nextRequest.onprogress = handleChunk;
    nextRequest.onerror = retry;
    nextRequest.onload = retry;
    nextRequest.send();
  };

  void connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    request?.abort();
    request = undefined;
  };
}