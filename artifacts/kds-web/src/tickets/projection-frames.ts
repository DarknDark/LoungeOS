export type Projection = {
  resource: "table-sessions" | "orders" | "notifications";
  type: "added" | "modified" | "removed";
};

/**
 * Parses complete "event: projection\ndata: {...}\n\n" frames out of a
 * streaming text buffer, returning any parsed projections plus the
 * unparsed remainder (a partial frame still being received).
 *
 * Extracted as a pure function from the XHR streaming logic so the parsing
 * behavior itself can be unit-tested without a real HTTP connection.
 */
export function parseProjectionFrames(buffer: string): {
  projections: Projection[];
  remainder: string;
} {
  const frames = buffer.split(/\r?\n\r?\n/);
  const remainder = frames.pop() ?? "";
  const projections: Projection[] = [];

  for (const frame of frames) {
    const eventName = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const data = frame.match(/^data:\s*(.+)$/m)?.[1]?.trim();
    if (eventName !== "projection" || !data) continue;
    try {
      const projection = JSON.parse(data) as Projection;
      if (projection.resource && projection.type) {
        projections.push(projection);
      }
    } catch {
      // Ignore malformed stream frames; polling remains the fallback.
    }
  }

  return { projections, remainder };
}
