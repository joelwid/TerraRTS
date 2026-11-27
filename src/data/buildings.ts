import { TICK_MS, TICKS_PER_MINUTE } from '../sim/clock';
import type { Size } from '../sim/grid';
import { RESOURCES, type Cost, type Resource } from '../sim/inventory';
import type { Tile } from './map';
import raw from './buildings.json';

export const BUILDING_TYPES = [
  'hub', 'scanner', 'terraformer', 'forestry', 'farm', 'ironMine',
  'waterTower', 'siliconMine', 'blacksmith', 'factory', 'armory',
] as const;

export type BuildingType = typeof BUILDING_TYPES[number];

export interface Recipe {
  readonly batchesPerMinute: number;
  readonly interval: number;
  readonly inputs: Cost;
  readonly outputs: Cost;
}

interface BuildingDefinition extends Readonly<Size> {
  readonly name: string;
  readonly duration: number;
  readonly radius?: number;
  readonly demolitionRefund: number;
  readonly cost: Cost;
  readonly fertile: boolean;
  readonly deposit?: NonNullable<Tile['deposit']>['resource'];
  readonly production?: Recipe;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${label}`);
  return value;
}

function amounts(value: unknown, label: string): Cost {
  const entry = record(value, label);
  const result: Partial<Record<Resource, number>> = {};
  for (const resource of Object.keys(entry)) {
    if (!RESOURCES.some((known) => known === resource)) throw new Error(`Unknown resource ${resource}`);
  }
  for (const resource of RESOURCES) {
    if (Object.hasOwn(entry, resource)) result[resource] = positiveInteger(entry[resource], `${label} ${resource}`);
  }
  return Object.freeze(result);
}

function loadRecipe(value: unknown, kind: BuildingType): Recipe {
  const entry = record(value, `${kind} production`);
  const batchesPerMinute = positiveInteger(entry.batchesPerMinute, `${kind} batches per minute`);
  if (TICKS_PER_MINUTE % batchesPerMinute !== 0) throw new Error(`Invalid tick interval for ${kind}`);
  const inputs = amounts(entry.inputs, `${kind} inputs`);
  const outputs = amounts(entry.outputs, `${kind} outputs`);
  if (Object.keys(outputs).length === 0) throw new Error(`Missing outputs for ${kind}`);
  return Object.freeze({ batchesPerMinute, interval: TICKS_PER_MINUTE / batchesPerMinute, inputs, outputs });
}

function loadDefinition(value: unknown, kind: BuildingType): BuildingDefinition {
  const entry = record(value, kind);
  const { name, demolitionRefund, deposit, fertile } = entry;
  if (typeof name !== 'string' || name.trim() === '') throw new Error(`Invalid ${kind} name`);
  if (typeof demolitionRefund !== 'number' || !Number.isFinite(demolitionRefund) ||
      demolitionRefund < 0 || demolitionRefund > 1) {
    throw new Error(`Invalid ${kind} demolition refund`);
  }
  const width = positiveInteger(entry.width, `${kind} width`);
  const height = positiveInteger(entry.height, `${kind} height`);
  if (deposit !== undefined &&
      ((deposit !== 'water' && deposit !== 'iron' && deposit !== 'silicon') || width !== 2 || height !== 2)) {
    throw new Error(`Invalid deposit requirement for ${kind}`);
  }
  if (fertile !== undefined && typeof fertile !== 'boolean') throw new Error(`Invalid fertility requirement for ${kind}`);
  const infrastructure = kind === 'hub' || kind === 'scanner' || kind === 'terraformer';
  return Object.freeze({
    name, width, height, deposit, fertile: fertile === true, demolitionRefund,
    duration: positiveInteger(entry.seconds, `${kind} duration`) * (1000 / TICK_MS),
    radius: infrastructure ? positiveInteger(entry.radius, `${kind} radius`) : undefined,
    cost: amounts(entry.cost, `${kind} cost`),
    production: infrastructure ? undefined : loadRecipe(entry.production, kind),
  });
}

export const BUILDINGS: Readonly<Record<BuildingType, BuildingDefinition>> = Object.freeze(
  Object.fromEntries(BUILDING_TYPES.map((kind) => [kind, loadDefinition(raw[kind], kind)])) as Record<BuildingType, BuildingDefinition>,
);
