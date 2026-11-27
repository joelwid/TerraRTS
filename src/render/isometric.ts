import { contains, type Footprint, type Point, type Size } from '../sim/grid';

export const HALF_TILE_WIDTH = 32;
export const HALF_TILE_HEIGHT = 16;

export function project({ x, y }: Point): Point {
  return { x: (x - y) * HALF_TILE_WIDTH, y: (x + y) * HALF_TILE_HEIGHT };
}

export function unproject({ x, y }: Point): Point {
  return {
    x: x / (2 * HALF_TILE_WIDTH) + y / (2 * HALF_TILE_HEIGHT),
    y: y / (2 * HALF_TILE_HEIGHT) - x / (2 * HALF_TILE_WIDTH),
  };
}

export function pickTile(world: Point, size: Size): Point | undefined {
  const logical = unproject(world);
  const tile = { x: Math.floor(logical.x), y: Math.floor(logical.y) };
  return contains(size, tile) ? tile : undefined;
}

export function diamond({ x, y, width, height }: Footprint): [Point, Point, Point, Point] {
  return [
    project({ x, y }),
    project({ x: x + width, y }),
    project({ x: x + width, y: y + height }),
    project({ x, y: y + height }),
  ];
}

export function footprintDepth({ x, y, width, height }: Footprint): number {
  return project({ x: x + width, y: y + height }).y;
}

export interface DepthItem {
  id: string;
  depth: number;
  screenX: number;
}

export function compareDepth(a: DepthItem, b: DepthItem): number {
  return a.depth - b.depth || a.screenX - b.screenX || (a.id < b.id ? -1 : Number(a.id > b.id));
}
