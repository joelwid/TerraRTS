# Milestones — all pending
1. Foundation: scaffold browser project, clock, grid, fixed map loader, static isometric terrain, camera, picking, depth sorting. Gate: navigable map and projection tests.
2. Construction/territory: inventory, definitions, placement preview, construction/cancel/demolish, Hub claim and automatic scan, scanner, permanent terraforming, selection UI. Gate: overlapping claims and permanent effects verified.
3. Economy: exact 2x2 deposits, five raw producers, three refiners, shortage handling, manual pause, resource and production HUD. Gate: sustainable basic economy, no negative stocks.
4. First economic playable: spaceport stages, rocket tracker, victory, menu/restart, pause/speed, timer/results. Gate: complete peaceful browser playthrough from fresh match. Balance early if impossible.
5. Vertical growth: residences, milestones, upgrades, level sprites, cost/benefit preview. Gate: compact upgraded and low-pop expansion routes both viable.
6. Military: barracks, queue, three units, selection, pathfinding, movement, targeting, counters, damage/death. Gate: debug combat and movement tests.
7. Aliens: nests, local AI, respawn/leash, rewards, towers, building destruction/repair, claim loss, defeat, threat warnings. Gate: peaceful avoidance, defense and nest clearing work.
8. Balance/usability: headless build-order simulator, fixed map tuning, all strategy tests, minimap/overlays, tooltips, performance, browser build. Gate: complete v0.1 acceptance in TESTING.md.

Dependencies sequential by default. After milestone 2, independent UI work may branch against stable interfaces; military can develop against debug targets while economy progresses, but integrate before final balancing. Each PR documents tests and remaining gaps. Do not add animations, audio (proposed deferral), multiplayer, procedural generation, saves or map editor. No calendar commitments; estimates depend on implementation.
