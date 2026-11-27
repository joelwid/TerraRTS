import { TICK_MS } from '../sim/clock';
import type { Size } from '../sim/grid';
import { RESOURCES, type Cost, type Resource } from '../sim/inventory';
import raw from './buildings.json';

export const BUILDING_TYPES = ['hub', 'scanner', 'terraformer'] as const;

export type BuildingType = typeof BUILDING_TYPES[number];

interface BuildingDefinition extends Readonly<Size> {
  readonly name: string;
  readonly duration: number;
  readonly radius: number;
  readonly demolitionRefund: number;
  readonly cost: Cost;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function loadDefinition(value: unknown, kind: BuildingType): BuildingDefinition {
  const entry = record(value, kind);
  const { name, demolitionRefund } = entry;
  if (typeof name !== 'string' || name.trim() === '') throw new Error(`Invalid ${kind} name`);
  if (typeof demolitionRefund !== 'number' || !Number.isFinite(demolitionRefund) ||
      demolitionRefund < 0 || demolitionRefund > 1) {
    throw new Error(`Invalid ${kind} demolition refund`);
  }
  const cost: Partial<Record<Resource, number>> = {};
  const rawCost = record(entry.cost, `${kind} cost`);
  for (const resource of Object.keys(rawCost)) {
    if (!RESOURCES.some((known) => known === resource)) throw new Error(`Unknown resource ${resource}`);
  }
  for (const resource of RESOURCES) {
    if (Object.hasOwn(rawCost, resource)) {
      cost[resource] = positiveInteger(rawCost[resource], `${kind} ${resource} cost`);
    }
  }
  return Object.freeze({
    name,
    width: positiveInteger(entry.width, `${kind} width`),
    height: positiveInteger(entry.height, `${kind} height`),
    duration: positiveInteger(entry.seconds, `${kind} duration`) * (1000 / TICK_MS),
    radius: positiveInteger(entry.radius, `${kind} radius`),
    demolitionRefund,
    cost: Object.freeze(cost),
  });
}

export const BUILDINGS: Readonly<Record<BuildingType, BuildingDefinition>> = Object.freeze({
  hub: loadDefinition(raw.hub, 'hub'),
  scanner: loadDefinition(raw.scanner, 'scanner'),
  terraformer: loadDefinition(raw.terraformer, 'terraformer'),
});
