import Phaser from 'phaser';
import type { Point } from '../sim/grid';

const PAN_PIXELS_PER_SECOND = 560;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export function screenToWorld(camera: Phaser.Cameras.Scene2D.Camera, screen: Point): Point {
  const halfWidth = camera.width / 2;
  const halfHeight = camera.height / 2;
  return {
    x: camera.scrollX + halfWidth + (screen.x - halfWidth) / camera.zoom,
    y: camera.scrollY + halfHeight + (screen.y - halfHeight) / camera.zoom,
  };
}

export function addCameraControls(scene: Phaser.Scene, bounds: Phaser.Geom.Rectangle) {
  const camera = scene.cameras.main;
  const keyboard = scene.input.keyboard!;
  const arrows = keyboard.createCursorKeys();
  const { W, A, S, D } = keyboard.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

  function constrain() {
    const centerX = camera.scrollX + camera.width / 2;
    const centerY = camera.scrollY + camera.height / 2;
    camera.centerOn(
      Phaser.Math.Clamp(centerX, bounds.left, bounds.right),
      Phaser.Math.Clamp(centerY, bounds.top, bounds.bottom),
    );
  }

  // Keep the same world point centered when the window or HUD changes size.
  const onResize = (
    _gameSize: Phaser.Structs.Size, baseSize: Phaser.Structs.Size, _displaySize: Phaser.Structs.Size,
    previousWidth: number, previousHeight: number,
  ) => {
    camera.scrollX += (previousWidth - baseSize.width) / 2;
    camera.scrollY += (previousHeight - baseSize.height) / 2;
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
  });

  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (
    pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number,
  ) => {
    const before = screenToWorld(camera, pointer);
    camera.setZoom(Phaser.Math.Clamp(camera.zoom * Math.exp(-dy * 0.0015), MIN_ZOOM, MAX_ZOOM));
    const after = screenToWorld(camera, pointer);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    constrain();
  });

  return (deltaMs: number) => {
    const x = Number(arrows.right.isDown || D.isDown) - Number(arrows.left.isDown || A.isDown);
    const y = Number(arrows.down.isDown || S.isDown) - Number(arrows.up.isDown || W.isDown);
    if (x === 0 && y === 0) return;

    const distance = PAN_PIXELS_PER_SECOND * deltaMs / (1000 * camera.zoom * Math.hypot(x, y));
    camera.scrollX += x * distance;
    camera.scrollY += y * distance;
    constrain();
  };
}
