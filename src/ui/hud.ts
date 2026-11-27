import { BUILDINGS, BUILDING_TYPES, type BuildingType } from '../data/buildings';
import { TICK_MS } from '../sim/clock';
import type { Point } from '../sim/grid';
import { RESOURCES, type Stock } from '../sim/inventory';
import type { BuildingView, PlacementIssue, World } from '../sim/world';

const ISSUE_TEXT: Record<PlacementIssue, string> = {
  'outside-map': 'The footprint extends beyond the map.',
  unbuildable: 'The footprint crosses unbuildable terrain.',
  occupied: 'The footprint overlaps a building or construction site.',
  unclaimed: 'The entire footprint must be in claimed territory.',
  'insufficient-stock': 'Insufficient stock.',
};

const BUILD_DESCRIPTION: Record<BuildingType, string> = {
  hub: 'Claims and scans nearby tiles when connected to the original Hub.',
  scanner: 'Scans nearby tiles on completion, including unclaimed terrain.',
  terraformer: 'Permanently fertilizes nearby claimed soil on completion.',
};

const ticksToSeconds = (ticks: number) => ticks * TICK_MS / 1000;

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export class ColonyHud {
  private readonly stock = document.querySelector('#stock')!;
  private readonly placement = document.querySelector<HTMLOutputElement>('#placement')!;
  private readonly selection = document.querySelector<HTMLOutputElement>('#selection')!;
  private readonly progress = document.querySelector<HTMLProgressElement>('#construction-progress')!;
  private readonly action = document.querySelector<HTMLButtonElement>('#building-action')!;
  private readonly feedback = document.querySelector<HTMLOutputElement>('#feedback')!;
  private readonly tick = document.querySelector('#tick')!;
  private readonly buildButtons = new Map<BuildingType, HTMLButtonElement>();

  constructor(onBuild: (type: BuildingType) => void, onRemove: () => void) {
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
      button.title = BUILD_DESCRIPTION[type];
      button.setAttribute('aria-pressed', 'false');
      button.append(label, details);
      button.addEventListener('click', () => onBuild(type));
      toolbar.append(button);
      this.buildButtons.set(type, button);
    }
    this.action.addEventListener('click', onRemove);
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

  showPlacement(type?: BuildingType, issue?: PlacementIssue, hovering = false): void {
    for (const [key, button] of this.buildButtons) button.setAttribute('aria-pressed', String(key === type));
    let message = type ? BUILD_DESCRIPTION[type] : '';
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
        details.push(`${BUILDINGS[building.type].name} (${status})`);
      }
      this.selection.value = details.join(' · ');
    }

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
