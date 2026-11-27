import type Phaser from 'phaser';
import type { BuildingType } from '../data/buildings';
import type { TerrainMap } from '../data/map';
import type { Footprint, Point } from '../sim/grid';
import type { World } from '../sim/world';
import { compareDepth, diamond, footprintDepth, project } from './isometric';

type Colors = readonly [number, number, number];

interface Landmark {
  id: string;
  footprint: Readonly<Footprint>;
  height: number;
  colors: Colors;
}

const BUILDING_STYLES: Record<BuildingType, Pick<Landmark, 'height' | 'colors'>> = {
  hub: { height: 55, colors: [0xbd9166, 0x624837, 0x865d44] },
  scanner: { height: 43, colors: [0x87a8be, 0x465a6a, 0x607e91] },
  terraformer: { height: 29, colors: [0xa5bd76, 0x546840, 0x73884e] },
  forestry: { height: 25, colors: [0x829760, 0x425939, 0x60794a] },
  farm: { height: 15, colors: [0xc8ae62, 0x6d5a32, 0x9b8245] },
  ironMine: { height: 29, colors: [0xa6948f, 0x62514c, 0x85726a] },
  waterTower: { height: 53, colors: [0x689bc5, 0x3c556a, 0x4b758f] },
  siliconMine: { height: 31, colors: [0x8dbac1, 0x4d6670, 0x628990] },
  blacksmith: { height: 37, colors: [0xbf805b, 0x6d4638, 0x9b6249] },
  factory: { height: 45, colors: [0xa49abd, 0x5e526b, 0x78688c] },
  armory: { height: 39, colors: [0xa8a7a1, 0x535351, 0x797872] },
};
const CRACK_COLORS = { iron: 0xd4d4d4, water: 0x377cf4, silicon: 0xa3e7f4 };

function drawLandmark(graphics: Phaser.GameObjects.Graphics, { footprint, height, colors }: Landmark): void {
  const [top, right, bottom, left] = diamond(footprint);
  const raise = ({ x, y }: Point) => ({ x, y: y - height });
  const roof = [raise(top), raise(right), raise(bottom), raise(left)];
  const faces = [[bottom, left, raise(left), raise(bottom)], [right, bottom, raise(bottom), raise(right)], roof];
  const paint = [colors[1], colors[2], colors[0]];

  faces.forEach((face, index) => {
    graphics.fillStyle(paint[index]!).fillPoints(face, true);
    graphics.lineStyle(1, 0x2e211a, 0.65).strokePoints(face, true);
  });
}

export function drawColony(
  terrain: Phaser.GameObjects.Graphics,
  objects: Phaser.GameObjects.Graphics,
  map: TerrainMap,
  world: World,
): void {
  terrain.clear();
  objects.clear();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = world.tileAt({ x, y })!;
      if (tile.fertile || tile.claimed) {
        const points = diamond({ x: x + 0.025, y: y + 0.025, width: 0.95, height: 0.95 });
        const claimedGround = tile.terrain === 'rock' ? 0x9b8066 : 0xc48c59;
        const fertileGround = tile.claimed ? 0x62783f : 0x49573a;
        const color = tile.fertile ? fertileGround : claimedGround;
        terrain.fillStyle(color, tile.fertile ? 0.96 : 0.57).fillPoints(points, true);
      }
      if (tile.fertile) {
        const tuft = project({ x: x + 0.69, y: y + 0.35 });
        terrain.lineStyle(1.5, 0xa6bb6c, 0.9).strokePoints([
          { x: tuft.x - 3, y: tuft.y - 3 }, tuft, { x: tuft.x + 2, y: tuft.y - 5 },
        ]);
      }
      if (tile.resource) {
        const center = project({ x: x + 0.5, y: y + 0.5 });
        terrain.lineStyle(2, CRACK_COLORS[tile.resource], 0.95).strokePoints([
          { x: center.x - 10, y: center.y + 5 }, { x: center.x - 3, y: center.y - 2 },
          { x: center.x + 1, y: center.y + 1 }, { x: center.x + 8, y: center.y - 5 },
        ]);
      }
    }
  }

  const landmarks: Landmark[] = map.rock.map((region) => ({
    id: `rock-${region.x}-${region.y}`,
    footprint: { x: region.x, y: region.y, width: 1, height: Math.min(2, region.height) },
    height: 22,
    colors: [0x826456, 0x493731, 0x594238],
  }));

  for (const building of world.listBuildings()) {
    const style = BUILDING_STYLES[building.type];
    const mutedColors: Colors = building.complete
      ? [0x82776b, 0x514740, 0x685d52]
      : [0xb3a083, 0x645a4b, 0x81715b];
    landmarks.push({
      id: `building-${building.id}`,
      footprint: building.footprint,
      height: building.complete ? style.height : 8,
      colors: building.active ? style.colors : mutedColors,
    });
  }

  const sorted = landmarks.map((landmark) => ({
    ...landmark,
    depth: footprintDepth(landmark.footprint),
    screenX: project(landmark.footprint).x,
  })).sort(compareDepth);
  sorted.forEach((landmark) => drawLandmark(objects, landmark));
}
