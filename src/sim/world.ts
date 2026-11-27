import { BUILDINGS, type BuildingType } from '../data/buildings';
import type { TerrainMap, Tile } from '../data/map';
import { contains, footprintTiles, tileIndex, type Footprint, type Point } from './grid';
import { Inventory, STARTING_STOCK, type Stock } from './inventory';
import { isClaimed, resolveClaims, tilesInRadius } from './territory';

interface Building {
  readonly id: number;
  readonly type: BuildingType;
  readonly footprint: Readonly<Footprint>;
  readonly original: boolean;
  readonly finishTick: number;
  readonly complete: boolean;
}

export interface BuildingView extends Building {
  readonly active: boolean;
  readonly remainingTicks: number;
}

interface TileView extends Omit<Tile, 'deposit'> {
  readonly claimed: boolean;
  readonly scanned: boolean;
  readonly fertile: boolean;
  readonly resource?: NonNullable<Tile['deposit']>['resource'];
  readonly buildingId?: number;
}

export type PlacementIssue = 'outside-map' | 'unbuildable' | 'occupied' | 'unclaimed' | 'insufficient-stock';
export type Placement = { footprint: Footprint; issue?: PlacementIssue };

export type Command =
  | { type: 'place'; building: BuildingType; anchor: Point }
  | { type: 'cancel' | 'demolish'; id: number };

type CommandResult =
  | { ok: true; id: number }
  | { ok: false; issue: PlacementIssue | 'missing-building' | 'original-hub' | 'wrong-stage' };

export class World {
  private readonly inventory: Inventory;
  private readonly buildings = new Map<number, Building>();
  private readonly occupancy = new Map<number, number>();
  private readonly scanned: Uint8Array;
  private readonly fertile: Uint8Array;
  private claims: Uint8Array;
  private connected = new Set<number>();
  private nextId = 1;
  private currentTick = 0;
  private stateRevision = 0;

  private readonly original: Building;

  constructor(private readonly map: TerrainMap, initialStock: Stock = STARTING_STOCK) {
    this.inventory = new Inventory(initialStock);
    this.scanned = new Uint8Array(map.tiles.length);
    this.fertile = new Uint8Array(map.tiles.length);
    this.claims = new Uint8Array(map.tiles.length);
    if (map.start.width !== BUILDINGS.hub.width || map.start.height !== BUILDINGS.hub.height) {
      throw new Error('Starting footprint must match the Hub definition');
    }
    this.original = this.addBuilding('hub', { ...map.start }, true);
    this.updateClaims();
  }

  get tick(): number { return this.currentTick; }
  get revision(): number { return this.stateRevision; }

  stock(): Stock {
    return this.inventory.snapshot();
  }

  tileAt(point: Point): TileView | undefined {
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !contains(this.map, point)) return;
    const index = tileIndex(this.map, point);
    const { terrain, buildable, walkable, deposit } = this.map.tiles[index]!;
    const buildingId = this.occupancy.get(index);
    const scanned = this.scanned[index] === 1;
    return {
      terrain, buildable, walkable: walkable && buildingId === undefined, buildingId,
      scanned, claimed: this.claims[index] === 1, fertile: this.fertile[index] === 1,
      resource: scanned ? deposit?.resource : undefined,
    };
  }

  building(id: number): BuildingView | undefined {
    const building = this.buildings.get(id);
    return building && this.view(building);
  }

  listBuildings(): BuildingView[] {
    return Array.from(this.buildings.values(), (building) => this.view(building));
  }

  preview(type: BuildingType, anchor: Point): Placement {
    const { x, y } = anchor;
    const { width, height, cost } = BUILDINGS[type];
    const footprint = { x, y, width, height };
    if (!Number.isInteger(x) || !Number.isInteger(y) || !contains(this.map, anchor) ||
        !contains(this.map, { x: x + width - 1, y: y + height - 1 })) {
      return { footprint, issue: 'outside-map' };
    }
    const indices = footprintTiles(footprint).map((tile) => tileIndex(this.map, tile));
    if (indices.some((index) => !this.map.tiles[index]?.buildable)) return { footprint, issue: 'unbuildable' };
    if (indices.some((index) => this.occupancy.has(index))) return { footprint, issue: 'occupied' };
    if (indices.some((index) => !this.claims[index])) return { footprint, issue: 'unclaimed' };
    if (!this.inventory.canPay(cost)) return { footprint, issue: 'insufficient-stock' };
    return { footprint };
  }

  execute(command: Command): CommandResult {
    if (command.type === 'place') {
      const { footprint, issue } = this.preview(command.building, command.anchor);
      if (issue) return { ok: false, issue };
      if (!this.inventory.pay(BUILDINGS[command.building].cost)) {
        return { ok: false, issue: 'insufficient-stock' };
      }
      const { id } = this.addBuilding(command.building, footprint, false);
      this.stateRevision++;
      return { ok: true, id };
    }

    const building = this.buildings.get(command.id);
    if (!building) return { ok: false, issue: 'missing-building' };
    if (building.original) return { ok: false, issue: 'original-hub' };
    if (building.complete !== (command.type === 'demolish')) return { ok: false, issue: 'wrong-stage' };

    this.buildings.delete(building.id);
    for (const tile of footprintTiles(building.footprint)) {
      this.occupancy.delete(tileIndex(this.map, tile));
    }
    const definition = BUILDINGS[building.type];
    this.inventory.refund(definition.cost, building.complete ? definition.demolitionRefund : 1);
    if (building.complete && building.type === 'hub') this.updateClaims();
    this.stateRevision++;
    return { ok: true, id: building.id };
  }

  step(): void {
    this.currentTick++;
    const completed: Building[] = [];
    for (const building of this.buildings.values()) {
      if (building.complete || building.finishTick !== this.currentTick) continue;
      const finished = { ...building, complete: true };
      this.buildings.set(finished.id, finished);
      completed.push(finished);
    }
    if (completed.length === 0) return;

    // Resolve territory before one-shot effects when multiple buildings finish on one tick.
    if (completed.some((building) => building.type === 'hub')) this.updateClaims();
    for (const building of completed) {
      if (building.type === 'hub' || !this.active(building)) continue;
      const { radius } = BUILDINGS[building.type];
      for (const index of tilesInRadius(this.map, building.footprint, radius)) {
        if (building.type === 'scanner') this.scanned[index] = 1;
        else if (this.claims[index] && this.map.tiles[index]?.buildable) this.fertile[index] = 1;
      }
    }
    this.stateRevision++;
  }

  private addBuilding(type: BuildingType, footprint: Footprint, original: boolean): Building {
    const id = this.nextId++;
    const building = {
      id, type, footprint, original, complete: original,
      finishTick: original ? this.currentTick : this.currentTick + BUILDINGS[type].duration,
    };
    this.buildings.set(id, building);
    for (const tile of footprintTiles(footprint)) this.occupancy.set(tileIndex(this.map, tile), id);
    return building;
  }

  private active(building: Building): boolean {
    if (!building.complete) return false;
    return building.type === 'hub'
      ? this.connected.has(building.id)
      : isClaimed(this.map, this.claims, building.footprint);
  }

  private view(building: Building): BuildingView {
    return {
      ...building, footprint: { ...building.footprint },
      active: this.active(building),
      remainingTicks: Math.max(0, building.finishTick - this.currentTick),
    };
  }

  private updateClaims(): void {
    const expansions = Array.from(this.buildings.values()).filter(
      (building) => building.type === 'hub' && building.complete && !building.original,
    );
    const { claims, connected } = resolveClaims(this.map, this.original, expansions, BUILDINGS.hub.radius);
    this.claims = claims;
    this.connected = connected;
    claims.forEach((claimed, index) => {
      if (claimed) this.scanned[index] = 1;
    });
  }
}
