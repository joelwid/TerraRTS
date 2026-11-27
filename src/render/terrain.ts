import Phaser from 'phaser';
import type { TerrainMap } from '../data/map';
import { tileIndex } from '../sim/grid';
import { diamond } from './isometric';

const CHUNK_SIZE = 16;
const SOIL = ['#624131', '#674635', '#694837', '#6d4a37'];
const ROCK = ['#4b3933', '#503d36', '#543f36', '#58443a'];
const GROUND_DEPTH = -2;

export function drawTerrain(scene: Phaser.Scene, map: TerrainMap): void {
  for (let y = 0; y < map.height; y += CHUNK_SIZE) {
    for (let x = 0; x < map.width; x += CHUNK_SIZE) {
      const width = Math.min(CHUNK_SIZE, map.width - x);
      const height = Math.min(CHUNK_SIZE, map.height - y);
      const [top, right, bottom, left] = diamond({ x, y, width, height });
      // A one-pixel border keeps edge strokes intact between cached chunks.
      const offsetX = left.x - 1;
      const offsetY = top.y - 1;
      const texture = scene.textures.createCanvas(
        `terrain-${x}-${y}`, right.x - offsetX + 1, bottom.y - offsetY + 1,
      )!;
      const context = texture.getContext();
      context.translate(-offsetX, -offsetY);
      context.strokeStyle = 'rgba(28, 17, 13, .55)';
      for (let row = y; row < y + height; row++) {
        for (let column = x; column < x + width; column++) {
          const points = diamond({ x: column, y: row, width: 1, height: 1 });
          const tile = map.tiles[tileIndex(map, { x: column, y: row })]!;
          const palette = tile.terrain === 'rock' ? ROCK : SOIL;
          context.beginPath();
          points.forEach((point, i) => {
            if (i === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
          });
          context.closePath();
          context.fillStyle = palette[(column * 11 + row * 29 + column * row) & 3]!;
          context.fill();
          context.stroke();
        }
      }
      texture.refresh();
      scene.add.image(offsetX, offsetY, texture.key).setOrigin(0).setDepth(GROUND_DEPTH);
    }
  }
}
