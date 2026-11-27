import { footprintTiles, tileIndex, type Footprint, type Size } from './grid';

export function* tilesInRadius(size: Size, footprint: Footprint, radius: number): Iterable<number> {
  const x = footprint.x + footprint.width / 2 - 0.5;
  const y = footprint.y + footprint.height / 2 - 0.5;
  for (let row = Math.max(0, Math.ceil(y - radius)); row <= Math.min(size.height - 1, y + radius); row++) {
    for (let col = Math.max(0, Math.ceil(x - radius)); col <= Math.min(size.width - 1, x + radius); col++) {
      if ((col - x) ** 2 + (row - y) ** 2 <= radius ** 2) {
        yield tileIndex(size, { x: col, y: row });
      }
    }
  }
}

export function isClaimed(size: Size, claims: Uint8Array, footprint: Footprint): boolean {
  return footprintTiles(footprint).every((tile) => claims[tileIndex(size, tile)] === 1);
}

interface Hub {
  readonly id: number;
  readonly footprint: Footprint;
}

export function resolveClaims(size: Size, origin: Hub, expansions: readonly Hub[], radius: number) {
  const claims = new Uint8Array(size.width * size.height);
  const connected = new Set<number>();

  function connect(hub: Hub) {
    connected.add(hub.id);
    for (const index of tilesInRadius(size, hub.footprint, radius)) claims[index] = 1;
  }

  connect(origin);
  // Grow from the original Hub until no other complete footprint can be supported.
  let previousCount: number;
  do {
    previousCount = connected.size;
    for (const hub of expansions) {
      if (!connected.has(hub.id) && isClaimed(size, claims, hub.footprint)) connect(hub);
    }
  } while (connected.size > previousCount);

  return { claims, connected };
}
