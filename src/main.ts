import Phaser from 'phaser';
import frontier from './data/frontier.json';
import { loadMap } from './data/map';
import { addCameraControls, screenToWorld } from './input/camera';
import { diamond, HALF_TILE_HEIGHT, HALF_TILE_WIDTH, pickTile, project } from './render/isometric';
import { drawLandmarks, drawTerrain } from './render/terrain';
import { SimulationClock } from './sim/clock';
import { tileIndex, type Point } from './sim/grid';
import './style.css';

const map = loadMap(frontier);
const world = document.querySelector<HTMLElement>('#world')!;
const selection = document.querySelector<HTMLOutputElement>('#selection')!;
const tickOutput = document.querySelector('#tick')!;
document.querySelector('#map-name')!.textContent = map.name;

function outline(graphics: Phaser.GameObjects.Graphics, tile: Point | undefined, color: number) {
  graphics.clear();
  if (!tile) return;
  const points = diamond({ ...tile, width: 1, height: 1 });
  graphics.fillStyle(color, 0.2).fillPoints(points, true);
  graphics.lineStyle(2, color).strokePoints(points, true);
}

class FrontierScene extends Phaser.Scene {
  private readonly clock = new SimulationClock();
  private pan!: (deltaMs: number) => void;
  private hover!: Phaser.GameObjects.Graphics;
  private hovered?: Point;
  private pointerInside = false;

  create() {
    const camera = this.cameras.main;
    const start = project({ x: map.start.x + map.start.width / 2, y: map.start.y + map.start.height / 2 });
    camera.centerOn(start.x, start.y);
    const bounds = new Phaser.Geom.Rectangle(
      -map.height * HALF_TILE_WIDTH,
      0,
      (map.width + map.height) * HALF_TILE_WIDTH,
      (map.width + map.height) * HALF_TILE_HEIGHT,
    );
    this.pan = addCameraControls(this, bounds);
    drawTerrain(this, map);
    drawLandmarks(this, map);
    this.hover = this.add.graphics().setDepth(-1);
    // Keep the selected tile outline visible when a landmark overhangs it.
    const selected = this.add.graphics().setDepth(Number.MAX_SAFE_INTEGER);

    this.input.on(Phaser.Input.Events.GAME_OVER, () => { this.pointerInside = true; });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => { this.pointerInside = false; });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, () => { this.pointerInside = true; });

    const select = (point?: Point) => {
      outline(selected, point, 0xffc674);
      const tile = point && map.tiles[tileIndex(map, point)];
      selection.value = point && tile
        ? `Tile (${point.x}, ${point.y}) · ${tile.terrain === 'rock' ? 'Rock' : 'Soil'}`
        : 'No tile selected';
    };
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) select(pickTile(screenToWorld(camera, pointer), map));
    });
    this.input.keyboard!.on('keydown-ESC', () => select());
  }

  update(_time: number, deltaMs: number) {
    this.clock.advance(deltaMs, (tick) => { tickOutput.textContent = String(tick); });
    this.pan(deltaMs);
    const tile = this.pointerInside
      ? pickTile(screenToWorld(this.cameras.main, this.input.activePointer), map)
      : undefined;
    if (tile?.x !== this.hovered?.x || tile?.y !== this.hovered?.y) {
      this.hovered = tile;
      outline(this.hover, tile, 0xf6d8ae);
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: world,
  backgroundColor: '#201713',
  fps: { smoothStep: false },
  scene: FrontierScene,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: world.clientWidth,
    height: world.clientHeight,
  },
});
