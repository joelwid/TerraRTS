# TerraRTS
Browser-native single-player economic RTS on a barren alien planet, inspired by Anno 1503. Target 20–30 minute matches; optimized ~15 minutes. Rocket launch is the sole victory.

Start with [AGENTS.md](AGENTS.md), then [game design](docs/GAME_DESIGN.md), [economy](docs/ECONOMY.md), [architecture](docs/ARCHITECTURE.md), [military](docs/MILITARY.md), [roadmap](docs/ROADMAP.md), and [testing](docs/TESTING.md). Numerical values are untested balancing seeds.

## Run the prototype

Use Node.js 20.19+ on the 20.x line, or Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open the Vite URL. Pan with WASD or the arrow keys, zoom at the pointer with the wheel, and click to select a tile. Choose a building to preview and place it. The starter checklist shows the remaining materials for a wood, iron, and tools economy. Escape exits build mode or clears the selection. Click a site or building to inspect it, cancel its construction, or demolish it. Select a finished producer to pause or resume it. Open Production overview beside the inventory to inspect resource flows.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

See the [foundation notes](docs/FOUNDATION.md) for map authoring and coordinates, and the [construction and territory notes](docs/CONSTRUCTION.md) for placement, refunds, and territory rules.

See [Basic economy](docs/ECONOMY.md#milestone-3-basic-economy) for a verified opening on Frontier Basin.
