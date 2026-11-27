import { describe, expect, it } from 'vitest';
import { compareDepth, diamond, footprintDepth, pickTile, project, unproject } from '../src/render/isometric';

describe('isometric projection', () => {
  it('creates a 64×32 diamond and round-trips logical coordinates', () => {
    expect(diamond({ x: 0, y: 0, width: 1, height: 1 })).toEqual([
      { x: 0, y: 0 }, { x: 32, y: 16 }, { x: 0, y: 32 }, { x: -32, y: 16 },
    ]);
    for (const point of [{ x: 0, y: 0 }, { x: 95, y: 95 }, { x: 47.5, y: 22.25 }, { x: -3, y: 12 }]) {
      expect(unproject(project(point))).toEqual(point);
    }
  });

  it('picks the correct diamond and rejects points beyond all four edges', () => {
    const size = { width: 96, height: 96 };
    for (const point of [{ x: 0, y: 0 }, { x: 95, y: 95 }, { x: 72, y: 12 }]) {
      expect(pickTile(project({ x: point.x + 0.5, y: point.y + 0.5 }), size)).toEqual(point);
    }
    expect(pickTile(project({ x: 1, y: 0.5 }), size)).toEqual({ x: 1, y: 0 });
    for (const point of [{ x: -0.01, y: 12 }, { x: 12, y: -0.01 }, { x: 96, y: 12 }, { x: 12, y: 96 }]) {
      expect(pickTile(project(point), size)).toBeUndefined();
    }
  });

  it('orders overlapping projected landmarks by the footprint front edge', () => {
    const rear = { x: 4, y: 4, width: 3, height: 3 };
    const front = { x: 6, y: 7, width: 1, height: 1 };
    // At this height the marker's roof projects above the rear footprint's front edge.
    expect(project(front).y - 36).toBeLessThan(footprintDepth(rear));
    const items = [
      { id: 'front', depth: footprintDepth(front), screenX: project(front).x },
      { id: 'rear', depth: footprintDepth(rear), screenX: project(rear).x },
    ];
    expect(items.sort(compareDepth).map(({ id }) => id)).toEqual(['rear', 'front']);
  });

  it('breaks equal depth ties by screen X and then stable ID', () => {
    expect([
      { id: 'c', depth: 32, screenX: 0 },
      { id: 'a', depth: 32, screenX: 32 },
      { id: 'b', depth: 32, screenX: 0 },
    ].sort(compareDepth).map(({ id }) => id)).toEqual(['b', 'c', 'a']);
  });
});
