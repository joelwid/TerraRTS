export const RESOURCES = ['wood', 'iron', 'water', 'silicon', 'rations', 'tools', 'chips', 'weapons'] as const;

export type Resource = typeof RESOURCES[number];
export type Stock = Readonly<Record<Resource, number>>;
export type Cost = Readonly<Partial<Stock>>;

export const STARTING_STOCK: Stock = Object.freeze({
  wood: 100, iron: 40, water: 20, silicon: 0, rations: 20, tools: 50, chips: 0, weapons: 0,
});

export class Inventory {
  private readonly stock: Record<Resource, number>;

  constructor(initial: Stock) {
    if (RESOURCES.some((resource) => !Number.isSafeInteger(initial[resource]) || initial[resource] < 0)) {
      throw new Error('Initial stock must contain nonnegative integer amounts');
    }
    this.stock = { ...initial };
  }

  snapshot(): Stock {
    return { ...this.stock };
  }

  amount(resource: Resource): number {
    return this.stock[resource];
  }

  canPay(cost: Cost): boolean {
    return RESOURCES.every((resource) => this.stock[resource] >= (cost[resource] ?? 0));
  }

  pay(cost: Cost): boolean {
    return this.transact(cost, {});
  }

  transact(inputs: Cost, outputs: Cost): boolean {
    if (!this.canPay(inputs)) return false;
    for (const resource of RESOURCES) {
      this.stock[resource] += (outputs[resource] ?? 0) - (inputs[resource] ?? 0);
    }
    return true;
  }

  refund(cost: Cost, fraction: number): void {
    for (const resource of RESOURCES) {
      this.stock[resource] += Math.floor((cost[resource] ?? 0) * fraction);
    }
  }
}
