import { contains, footprintTiles, tileIndex, type Footprint, type Size } from '../sim/grid';

type Resource = 'iron' | 'water' | 'silicon';
type NestSize = 'small' | 'medium' | 'large';

interface Deposit extends Footprint {
  readonly id: string;
  readonly resource: Resource;
}

interface NestSite extends Footprint {
  readonly id: string;
  readonly size: NestSize;
}

export interface Tile {
  readonly terrain: 'soil' | 'rock';
  readonly buildable: boolean;
  readonly walkable: boolean;
  readonly deposit?: Deposit;
}

export interface TerrainMap extends Size {
  readonly name: string;
  readonly start: Footprint;
  readonly rock: readonly Footprint[];
  readonly deposits: readonly Deposit[];
  readonly nestSites: readonly NestSite[];
  readonly tiles: readonly Tile[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, min: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Invalid ${label}`);
  return value;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function checkConnectivity(size: Size, tiles: readonly Tile[], start: Footprint): void {
  const queue = [{ x: start.x, y: start.y }];
  const visited = new Set([tileIndex(size, start)]);
  const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  for (const point of queue) {
    for (const direction of directions) {
      const next = { x: point.x + direction.x, y: point.y + direction.y };
      if (!contains(size, next)) continue;
      const index = tileIndex(size, next);
      if (visited.has(index) || !tiles[index]?.walkable) continue;
      visited.add(index);
      queue.push(next);
    }
  }
  if (visited.size !== tiles.filter((tile) => tile.walkable).length) {
    throw new Error('Walkable terrain must connect to the starting area');
  }
}

export function loadMap(value: unknown): TerrainMap {
  const raw = record(value, 'map');
  const name = string(raw.name, 'map name');
  const size = { width: integer(raw.width, 1, 'map width'), height: integer(raw.height, 1, 'map height') };
  const count = size.width * size.height;
  if (count > 65_536) throw new Error('Map exceeds 65,536 tiles');

  const tiles: Tile[] = Array.from({ length: count }, () => ({
    terrain: 'soil', buildable: true, walkable: true,
  }));
  const used = new Set<number>();
  const ids = new Set<string>();

  function reserve(entry: Record<string, unknown>, label: string): Footprint {
    const x = integer(entry.x, 0, label + ' x');
    const y = integer(entry.y, 0, label + ' y');
    const width = integer(entry.width, 1, label + ' width');
    const height = integer(entry.height, 1, label + ' height');
    if (width > size.width - x || height > size.height - y) {
      throw new Error(`${label} is outside the map`);
    }
    const footprint = { x, y, width, height };
    for (const point of footprintTiles(footprint)) {
      const index = tileIndex(size, point);
      if (used.has(index)) throw new Error(`${label} overlaps another feature`);
      used.add(index);
    }
    return footprint;
  }

  function uniqueId(entry: Record<string, unknown>): string {
    const id = string(entry.id, 'feature ID');
    if (ids.has(id)) throw new Error(`Duplicate feature ID: ${id}`);
    ids.add(id);
    return id;
  }

  const start = reserve(record(raw.start, 'start'), 'start');
  if (start.width !== 3 || start.height !== 3) throw new Error('Start must be 3×3');

  const rock = array(raw.rock, 'rock').map((value) => {
    const footprint = reserve(record(value, 'rock'), 'rock');
    for (const point of footprintTiles(footprint)) {
      tiles[tileIndex(size, point)] = { terrain: 'rock', buildable: false, walkable: false };
    }
    return footprint;
  });

  const deposits = array(raw.deposits, 'deposits').map((value): Deposit => {
    const entry = record(value, 'deposit');
    const id = uniqueId(entry);
    const footprint = reserve(entry, id);
    const resource = entry.resource;
    if (resource !== 'iron' && resource !== 'water' && resource !== 'silicon') {
      throw new Error(`Invalid resource for ${id}`);
    }
    if (footprint.width !== 2 || footprint.height !== 2) throw new Error(`${id} must be 2×2`);
    const deposit: Deposit = { ...footprint, id, resource };
    for (const point of footprintTiles(deposit)) {
      tiles[tileIndex(size, point)] = { terrain: 'soil', buildable: true, walkable: true, deposit };
    }
    return deposit;
  });

  const nestSites = array(raw.nestSites, 'nest sites').map((value): NestSite => {
    const entry = record(value, 'nest site');
    const id = uniqueId(entry);
    const size = entry.size;
    if (size !== 'small' && size !== 'medium' && size !== 'large') {
      throw new Error(`Invalid nest size for ${id}`);
    }
    return { ...reserve(entry, id), id, size };
  });

  checkConnectivity(size, tiles, start);
  return { ...size, name, start, rock, deposits, nestSites, tiles };
}
