import type { Recipe } from '../data/buildings';
import { TICKS_PER_MINUTE } from './clock';
import { RESOURCES, type Inventory, type Resource, type Stock } from './inventory';

export type ProductionStatus = 'running' | 'shortage' | 'paused' | 'inactive';

export interface ProductionOverview {
  readonly gross: Stock;
  readonly actual: Stock;
  readonly consumed: Stock;
  readonly net: Stock;
}

interface Job {
  readonly id: number;
  readonly recipe: Recipe;
  readonly inputResources: readonly Resource[];
  elapsed: number;
  dueSince: number;
  paused: boolean;
  blocked: boolean;
}

type Amounts = Record<Resource, number>;

function zero(): Amounts {
  return { wood: 0, iron: 0, water: 0, silicon: 0, rations: 0, tools: 0, chips: 0, weapons: 0 };
}

export class Production {
  private readonly jobs = new Map<number, Job>();
  private readonly history: { tick: number; recipe: Recipe }[] = [];

  constructor(private readonly inventory: Inventory) {}

  add(id: number, recipe: Recipe): void {
    this.jobs.set(id, {
      id, recipe, inputResources: RESOURCES.filter((resource) => recipe.inputs[resource] !== undefined),
      elapsed: 0, dueSince: 0, paused: false, blocked: false,
    });
  }

  remove(id: number): void {
    this.jobs.delete(id);
  }

  setPaused(id: number, paused: boolean): boolean {
    const job = this.jobs.get(id);
    if (!job || job.paused === paused) return false;
    job.paused = paused;
    return true;
  }

  status(id: number, active: boolean): { status: ProductionStatus; paused: boolean } | undefined {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.paused) return { status: 'paused', paused: true };
    if (!active) return { status: 'inactive', paused: false };
    return { status: job.blocked ? 'shortage' : 'running', paused: false };
  }

  step(tick: number, isActive: (id: number) => boolean): boolean {
    let changed = false;
    while (this.history[0] && this.history[0].tick <= tick - TICKS_PER_MINUTE) {
      this.history.shift();
      changed = true;
    }

    const due: Job[] = [];
    const rawSupply = new Set<Resource>();
    for (const job of this.jobs.values()) {
      if (job.paused || !isActive(job.id)) continue;
      if (job.inputResources.length === 0) {
        for (const resource of RESOURCES) if (job.recipe.outputs[resource]) rawSupply.add(resource);
      }
      if (job.elapsed < job.recipe.interval) {
        job.elapsed++;
        if (job.elapsed === job.recipe.interval) job.dueSince = tick;
      }
      if (job.dueSince) due.push(job);
    }

    // Supply first, then give older pending batches priority over newly ready ones.
    due.sort((a, b) =>
      Number(a.inputResources.length > 0) - Number(b.inputResources.length > 0) ||
      a.dueSince - b.dueSince || a.id - b.id,
    );
    const held = new Set<Resource>();
    for (const job of due) {
      const { inputs, outputs } = job.recipe;
      if (job.inputResources.some((resource) => held.has(resource)) || !this.inventory.transact(inputs, outputs)) {
        const [onlyInput] = job.inputResources;
        // Give an older single-input batch room to accumulate its full requirement
        // while an active raw producer can replenish that input.
        if (onlyInput && job.inputResources.length === 1 &&
            rawSupply.has(onlyInput) && this.inventory.amount(onlyInput) > 0) {
          held.add(onlyInput);
        }
        changed ||= !job.blocked;
        job.blocked = true;
        continue;
      }
      job.elapsed = 0;
      job.dueSince = 0;
      job.blocked = false;
      this.history.push({ tick, recipe: job.recipe });
      changed = true;
    }
    return changed;
  }

  overview(isActive: (id: number) => boolean): ProductionOverview {
    const gross = zero();
    const actual = zero();
    const consumed = zero();
    const net = zero();
    for (const job of this.jobs.values()) {
      if (job.paused || !isActive(job.id)) continue;
      for (const resource of RESOURCES) {
        gross[resource] += (job.recipe.outputs[resource] ?? 0) * job.recipe.batchesPerMinute;
      }
    }
    for (const { recipe } of this.history) {
      for (const resource of RESOURCES) {
        actual[resource] += recipe.outputs[resource] ?? 0;
        consumed[resource] += recipe.inputs[resource] ?? 0;
      }
    }
    for (const resource of RESOURCES) net[resource] = actual[resource] - consumed[resource];
    return { gross, actual, consumed, net };
  }
}
