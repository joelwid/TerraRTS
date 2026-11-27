export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Footprint extends Point, Size {}

export function contains({ width, height }: Size, { x, y }: Point): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function tileIndex({ width }: Size, { x, y }: Point): number {
  return y * width + x;
}

export function footprintTiles({ x, y, width, height }: Footprint): Point[] {
  const points: Point[] = [];
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) {
      points.push({ x: column, y: row });
    }
  }
  return points;
}
