import { describe, expect, it } from 'vitest';
import frontier from '../src/data/frontier.json';
import { loadMap } from '../src/data/map';
import { footprintTiles, tileIndex } from '../src/sim/grid';

describe('handcrafted map', () => {
  it('loads the connected 96×96 terrain with stable, uniform deposit footprints', () => {
    const map = loadMap(frontier);
    expect([map.width, map.height, map.tiles.length]).toEqual([96, 96, 9216]);
    expect(map.nestSites.map(({ id, size }) => [id, size])).toEqual([['east', 'small'], ['south', 'large']]);
    expect(map.tiles[tileIndex(map, map.start)]).toMatchObject({ terrain: 'soil', walkable: true });
    expect(map.tiles[tileIndex(map, { x: 12, y: 12 })]).toEqual({
      terrain: 'rock', walkable: false, buildable: false,
    });
    for (const deposit of map.deposits) {
      expect(footprintTiles(deposit)).toHaveLength(4);
      for (const point of footprintTiles(deposit)) {
        expect(map.tiles[tileIndex(map, point)]?.deposit).toBe(deposit);
      }
    }
    expect(map.tiles.filter((tile) => tile.deposit)).toHaveLength(map.deposits.length * 4);
  });

  it('rejects out-of-bounds and noninteger footprints', () => {
    expect(() => loadMap({ ...frontier, start: { ...frontier.start, x: 95 } })).toThrow(/outside/);
    expect(() => loadMap({ ...frontier, start: { ...frontier.start, y: 1.5 } })).toThrow(/start y/);
  });

  it('rejects overlap across feature types', () => {
    expect(() => loadMap({ ...frontier, rock: [frontier.start] })).toThrow(/overlaps/);
  });

  it('rejects duplicate deposit IDs, invalid resources and partial footprints', () => {
    const deposit = frontier.deposits[0]!;
    expect(() => loadMap({ ...frontier, deposits: [deposit, { ...deposit, x: 1 }] })).toThrow(/Duplicate/);
    expect(() => loadMap({ ...frontier, deposits: [{ ...deposit, resource: 'gold' }] })).toThrow(/Invalid resource/);
    expect(() => loadMap({ ...frontier, deposits: [{ ...deposit, width: 1 }] })).toThrow(/2×2/);
  });

  it('rejects a deposit isolated from the start by an impassable strip', () => {
    expect(() => loadMap({
      name: 'Divided',
      width: 8,
      height: 5,
      start: { x: 0, y: 0, width: 3, height: 3 },
      rock: [{ x: 3, y: 0, width: 1, height: 5 }],
      deposits: [{ id: 'isolated', resource: 'iron', x: 4, y: 0, width: 2, height: 2 }],
      nestSites: [],
    })).toThrow(/connect to the starting area/);
  });
});
