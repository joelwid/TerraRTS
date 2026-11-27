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
Rocket: Spaceport cost above; assembly 150 iron+100 tools+50 chips, 90s; launch prep 50 iron+25 tools+50 chips, 30s; launch wins. Total 100 wood,300 iron,200 tools,125 chips excluding upstream inputs. No population gate. One level-1 factory alone needs 25 min for chips: balance via multiple factories, upgrades or reduced costs. Simulate full build orders before claiming target duration. All values untested.
