# Economy and balancing seeds
Eight shared unlimited stocks: wood, iron, water, silicon, rations, tools, chips, weapons. Population separate. Automatic production, atomic input/output batches, no negative stock; pause on shortages and resume automatically. Manual production pause. Stable deterministic allocation order; avoid starvation where possible. All costs upfront; parallel construction; occupied immediately; operational on completion.

| Building | Footprint | Wood | Iron | Tools | Chips | Seconds |
|---|---|---:|---:|---:|---:|---:|
| Hub | 3x3 |60|30|30|0|30|
| Terraformer |1x1|10|0|5|0|10|
| Geo Scanner |1x1|5|0|2|0|5|
| Forestry |4x4|10|0|5|0|15|
| Farm |4x4|10|0|5|0|15|
| Iron Mine |2x2|15|0|5|0|20|
| Water Tower |2x2|10|0|5|0|15|
| Silicon Mine |2x2|15|0|10|0|20|
| Residence |2x2|20|0|10|0|15|
| Blacksmith |2x2|15|10|5|0|20|
| Factory |3x3|20|15|10|0|25|
| Armory |2x2|15|15|10|0|20|
| Barracks |3x3|25|20|15|0|25|
| Defence Tower |1x1|10|25|15|0|20|
| Spaceport |6x6|100|100|75|25|60|

Residence additionally costs 20 rations and 20 water. Start with free Hub and 100 wood, 40 iron, 50 tools, 20 rations, 20 water, zero others. Raw producers output 10/25/40 per minute by level. Blacksmith 1 wood+1 iron ->1 tool; Factory 1 iron+1 silicon ->1 chip; Armory 2 iron ->1 weapon. Refinement outputs 5/12/20 per minute. Use integer batches with time accumulators. No input for raw producers.
Population levels: residence 10/25/50. Milestones 50 unlock L2 residences/agriculture, 100 L2 mining/refinement/barracks/towers, 200 L3 residences/agriculture, 300 L3 industry/military. Unlocks persist after population loss (proposed). Inactive residences provide no population. Upgrade costs L2/L3: raw 15 wood+20 tools /20 iron+35 tools+10 chips; refinement and barracks 20 iron+20 tools /30 iron+30 tools+10 chips; towers 20 iron+15 tools /30 iron+25 tools+10 chips. Residence L2 10 wood+15 tools+30 rations+30 water; L3 20 wood+25 tools+50 rations+50 water. Proposed upgrade duration 20/30s; production paused; same footprint. Hub/scanner/terraformer/spaceport not upgradeable.
Refunds proposed: unfinished cancel 100%; ordinary demolition 75% of completed investments (round down), Hub 50%, scanner/terraformer zero, enemy destruction zero. Cancel unfinished upgrade refunds its own cost. Never duplicate refunds.
Rocket: Spaceport cost above; assembly 150 iron+100 tools+50 chips, 90s; launch prep 50 iron+25 tools+50 chips, 30s; launch wins. Total 100 wood,300 iron,200 tools,125 chips excluding upstream inputs. No population gate. One level-1 factory alone needs 25 min for chips: balance via multiple factories, upgrades or reduced costs. Simulate full build orders before claiming target duration. Rocket timing and strategic balance remain untested.

## Milestone 3 basic economy

The eight level-1 producers use the starting stock, costs, and rates above. Forestry and Farm require all 16 tiles to be fertile. Iron Mine, Water Tower, and Silicon Mine must cover the four squares of one matching deposit. The placement preview and command use the same validation. Unclaimed ground returns the territory requirement before checking geology.

A raw producer completes one batch every six simulation seconds. A refiner completes one every twelve. Construction must finish before the first production interval starts. Batch inputs are checked together before any stocks change. A due batch retries each tick during a shortage, with at most one waiting batch per building. Manual pause and claim loss freeze progress. A paused processor releases its inputs for construction or other processors, and a disconnected building resumes when coverage returns.

Raw batches resolve first each tick. Processors resolve by the time their batch became ready, with building ID breaking ties. When a single-input batch needs more units than are available and a connected, unpaused raw producer can supply that input, younger batches leave the available units in stock so the older batch can accumulate enough. These units remain available for construction. A processor waiting for a different input leaves its other materials available to peers.

The inventory shows current holdings. Production overview shows gross output capacity per minute from connected, unpaused producers, including those waiting for inputs. Actual output, inputs used, and net production count completed batches over the trailing 60 simulation seconds. Construction costs and refunds affect holdings.

### Verified opening on Frontier Basin

The base economy requires 50 wood, 10 iron and 20 tools from the starting stock.

1. Place a Terraformer at (45, 46) and an Iron Mine at (42, 47).
2. After the Terraformer finishes, place Forestry at (42, 42). Place a Blacksmith at (49, 44).
3. Add a Water Tower at (50, 49). Place a Terraformer at (49, 51), then a Farm at (45, 50).
4. As materials accumulate, place and complete northward Hubs at (46, 41), (46, 35), and (48, 29). Add a second Iron Mine at (51, 31), a Silicon Mine at (46, 28), a Factory at (49, 52), and an Armory at (52, 47).

With this layout, the two Iron Mines supply 20 iron per minute, matching the combined refiner demand. Every other stock grows at steady state. The tests cover a Hub-first opening that waits for wood, and a zero-wood detour that funds Forestry with the expansion Hub’s demolition refund. The HUD shows the remaining starter costs. For expansion, manually pause processors when their inputs are needed for construction. Retaining a way to rebuild essential producers still matters if stocks are deliberately spent on nonrefundable buildings.

### Verification

- `npm ci`, `npm run typecheck`, `npm test` (41 tests), and `npm run build` passed. Tests cover exact deposit and fertility rules, atomic transactions, deterministic allocation, shortage recovery, pause, claim loss, and the fresh-start economy. The all-producer route ran at steady state for two measured minutes with nonnegative stocks and actual output matching capacity.
- The production preview passed in headless Chromium 156 with zero page or console errors. The smoke test verified invalid and valid placements, manual pause and resume, live production rates, shortage recovery without partial spending, and camera and selection controls. Vite reported a size warning for the Phaser-containing bundle (about 343 kB gzipped).
