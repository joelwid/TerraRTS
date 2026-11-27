import Phaser from 'phaser';
import { BUILDINGS, type BuildingType } from './data/buildings';
import frontier from './data/frontier.json';
import { loadMap } from './data/map';
import { addCameraControls, screenToWorld } from './input/camera';
import { drawColony } from './render/colony';
import { diamond, HALF_TILE_HEIGHT, HALF_TILE_WIDTH, pickTile, project } from './render/isometric';
import { drawTerrain } from './render/terrain';
import { SimulationClock } from './sim/clock';
import type { Footprint, Point } from './sim/grid';
import { World } from './sim/world';
import { ColonyHud } from './ui/hud';
import './style.css';

const map = loadMap(frontier);
const viewport = document.querySelector<HTMLElement>('#world')!;
document.querySelector('#map-name')!.textContent = map.name;

function outline(graphics: Phaser.GameObjects.Graphics, footprint: Footprint | undefined, color: number) {
  graphics.clear();
  if (!footprint) return;
  const points = diamond(footprint);
  graphics.fillStyle(color, 0.2).fillPoints(points, true);
  graphics.lineStyle(2, color).strokePoints(points, true);
}

class FrontierScene extends Phaser.Scene {
  private readonly clock = new SimulationClock();
  private readonly world = new World(map);
  private pan!: (deltaMs: number) => void;
  private hud!: ColonyHud;
  private territory!: Phaser.GameObjects.Graphics;
  private objects!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private selection!: Phaser.GameObjects.Graphics;
  private selected?: Point;
  private hovered?: Point;
  private plan?: BuildingType;
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
    this.territory = this.add.graphics().setDepth(-1);
    this.objects = this.add.graphics();
    this.selection = this.add.graphics().setDepth(1);
    this.hover = this.add.graphics().setDepth(2);
    this.hud = new ColonyHud((type) => {
      this.plan = this.plan === type ? undefined : type;
      this.hud.showFeedback();
      this.refreshHover();
    }, () => this.removeSelected(), () => this.toggleProduction(), this.world);
    this.refreshWorld();

    this.input.on(Phaser.Input.Events.GAME_OVER, () => { this.pointerInside = true; });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => { this.pointerInside = false; });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, () => { this.pointerInside = true; });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.clickTile(pickTile(screenToWorld(camera, pointer), map));
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.plan) {
        this.plan = undefined;
        this.refreshHover();
      } else {
        this.selected = undefined;
        this.refreshSelection();
      }
      this.hud.showFeedback();
    });
  }

  update(_time: number, deltaMs: number) {
    const revision = this.world.revision;
    const economyRevision = this.world.economyRevision;
    const tick = this.world.tick;
    this.clock.advance(deltaMs, () => this.world.step());
    if (revision !== this.world.revision) this.refreshWorld();
    else if (economyRevision !== this.world.economyRevision) this.refreshEconomy();
    if (tick !== this.world.tick) this.hud.showTick(this.world.tick, this.selectedBuilding());

    this.pan(deltaMs);
    const tile = this.pointerInside
      ? pickTile(screenToWorld(this.cameras.main, this.input.activePointer), map)
      : undefined;
    if (tile?.x !== this.hovered?.x || tile?.y !== this.hovered?.y) {
      this.hovered = tile;
      this.refreshHover();
    }
  }

  private clickTile(point?: Point) {
    if (this.plan && point) {
      const result = this.world.execute({ type: 'place', building: this.plan, anchor: point });
      if (!result.ok) {
        this.refreshHover();
        return;
      }
      this.hud.showFeedback();
      this.plan = undefined;
      this.selected = point;
      this.refreshWorld();
      return;
    }
    this.hud.showFeedback();
    this.selected = point;
    this.refreshSelection();
  }

  private selectedBuilding() {
    const id = this.selected && this.world.tileAt(this.selected)?.buildingId;
    return id === undefined ? undefined : this.world.building(id);
  }

  private removeSelected() {
    const building = this.selectedBuilding();
    if (!building) return;
    const result = this.world.execute({ type: building.complete ? 'demolish' : 'cancel', id: building.id });
    if (!result.ok) return;
    const name = BUILDINGS[building.type].name;
    this.hud.showFeedback(building.complete ? `${name} demolished.` : `${name} construction cancelled.`);
    this.refreshWorld();
  }

  private toggleProduction() {
    const building = this.selectedBuilding();
    if (!building?.production) return;
    this.world.execute({ type: 'pauseProduction', id: building.id, paused: !building.production.paused });
    this.refreshEconomy();
  }

  private refreshWorld() {
    drawColony(this.territory, this.objects, map, this.world);
    this.refreshEconomy();
  }

  private refreshEconomy() {
    this.hud.showProduction(this.world);
    this.hud.showStock(this.world.stock());
    this.refreshSelection();
    this.refreshHover();
  }

  private refreshSelection() {
    const building = this.selectedBuilding();
    const footprint = building?.footprint ?? (this.selected && { ...this.selected, width: 1, height: 1 });
    outline(this.selection, footprint, 0xffc674);
    this.hud.showSelection(this.world, this.selected);
  }

  private refreshHover() {
    if (this.plan && this.hovered) {
      const { footprint, issue } = this.world.preview(this.plan, this.hovered);
      outline(this.hover, footprint, issue ? 0xf48776 : 0xb3e68b);
      this.hud.showPlacement(this.plan, issue, true);
    } else {
      const footprint = this.hovered && { ...this.hovered, width: 1, height: 1 };
      outline(this.hover, footprint, 0xf6d8ae);
      this.hud.showPlacement(this.plan, undefined, false, this.hud.starterMessage(this.world));
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: viewport,
  backgroundColor: '#201713',
  fps: { smoothStep: false },
  scene: FrontierScene,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: viewport.clientWidth,
    height: viewport.clientHeight,
  },
});
