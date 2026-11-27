import { describe, expect, it } from 'vitest';
import type { BuildingType } from '../src/data/buildings';
import frontier from '../src/data/frontier.json';
import { loadMap } from '../src/data/map';
import type { Point } from '../src/sim/grid';
import { STARTING_STOCK } from '../src/sim/inventory';
import { World, type PlacementIssue } from '../src/sim/world';

const map = loadMap(frontier);
const expansion = { x: 52, y: 47 };

function place(world: World, building: BuildingType, anchor: Point): number {
  const result = world.execute({ type: 'place', building, anchor });
  if (!result.ok) throw new Error(`Could not place ${building}: ${result.issue}`);
  return result.id;
}

function step(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.step();
}

describe('construction', () => {
  it('starts with a free protected Hub that claims and scans immediately', () => {
    const world = new World(map);
    const [original] = world.listBuildings();
    expect(original).toMatchObject({ type: 'hub', original: true, active: true, complete: true });
    expect(world.stock()).toEqual(STARTING_STOCK);
    expect(world.tileAt(map.start)).toMatchObject({ buildingId: original!.id, claimed: true, scanned: true, walkable: false });
    expect(world.tileAt({ x: 39, y: 48 })?.claimed).toBe(true);
    expect(world.tileAt({ x: 39, y: 47 })?.claimed).toBe(false);
    expect(world.tileAt({ x: 42, y: 47 })?.resource).toBe('iron');
    expect(world.execute({ type: 'demolish', id: original!.id })).toEqual({ ok: false, issue: 'original-hub' });
    expect(world.execute({ type: 'cancel', id: original!.id })).toEqual({ ok: false, issue: 'original-hub' });
  });

  it.each<[BuildingType, Point, PlacementIssue]>([
    ['hub', { x: 95, y: 95 }, 'outside-map'],
    ['scanner', { x: 46.5, y: 48 }, 'outside-map'],
    ['scanner', { x: 55, y: 42 }, 'unbuildable'],
    ['hub', { x: 45, y: 47 }, 'occupied'],
    ['hub', { x: 53, y: 47 }, 'unclaimed'],
  ])('rejects %s at %j with %s in preview and execution', (building, anchor, issue) => {
    const world = new World(map);
    expect(world.preview(building, anchor).issue).toBe(issue);
    expect(world.execute({ type: 'place', building, anchor })).toEqual({ ok: false, issue });
    expect(world.stock()).toEqual(STARTING_STOCK);
    expect(world.listBuildings()).toHaveLength(1);
  });

  it('charges upfront, reserves the entire footprint immediately and refuses an unaffordable second Hub', () => {
    const world = new World(map);
    expect(world.preview('hub', expansion)).toEqual({ footprint: { ...expansion, width: 3, height: 3 } });
    const id = place(world, 'hub', expansion);
    expect(world.building(id)).toMatchObject({ remainingTicks: 300, complete: false, active: false });
    expect(world.stock()).toMatchObject({ wood: 40, iron: 10, tools: 20 });
    expect(world.tileAt({ x: 54, y: 49 })).toMatchObject({ buildingId: id, walkable: false });
    expect(world.preview('scanner', { x: 54, y: 49 }).issue).toBe('occupied');
    const anchor = { x: 41, y: 47 };
    expect(world.preview('hub', anchor).issue).toBe('insufficient-stock');
    expect(world.execute({ type: 'place', building: 'hub', anchor })).toEqual({ ok: false, issue: 'insufficient-stock' });
    expect(world.stock()).toMatchObject({ wood: 40, iron: 10, tools: 20 });
  });

  it('refunds a cancelled site exactly once, releases occupancy and suppresses its effect', () => {
    const world = new World(map);
    const anchor = { x: 45, y: 45 };
    const id = place(world, 'scanner', anchor);
    step(world, 49);
    expect(world.execute({ type: 'demolish', id })).toEqual({ ok: false, issue: 'wrong-stage' });
    expect(world.execute({ type: 'cancel', id })).toEqual({ ok: true, id });
    expect(world.preview('scanner', anchor).issue).toBeUndefined();
    expect(world.tileAt(anchor)).toMatchObject({ walkable: true, buildingId: undefined });
    expect(world.execute({ type: 'cancel', id })).toEqual({ ok: false, issue: 'missing-building' });
    expect(world.stock()).toEqual(STARTING_STOCK);
    step(world, 2);
    expect(world.tileAt({ x: 46, y: 28 })?.scanned).toBe(false);
    expect(place(world, 'scanner', anchor)).toBeGreaterThan(id);
  });

  it('advances each build independently on fixed ticks', () => {
    const world = new World(map);
    const scanner = place(world, 'scanner', { x: 45, y: 45 });
    const terraformer = place(world, 'terraformer', { x: 45, y: 46 });
    step(world, 49);
    expect(world.building(scanner)?.remainingTicks).toBe(1);
    expect(world.building(terraformer)?.remainingTicks).toBe(51);
    world.step();
    expect(world.building(scanner)?.active).toBe(true);
    expect(world.building(terraformer)?.active).toBe(false);
    expect(world.execute({ type: 'cancel', id: scanner })).toEqual({ ok: false, issue: 'wrong-stage' });
    expect(world.execute({ type: 'demolish', id: scanner })).toEqual({ ok: true, id: scanner });
    step(world, 50);
    expect(world.building(terraformer)?.active).toBe(true);
    expect(world.stock()).toMatchObject({ wood: 85, tools: 43 });
  });
});

describe('territory and permanent effects', () => {
  it('retains overlapping claims when an expansion Hub is demolished and refunds half', () => {
    const world = new World(map);
    const overlap = { x: 51, y: 48 };
    const exclusive = { x: 58, y: 48 };
    const hub = place(world, 'hub', expansion);
    step(world, 299);
    expect(world.tileAt(exclusive)).toMatchObject({ claimed: false, scanned: false });
    world.step();
    expect(world.tileAt(exclusive)).toMatchObject({ claimed: true, scanned: true });
    expect(world.tileAt(overlap)?.claimed).toBe(true);
    expect(world.execute({ type: 'demolish', id: hub })).toEqual({ ok: true, id: hub });
    expect(world.tileAt(overlap)).toMatchObject({ claimed: true, scanned: true });
    expect(world.tileAt(exclusive)).toMatchObject({ claimed: false, scanned: true });
    expect(world.stock()).toMatchObject({ wood: 70, iron: 25, tools: 35 });
    expect(world.execute({ type: 'demolish', id: hub })).toEqual({ ok: false, issue: 'missing-building' });
    expect(world.stock()).toMatchObject({ wood: 70, iron: 25, tools: 35 });
  });

  it('disconnects downstream Hubs and buildings, then restores them when the link is rebuilt', () => {
    const world = new World(map, { ...STARTING_STOCK, wood: 250, iron: 150, tools: 150 });
    const first = place(world, 'hub', expansion);
    step(world, 300);
    const second = place(world, 'hub', { x: 58, y: 47 });
    const scanner = place(world, 'scanner', { x: 56, y: 48 });
    step(world, 300);
    expect(world.building(second)?.active).toBe(true);
    expect(world.building(scanner)?.active).toBe(true);
    expect(world.tileAt({ x: 66, y: 48 })?.claimed).toBe(true);
    world.execute({ type: 'demolish', id: first });
    expect(world.building(second)).toMatchObject({ active: false, complete: true });
    expect(world.building(scanner)?.active).toBe(false);
    expect(world.tileAt({ x: 58, y: 47 })?.buildingId).toBe(second);
    expect(world.tileAt({ x: 66, y: 48 })).toMatchObject({ claimed: false, scanned: true });
    place(world, 'hub', expansion);
    step(world, 300);
    expect(world.building(second)?.active).toBe(true);
    expect(world.building(scanner)?.active).toBe(true);
    expect(world.tileAt({ x: 66, y: 48 })?.claimed).toBe(true);
  });

  it('hides unscanned deposits and keeps scanner knowledge after demolition', () => {
    const world = new World(map);
    const deposit = { x: 46, y: 28 };
    const anchor = { x: 45, y: 45 };
    const scanner = place(world, 'scanner', anchor);
    step(world, 49);
    expect(world.tileAt(deposit)).toMatchObject({ resource: undefined, claimed: false, scanned: false });
    world.step();
    expect(world.tileAt(deposit)).toMatchObject({ resource: 'silicon', claimed: false, scanned: true });
    expect(world.tileAt({ x: 45, y: 25 })?.scanned).toBe(true);
    expect(world.tileAt({ x: 45, y: 24 })?.scanned).toBe(false);
    world.execute({ type: 'demolish', id: scanner });
    expect(world.tileAt(deposit)).toMatchObject({ resource: 'silicon', claimed: false, scanned: true });
  });

  it('fertilizes only claimed soil at completion and retains fertility after demolition and claim loss', () => {
    const world = new World(map);
    const hub = place(world, 'hub', expansion);
    step(world, 200);
    const terraformer = place(world, 'terraformer', { x: 54, y: 45 });
    const soil = { x: 58, y: 45 };
    const rock = { x: 55, y: 42 };
    const unclaimed = { x: 57, y: 41 };
    step(world, 99);
    expect(world.tileAt(soil)?.fertile).toBe(false);
    world.step();
    expect(world.tileAt(soil)).toMatchObject({ fertile: true, claimed: true });
    expect(world.tileAt(rock)).toMatchObject({ fertile: false, claimed: true });
    expect(world.tileAt(unclaimed)).toMatchObject({ fertile: false, claimed: false });
    world.execute({ type: 'demolish', id: terraformer });
    expect(world.tileAt(soil)?.fertile).toBe(true);
    world.execute({ type: 'demolish', id: hub });
    expect(world.tileAt(soil)).toMatchObject({ fertile: true, claimed: false, scanned: true });
    expect(world.stock()).toMatchObject({ wood: 60, tools: 30 });
  });

  it('allows a disconnected site to finish without firing its one-time effect', () => {
    const world = new World(map, { ...STARTING_STOCK, wood: 200, iron: 100, tools: 100 });
    const deposit = { x: 51, y: 31 };
    const first = place(world, 'hub', expansion);
    step(world, 300);
    const scanner = place(world, 'scanner', { x: 58, y: 48 });
    world.execute({ type: 'demolish', id: first });
    step(world, 50);
    expect(world.building(scanner)).toMatchObject({ active: false, complete: true });
    expect(world.tileAt(deposit)?.scanned).toBe(false);
    place(world, 'hub', expansion);
    step(world, 300);
    expect(world.building(scanner)?.active).toBe(true);
    expect(world.tileAt(deposit)?.scanned).toBe(false);
  });

  it('applies terraforming once and leaves tiles claimed after completion unchanged', () => {
    const world = new World(map);
    const tile = { x: 58, y: 48 };
    place(world, 'terraformer', { x: 54, y: 46 });
    step(world, 100);
    expect(world.tileAt(tile)).toMatchObject({ claimed: false, fertile: false });
    place(world, 'hub', expansion);
    step(world, 300);
    expect(world.tileAt(tile)).toMatchObject({ claimed: true, fertile: false });
  });
});
