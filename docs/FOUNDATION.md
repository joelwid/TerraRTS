# Milestone 1 foundation

The prototype opens at the center of Frontier Basin, a handcrafted 96×96 map. The canvas draws static soil and rock tiles with original geometric landmarks. The HUD shows the current simulation tick and the selected tile’s logical coordinates and terrain.

## Clock and rendering

`src/sim/clock.ts` accepts elapsed milliseconds and emits numbered ticks in 100 ms steps. The clock exposes the fraction of the next tick for future interpolation. Its headless API supports paused, normal, and double-speed operation. The prototype runs at normal speed with rendering on Phaser’s frame loop.

`src/render/isometric.ts` projects logical coordinates into 64×32 diamonds. Integer coordinates mark the top vertex of a tile. Picking undoes camera pan and zoom, applies the inverse projection, then floors the logical coordinates and checks bounds. At an exact shared edge, the tile on the increasing coordinate side owns that edge.

Terrain is baked into 16×16-tile textures. Landmarks are drawn back to front by projected footprint front edge, with ties broken by projected X and stable ID. The survey marker beside the starting landmark demonstrates overlapping geometry. The selection outline is drawn above landmarks so the selected grid cell stays visible.

## Handcrafted map

Edit `src/data/frontier.json` to change the layout. Soil is the default. Rectangle entries define impassable rock, the starting footprint, underground deposits, and reserved nest sites. Coordinates and sizes are whole tiles. Each deposit has a stable ID, one resource, and a 2×2 footprint. Deposit metadata stays in map data and is absent from the terrain rendering and selection HUD.

The loader checks bounds, overlap across feature types, IDs, and footprint constraints before building a row-major tile grid. A four-neighbor flood fill requires all walkable terrain to connect to the starting area. Start and nest footprints remain traversable at this stage. The map reserves sites for later milestones. Economy and combat balance remain untested.

## Verification

- `npm ci`, `npm run typecheck`, `npm test` (15 tests), and `npm run build` passed. Vite reported a size warning for the Phaser-containing bundle (about 336 kB gzipped).
- Tested the production preview in headless Chromium 156 at desktop viewport sizes. The canvas rendered terrain and overlapping landmarks, the tick counter advanced, and soil and rock clicks returned the expected coordinates. Confirmed WASD and arrow panning, pointer-anchored zoom, off-map clicks, Escape, and viewport resizing. The final run reported zero browser errors.
