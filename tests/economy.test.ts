import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingType } from '../src/data/buildings';
import frontier from '../src/data/frontier.json';
import { loadMap } from '../src/data/map';
import { TICKS_PER_MINUTE } from '../src/sim/clock';
import type { Point } from '../src/sim/grid';
import { Inventory, RESOURCES, STARTING_STOCK } from '../src/sim/inventory';
import { Production } from '../src/sim/production';
import { World } from '../src/sim/world';

const map = loadMap(frontier);
const forestry = { x: 42, y: 42 };
const terraformer = { x: 45, y: 46 };
const iron = { x: 42, y: 47 };
const smith = { x: 49, y: 44 };

function place(world: World, building: BuildingType, anchor: Point): number {
  const result = world.execute({ type: 'place', building, anchor });
  if (!result.ok) throw new Error(`Could not place ${building} at ${anchor.x},${anchor.y}: ${result.issue}`);
  return result.id;
}

function step(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.step();
}

describe('economy placement', () => {
  it('accepts only the complete matching deposit and handles adjacent deposit IDs', () => {
    const adjacent = { id: 'neighbor', resource: 'iron', x: 40, y: 47, width: 2, height: 2 };
    const world = new World(loadMap({ ...frontier, deposits: [...frontier.deposits, adjacent] }));
    expect(world.preview('ironMine', adjacent).issue).toBeUndefined();
    expect(world.preview('ironMine', iron).issue).toBeUndefined();
    for (const anchor of [{ x: 41, y: 47 }, { x: 43, y: 47 }, { x: 42, y: 48 }, { x: 43, y: 44 }]) {
      expect(world.preview('ironMine', anchor).issue).toBe('requires-matching-deposit');
      expect(world.execute({ type: 'place', building: 'ironMine', anchor })).toEqual({
        ok: false, issue: 'requires-matching-deposit',
      });
    }
    expect(world.preview('waterTower', iron).issue).toBe('requires-matching-deposit');
    expect(world.preview('waterTower', { x: 50, y: 49 }).issue).toBeUndefined();
    expect(world.preview('siliconMine', { x: 46, y: 28 }).issue).toBe('unclaimed');
    expect(world.tileAt({ x: 46, y: 28 })?.resource).toBeUndefined();
    expect(world.stock()).toEqual(STARTING_STOCK);
    place(world, 'ironMine', iron);
    expect(world.preview('ironMine', iron).issue).toBe('occupied');
  });

  it('requires all sixteen agriculture tiles to be fertile', () => {
    const world = new World(map);
    expect(world.preview('forestry', forestry).issue).toBe('requires-fertile-soil');
    const id = place(world, 'terraformer', terraformer);
    step(world, 100);
    world.execute({ type: 'demolish', id });
    expect(world.tileAt({ x: 42, y: 42 })?.fertile).toBe(true);
    expect(world.tileAt({ x: 45, y: 41 })?.fertile).toBe(true);
    expect(world.tileAt({ x: 44, y: 41 })?.fertile).toBe(false);
    expect(world.preview('farm', { x: 44, y: 41 }).issue).toBe('requires-fertile-soil');
    expect(world.preview('forestry', forestry).issue).toBeUndefined();
    expect(world.preview('farm', forestry).issue).toBeUndefined();
  });
});

describe('batch production', () => {
  it('does not count outputs toward paying for the same transaction', () => {
    const inventory = new Inventory({ ...STARTING_STOCK, iron: 0 });
    expect(inventory.transact({ wood: 1, iron: 1 }, { iron: 1, tools: 1 })).toBe(false);
    expect(inventory.snapshot()).toEqual({ ...STARTING_STOCK, iron: 0 });
    expect(inventory.transact({ wood: 1 }, { iron: 1 })).toBe(true);
    expect(inventory.transact({ wood: 1, iron: 1 }, { tools: 1 })).toBe(true);
    expect(inventory.snapshot()).toMatchObject({ wood: 98, iron: 0, tools: 51 });
  });

  it('waits without taking partial inputs and resumes as soon as a due batch is affordable', () => {
    const world = new World(map);
    const blacksmith = place(world, 'blacksmith', smith);
    place(world, 'hub', { x: 52, y: 47 });
    step(world, 100);
    place(world, 'ironMine', iron);
    step(world, 220);
    expect(world.building(blacksmith)?.production?.status).toBe('shortage');
    expect(world.stock()).toMatchObject({ wood: 10, iron: 0, tools: 10 });
    expect(world.productionOverview()).toMatchObject({ gross: { tools: 5 }, actual: { tools: 0 }, net: { iron: 0 } });
    step(world, 39);
    expect(world.stock()).toMatchObject({ wood: 10, iron: 0, tools: 10 });
    world.step();
    expect(world.building(blacksmith)?.production?.status).toBe('running');
    expect(world.stock()).toMatchObject({ wood: 9, iron: 0, tools: 11 });
    expect(world.productionOverview()).toMatchObject({
      actual: { iron: 1, tools: 1 }, consumed: { iron: 1, wood: 1 }, net: { iron: 0, wood: -1 },
    });
  });

  it('preserves manual pause progress, excludes paused capacity and expires historical rates', () => {
    const world = new World(map);
    const mine = place(world, 'ironMine', iron);
    expect(world.execute({ type: 'pauseProduction', id: mine, paused: true })).toMatchObject({ issue: 'wrong-stage' });
    step(world, 230);
    expect(world.productionOverview().gross.iron).toBe(10);
    world.execute({ type: 'pauseProduction', id: mine, paused: true });
    step(world, 100);
    expect(world.building(mine)?.production?.status).toBe('paused');
    expect(world.productionOverview().gross.iron).toBe(0);
    expect(world.stock().iron).toBe(40);
    world.execute({ type: 'pauseProduction', id: mine, paused: false });
    step(world, 29);
    expect(world.stock().iron).toBe(40);
    world.step();
    expect(world.stock().iron).toBe(41);
    world.execute({ type: 'demolish', id: mine });
    expect(world.stock()).toMatchObject({ wood: 96, tools: 48 });
    expect(world.productionOverview().actual.iron).toBe(1);
    step(world, TICKS_PER_MINUTE);
    expect(world.productionOverview().actual.iron).toBe(0);
    expect(world.stock().iron).toBe(41);
  });

  it('allocates scarce input deterministically and gives the waiting producer the next batch', () => {
    const world = new World(map, { ...STARTING_STOCK, iron: 21 });
    const first = place(world, 'blacksmith', smith);
    const second = place(world, 'blacksmith', { x: 49, y: 46 });
    step(world, 90);
    place(world, 'ironMine', iron);
    step(world, 230);
    expect(world.building(first)?.production?.status).toBe('running');
    expect(world.building(second)?.production?.status).toBe('shortage');
    expect(world.stock()).toMatchObject({ iron: 0, tools: 36 });
    step(world, 30);
    expect(world.building(second)?.production?.status).toBe('running');
    expect(world.stock()).toMatchObject({ iron: 0, tools: 37 });
  });

  it('lets an older larger batch accumulate input without charging partial stock', () => {
    const inventory = new Inventory({ ...STARTING_STOCK, iron: 0 });
    const production = new Production(inventory);
    const interval = { interval: 1, batchesPerMinute: TICKS_PER_MINUTE };
    production.add(1, { ...interval, inputs: {}, outputs: { iron: 1 } });
    production.add(2, { ...interval, inputs: { iron: 2 }, outputs: { weapons: 1 } });
    production.add(3, { ...interval, inputs: { iron: 1 }, outputs: { tools: 1 } });
    const active = () => true;
    production.step(1, active);
    expect(inventory.snapshot()).toMatchObject({ iron: 1, weapons: 0, tools: 50 });
    production.step(2, active);
    expect(inventory.snapshot()).toMatchObject({ iron: 0, weapons: 1, tools: 50 });
    production.step(3, active);
    expect(inventory.snapshot()).toMatchObject({ iron: 0, weapons: 1, tools: 51 });
  });

  it('suspends production when a Hub link is lost and resumes on reclamation', () => {
    const world = new World(map, { ...STARTING_STOCK, wood: 200, iron: 100, tools: 100 });
    const anchor = { x: 52, y: 47 };
    const hub = place(world, 'hub', anchor);
    step(world, 300);
    const factory = place(world, 'factory', { x: 56, y: 47 });
    step(world, 250);
    expect(world.building(factory)?.production?.status).toBe('running');
    world.execute({ type: 'demolish', id: hub });
    expect(world.building(factory)?.production?.status).toBe('inactive');
    step(world, 600);
    expect(world.productionOverview().gross.chips).toBe(0);
    place(world, 'hub', anchor);
    step(world, 300);
    expect(world.building(factory)?.production?.status).toBe('running');
    expect(world.productionOverview().gross.chips).toBe(5);
    step(world, 120);
    expect(world.building(factory)?.production?.status).toBe('shortage');
  });
});

function buildWhenAffordable(world: World, type: BuildingType, anchor: Point): number {
  const limit = world.tick + 20 * TICKS_PER_MINUTE;
  while (world.preview(type, anchor).issue === 'insufficient-stock' && world.tick < limit) world.step();
  return place(world, type, anchor);
}

function bootstrap(world: World): void {
  place(world, 'terraformer', terraformer);
  place(world, 'ironMine', iron);
  step(world, 100);
  place(world, 'forestry', forestry);
  buildWhenAffordable(world, 'blacksmith', smith);
}

describe('fresh-start economy', () => {
  it('supports an early Hub detour and recovers its initial wood shortfall', () => {
    const world = new World(map);
    place(world, 'hub', { x: 46, y: 41 });
    bootstrap(world);
    step(world, 2 * TICKS_PER_MINUTE);
    expect(world.productionOverview().net).toMatchObject({ wood: 5, iron: 5, tools: 5 });
    expect(world.stock().tools).toBeGreaterThan(0);
  });

  it('recovers from spending all startup wood using the normal Hub demolition refund', () => {
    const world = new World(map);
    place(world, 'terraformer', terraformer);
    place(world, 'ironMine', iron);
    const blacksmith = place(world, 'blacksmith', smith);
    const hub = place(world, 'hub', { x: 52, y: 47 });
    step(world, 320);
    expect(world.stock().wood).toBe(0);
    expect(world.building(blacksmith)?.production?.status).toBe('shortage');
    expect(world.preview('forestry', forestry).issue).toBe('insufficient-stock');
    expect(world.execute({ type: 'demolish', id: hub })).toEqual({ ok: true, id: hub });
    place(world, 'forestry', forestry);
    step(world, 2 * TICKS_PER_MINUTE);
    expect(world.productionOverview().net).toMatchObject({ wood: 5, iron: 5, tools: 5 });
  });

  it('builds all eight producers and sustains every recipe with the unmodified starting inventory', () => {
    const world = new World(map);
    bootstrap(world);
    place(world, 'waterTower', { x: 50, y: 49 });
    place(world, 'terraformer', { x: 49, y: 51 });
    step(world, 100);
    place(world, 'farm', { x: 45, y: 50 });

    for (const anchor of [{ x: 46, y: 41 }, { x: 46, y: 35 }, { x: 48, y: 29 }]) {
      buildWhenAffordable(world, 'hub', anchor);
      step(world, BUILDINGS.hub.duration);
    }
    buildWhenAffordable(world, 'ironMine', { x: 51, y: 31 });
    buildWhenAffordable(world, 'siliconMine', { x: 46, y: 28 });
    buildWhenAffordable(world, 'factory', { x: 49, y: 52 });
    buildWhenAffordable(world, 'armory', { x: 52, y: 47 });

    // Allow construction and output to reach steady operation, then check every tick for two minutes.
    step(world, 2 * TICKS_PER_MINUTE);
    const prior = world.stock();
    for (let i = 0; i < 2 * TICKS_PER_MINUTE; i++) {
      world.step();
      const stock = world.stock();
      expect(RESOURCES.every((resource) => stock[resource] >= 0)).toBe(true);
    }
    const { gross, actual, net } = world.productionOverview();
    expect(gross).toEqual({ wood: 10, iron: 20, water: 10, silicon: 10, rations: 10, tools: 5, chips: 5, weapons: 5 });
    expect(actual).toEqual(gross);
    expect(net).toEqual({ wood: 5, iron: 0, water: 10, silicon: 5, rations: 10, tools: 5, chips: 5, weapons: 5 });
    const final = world.stock();
    for (const resource of RESOURCES) expect(final[resource] - prior[resource]).toBe(2 * net[resource]);
  });
});
