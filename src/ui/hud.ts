import { BUILDINGS, BUILDING_TYPES, type BuildingType } from '../data/buildings';
import { TICK_MS } from '../sim/clock';
import type { Point } from '../sim/grid';
import { RESOURCES, type Cost, type Resource, type Stock } from '../sim/inventory';
import type { BuildingView, PlacementIssue, World } from '../sim/world';

const ISSUE_TEXT: Record<PlacementIssue, string> = {
  'outside-map': 'The footprint extends beyond the map.',
  unbuildable: 'The footprint crosses unbuildable terrain.',
  occupied: 'The footprint overlaps a building or construction site.',
  unclaimed: 'The entire footprint must be in claimed territory.',
  'requires-fertile-soil': 'Every tile in the footprint needs fertile soil.',
  'requires-matching-deposit': 'Align the footprint exactly over a matching 2×2 deposit.',
  'insufficient-stock': 'Insufficient stock. Pause processors if you need to save their inputs for construction.',
};

const BUILD_DESCRIPTION: Partial<Record<BuildingType, string>> = {
  hub: 'Claims and scans nearby tiles when connected to the original Hub.',
  scanner: 'Scans nearby tiles on completion, including unclaimed terrain.',
  terraformer: 'Permanently fertilizes nearby claimed soil on completion.',
};

const ticksToSeconds = (ticks: number) => ticks * TICK_MS / 1000;

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const PRODUCTION_LABEL = {
  running: 'Producing',
  shortage: 'Waiting for inputs',
  paused: 'Production paused',
  inactive: 'Outside territory',
};

const STARTER_BUILDINGS = ['terraformer', 'forestry', 'ironMine', 'blacksmith'] as const;

function describeAmounts(cost: Cost): string {
  return RESOURCES.flatMap((resource) => {
    const amount = cost[resource];
    return amount ? [`${amount} ${resource}`] : [];
  }).join(' + ');
}

function buildDescription(type: BuildingType): string {
  const def = BUILDINGS[type];
  if (!def.production) return BUILD_DESCRIPTION[type] ?? '';
  const { inputs, outputs, batchesPerMinute } = def.production;
  const recipe = describeAmounts(inputs);
  const output = describeAmounts(outputs);
  let requirement = '';
  if (def.fertile) requirement = ' Requires a fully fertile footprint.';
  if (def.deposit) requirement = ` Requires one exact 2×2 ${def.deposit} deposit.`;
  return `${recipe ? recipe + ' → ' : ''}${output} per batch · ${batchesPerMinute} batches/min.${requirement}`;
}

export class ColonyHud {
  private readonly stock = document.querySelector('#stock')!;
  private readonly placement = document.querySelector<HTMLOutputElement>('#placement')!;
  private readonly selection = document.querySelector<HTMLOutputElement>('#selection')!;
  private readonly progress = document.querySelector<HTMLProgressElement>('#construction-progress')!;
  private readonly rates = document.querySelector('#production-rates')!;
  private readonly productionPanel = document.querySelector<HTMLDetailsElement>('.production-panel')!;
  private readonly productionAction = document.querySelector<HTMLButtonElement>('#production-action')!;
  private readonly action = document.querySelector<HTMLButtonElement>('#building-action')!;
  private readonly feedback = document.querySelector<HTMLOutputElement>('#feedback')!;
  private readonly tick = document.querySelector('#tick')!;
  private readonly buildButtons = new Map<BuildingType, HTMLButtonElement>();

  constructor(
    onBuild: (type: BuildingType) => void, onRemove: () => void, onPause: () => void, world: World,
  ) {
    const toolbar = document.querySelector('#build-options')!;
    for (const type of BUILDING_TYPES) {
      const def = BUILDINGS[type];
      const button = document.createElement('button');
      const label = document.createElement('strong');
      const details = document.createElement('small');
      const cost = RESOURCES.flatMap((resource) => {
        const amount = def.cost[resource];
        return amount ? [`${amount} ${resource}`] : [];
      }).join(' · ');
      label.textContent = def.name;
      details.textContent = `${def.width}×${def.height} · ${ticksToSeconds(def.duration)}s · ${cost}`;
      button.type = 'button';
      button.title = buildDescription(type);
      button.setAttribute('aria-pressed', 'false');
      button.append(label, details);
      button.addEventListener('click', () => onBuild(type));
      toolbar.append(button);
      this.buildButtons.set(type, button);
    }
    this.action.addEventListener('click', onRemove);
    this.productionAction.addEventListener('click', onPause);
    this.productionPanel.addEventListener('toggle', () => this.showProduction(world));
  }

  showStock(stock: Stock): void {
    this.stock.replaceChildren(...RESOURCES.map((resource) => {
      const item = document.createElement('li');
      const value = document.createElement('strong');
      value.textContent = String(stock[resource]);
      item.append(`${titleCase(resource)} `, value);
      return item;
    }));
  }

  showProduction(world: World): void {
    if (!this.productionPanel.open) return;
    const rates = world.productionOverview();
    this.rates.replaceChildren(...RESOURCES.map((resource) => {
      const row = document.createElement('tr');
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = titleCase(resource);
      row.append(label);
      for (const rate of [rates.gross, rates.actual, rates.consumed, rates.net]) {
        const cell = row.insertCell();
        cell.textContent = String(rate[resource]);
        cell.dataset.negative = String(rate[resource] < 0);
      }
      return row;
    }));
  }

  starterMessage(world: World): string {
    const buildings = world.listBuildings();
    const missing = STARTER_BUILDINGS.filter((type) => !buildings.some((building) => building.type === type));
    if (missing.length === 0) return '';
    const cost: Partial<Record<Resource, number>> = {};
    for (const type of missing) {
      for (const resource of RESOURCES) {
        const amount = BUILDINGS[type].cost[resource];
        if (amount) cost[resource] = (cost[resource] ?? 0) + amount;
      }
    }
    const route = missing.map((type) => BUILDINGS[type].name).join(' → ');
    return `Starter economy · ${route} · Reserve ${describeAmounts(cost)}.`;
  }

  showPlacement(type?: BuildingType, issue?: PlacementIssue, hovering = false, idleMessage = ''): void {
    for (const [key, button] of this.buildButtons) button.setAttribute('aria-pressed', String(key === type));
    let message = type ? buildDescription(type) : idleMessage;
    if (type && hovering) message = issue ? ISSUE_TEXT[issue] : `Click to place ${BUILDINGS[type].name}.`;
    this.placement.textContent = message;
    this.placement.dataset.invalid = String(Boolean(issue));
  }

  showFeedback(message = ''): void {
    this.feedback.textContent = message;
  }

  showSelection(world: World, point?: Point): void {
    const tile = point && world.tileAt(point);
    const building = tile?.buildingId === undefined ? undefined : world.building(tile.buildingId);
    if (!point || !tile) {
      this.selection.value = 'No tile selected';
    } else {
      const survey = tile.resource ? `${titleCase(tile.resource)} deposit` : 'Scanned · No deposit';
      const details = [
        `Tile (${point.x}, ${point.y})`,
        titleCase(tile.terrain),
        tile.claimed ? 'Claimed' : 'Unclaimed',
        tile.scanned ? survey : 'Unscanned',
      ];
      if (tile.fertile) details.push('Fertile');
      if (building) {
        let status = building.complete ? 'Inactive' : 'Under construction';
        if (building.active) status = building.original ? 'Original' : 'Active';
        if (building.production) status = PRODUCTION_LABEL[building.production.status];
        details.push(`${BUILDINGS[building.type].name} (${status})`);
      }
      this.selection.value = details.join(' · ');
    }

    this.productionAction.hidden = !building?.production;
    this.productionAction.textContent = building?.production?.paused ? 'Resume production' : 'Pause production';
    this.action.hidden = !building || building.original;
    this.action.textContent = building?.complete ? 'Demolish' : 'Cancel construction';
    this.progress.hidden = !building || building.complete;
    this.updateProgress(building);
  }

  showTick(tick: number, building?: BuildingView): void {
    this.tick.textContent = String(tick);
    this.updateProgress(building);
  }

  private updateProgress(building?: BuildingView): void {
    if (!building || building.complete) return;
    const { duration } = BUILDINGS[building.type];
    this.progress.max = duration;
    this.progress.value = duration - building.remainingTicks;
    const remaining = `${ticksToSeconds(building.remainingTicks).toFixed(1)} seconds remaining`;
    this.progress.setAttribute('aria-valuetext', remaining);
    this.progress.title = remaining;
  }
}
