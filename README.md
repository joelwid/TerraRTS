# TerraRTS
Browser-native single-player economic RTS on a barren alien planet, inspired by Anno 1503. Target 20–30 minute matches; optimized ~15 minutes. Rocket launch is the sole victory.

Start with [AGENTS.md](AGENTS.md), then [game design](docs/GAME_DESIGN.md), [economy](docs/ECONOMY.md), [architecture](docs/ARCHITECTURE.md), [military](docs/MILITARY.md), [roadmap](docs/ROADMAP.md), and [testing](docs/TESTING.md). Numerical values are untested balancing seeds.

## Run the foundation prototype

Use Node.js 20.19+ on the 20.x line, or Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open the Vite URL. Pan with WASD or the arrow keys, zoom at the pointer with the wheel, and click to select a tile. Escape or a click outside the map clears the selection.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

See the [Milestone 1 implementation notes](docs/FOUNDATION.md) for map authoring, coordinate conventions, and verification.
