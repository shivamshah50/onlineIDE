// Duplicated from server/realtime/yjsStore.js's colorFor() on purpose, same
// palette and same hash: computing this locally (rather than waiting on a
// round trip) means a person's own cursor color is correct the instant they
// join, and it matches the color presenceStore.js already assigned them for
// their presence tag, since the same userId through the same algorithm
// always lands on the same color.
const PALETTE = ['#c68fe8', '#7fdfc4', '#f3b37a', '#8fb8f5', '#f28fa5', '#b7e07f', '#f0d878'];

export function userColor(userId: string): string {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}